"""Local financial-theory RAG store with deterministic hybrid retrieval.

The index intentionally uses only Python's standard library.  It combines a
hashed token vector with lexical query coverage, which keeps the project easy
to run while still supporting Chinese financial terminology.  Live fund facts
do not belong in this store; retrieved passages are general analytical frames.
"""

from __future__ import annotations

from array import array
import argparse
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sqlite3
from typing import Any, Iterable, Sequence

from .env import load_project_env


load_project_env()

VECTOR_DIMENSIONS = 768
DEFAULT_TOP_K = 5
SUPPORTED_SUFFIXES = {".md", ".txt"}
_LATIN_NUMBER_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_+.-]*|\d+(?:\.\d+)?")
_CJK_RE = re.compile(r"[\u3400-\u9fff]+")
_HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$")


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _configured_path(name: str, default: Path) -> Path:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    path = Path(raw).expanduser()
    return path if path.is_absolute() else project_root() / path


def default_knowledge_dir() -> Path:
    return _configured_path("RAG_KNOWLEDGE_DIR", project_root() / "knowledge")


def default_database_path() -> Path:
    return _configured_path("RAG_DATABASE_PATH", project_root() / "data" / "rag" / "knowledge.sqlite3")


def _tokens(text: str) -> list[str]:
    """Return stable tokens for Chinese and latin financial text."""
    lowered = text.lower()
    output = _LATIN_NUMBER_RE.findall(lowered)
    for sequence in _CJK_RE.findall(lowered):
        output.extend(sequence)
        output.extend(sequence[index:index + 2] for index in range(max(0, len(sequence) - 1)))
        if len(sequence) >= 3:
            output.extend(sequence[index:index + 3] for index in range(len(sequence) - 2))
    return [token for token in output if token.strip()]


def _vector(text: str, dimensions: int = VECTOR_DIMENSIONS) -> list[float]:
    counts = Counter(_tokens(text))
    values = [0.0] * dimensions
    for token, count in counts.items():
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        raw = int.from_bytes(digest, "little")
        index = raw % dimensions
        sign = 1.0 if raw & (1 << 63) else -1.0
        values[index] += sign * (1.0 + math.log(count))
    norm = math.sqrt(sum(value * value for value in values))
    return [value / norm for value in values] if norm else values


def _pack_vector(values: Sequence[float]) -> bytes:
    return array("f", values).tobytes()


def _unpack_vector(payload: bytes) -> array:
    values = array("f")
    values.frombytes(payload)
    return values


def _dot(left: Sequence[float], right: Sequence[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}, text
    metadata: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip().lower()] = value.strip().strip('"\'')
    return metadata, text[end + 5:]


@dataclass(frozen=True)
class KnowledgeDocument:
    path: Path
    relative_path: str
    title: str
    category: str
    tags: tuple[str, ...]
    body: str
    checksum: str


def _read_document(path: Path, base_dir: Path) -> KnowledgeDocument:
    text = path.read_text(encoding="utf-8")
    metadata, body = _parse_frontmatter(text)
    title = metadata.get("title") or path.stem.replace("-", " ")
    category = metadata.get("category") or "通用金融理论"
    tags = tuple(item.strip() for item in metadata.get("tags", "").split(",") if item.strip())
    relative = path.relative_to(base_dir).as_posix()
    checksum = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return KnowledgeDocument(path, relative, title, category, tags, body.strip(), checksum)


def _split_long_text(text: str, maximum: int, overlap: int) -> list[str]:
    if len(text) <= maximum:
        return [text]
    parts: list[str] = []
    start = 0
    while start < len(text):
        target = min(start + maximum, len(text))
        end = target
        if target < len(text):
            candidates = [text.rfind(mark, start + maximum // 2, target) for mark in ("。", "；", "\n")]
            boundary = max(candidates)
            if boundary > start:
                end = boundary + 1
        part = text[start:end].strip()
        if part:
            parts.append(part)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return parts


def _chunk_document(document: KnowledgeDocument, maximum: int = 900, overlap: int = 120) -> list[dict[str, str]]:
    sections: list[tuple[str, list[str]]] = []
    heading = document.title
    paragraphs: list[str] = []
    buffer: list[str] = []

    def flush_paragraph() -> None:
        if buffer:
            paragraphs.append("\n".join(buffer).strip())
            buffer.clear()

    def flush_section() -> None:
        flush_paragraph()
        if paragraphs:
            sections.append((heading, list(paragraphs)))
            paragraphs.clear()

    for raw_line in document.body.splitlines():
        match = _HEADING_RE.match(raw_line.strip())
        if match:
            flush_section()
            heading = match.group(1).strip()
        elif raw_line.strip():
            buffer.append(raw_line.strip())
        else:
            flush_paragraph()
    flush_section()

    chunks: list[dict[str, str]] = []
    for section_heading, section_paragraphs in sections:
        current = ""
        for paragraph in section_paragraphs:
            candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
            if len(candidate) <= maximum:
                current = candidate
                continue
            if current:
                chunks.append({"heading": section_heading, "content": current})
                carry = current[-overlap:].lstrip() if overlap else ""
                current = f"{carry}\n\n{paragraph}".strip()
            else:
                for part in _split_long_text(paragraph, maximum, overlap):
                    chunks.append({"heading": section_heading, "content": part})
                current = ""
            if len(current) > maximum:
                split = _split_long_text(current, maximum, overlap)
                chunks.extend({"heading": section_heading, "content": part} for part in split[:-1])
                current = split[-1]
        if current:
            chunks.append({"heading": section_heading, "content": current})
    return chunks


class RagKnowledgeBase:
    """SQLite-backed financial theory corpus."""

    def __init__(self, knowledge_dir: Path | str | None = None, database_path: Path | str | None = None) -> None:
        self.knowledge_dir = Path(knowledge_dir) if knowledge_dir is not None else default_knowledge_dir()
        self.database_path = Path(database_path) if database_path is not None else default_database_path()

    def _files(self) -> list[Path]:
        if not self.knowledge_dir.is_dir():
            return []
        return sorted(
            path for path in self.knowledge_dir.rglob("*")
            if path.is_file()
            and path.suffix.lower() in SUPPORTED_SUFFIXES
            and path.name.lower() != "readme.md"
        )

    def _corpus_hash(self, files: Iterable[Path] | None = None) -> str:
        digest = hashlib.sha256()
        for path in files if files is not None else self._files():
            digest.update(path.relative_to(self.knowledge_dir).as_posix().encode("utf-8"))
            digest.update(b"\0")
            digest.update(path.read_bytes())
            digest.update(b"\0")
        return digest.hexdigest()

    def _connect(self) -> sqlite3.Connection:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.database_path, timeout=20)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    @staticmethod
    def _create_schema(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                tags_json TEXT NOT NULL,
                checksum TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                chunk_index INTEGER NOT NULL,
                heading TEXT NOT NULL,
                content TEXT NOT NULL,
                terms_json TEXT NOT NULL,
                vector BLOB NOT NULL
            );
            CREATE INDEX IF NOT EXISTS chunks_document_id ON chunks(document_id);
            CREATE INDEX IF NOT EXISTS documents_category ON documents(category);
            """
        )

    def rebuild(self) -> dict[str, Any]:
        files = self._files()
        if not files:
            raise FileNotFoundError(f"知识目录中没有 Markdown 或文本文件：{self.knowledge_dir}")
        documents = [_read_document(path, self.knowledge_dir) for path in files]
        corpus_hash = self._corpus_hash(files)
        indexed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        chunk_count = 0
        with self._connect() as connection:
            self._create_schema(connection)
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM chunks")
            connection.execute("DELETE FROM documents")
            for document in documents:
                document_id = hashlib.sha256(document.relative_path.encode("utf-8")).hexdigest()[:24]
                connection.execute(
                    "INSERT INTO documents(id, path, title, category, tags_json, checksum) VALUES (?, ?, ?, ?, ?, ?)",
                    (document_id, document.relative_path, document.title, document.category,
                     json.dumps(document.tags, ensure_ascii=False), document.checksum),
                )
                for index, chunk in enumerate(_chunk_document(document)):
                    searchable = " ".join((document.title, document.category, " ".join(document.tags), chunk["heading"], chunk["content"]))
                    terms = sorted(set(_tokens(searchable)))
                    connection.execute(
                        "INSERT INTO chunks(id, document_id, chunk_index, heading, content, terms_json, vector) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (f"{document_id}:{index}", document_id, index, chunk["heading"], chunk["content"],
                         json.dumps(terms, ensure_ascii=False), _pack_vector(_vector(searchable))),
                    )
                    chunk_count += 1
            metadata = {
                "corpus_hash": corpus_hash,
                "indexed_at": indexed_at,
                "vector_dimensions": str(VECTOR_DIMENSIONS),
                "schema_version": "1",
            }
            connection.executemany(
                "INSERT INTO metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                metadata.items(),
            )
        return {
            "documentCount": len(documents),
            "chunkCount": chunk_count,
            "indexedAt": indexed_at,
            "knowledgeDir": str(self.knowledge_dir.resolve()),
            "databasePath": str(self.database_path.resolve()),
            "corpusHash": corpus_hash,
        }

    def status(self) -> dict[str, Any]:
        current_hash = self._corpus_hash()
        if not self.database_path.is_file():
            return {
                "ready": False,
                "stale": True,
                "documentCount": 0,
                "chunkCount": 0,
                "indexedAt": None,
                "knowledgeDir": str(self.knowledge_dir.resolve()),
                "databasePath": str(self.database_path.resolve()),
            }
        try:
            with self._connect() as connection:
                self._create_schema(connection)
                metadata = {row["key"]: row["value"] for row in connection.execute("SELECT key, value FROM metadata")}
                document_count = connection.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
                chunk_count = connection.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        except sqlite3.DatabaseError:
            return {
                "ready": False, "stale": True, "documentCount": 0, "chunkCount": 0,
                "indexedAt": None, "knowledgeDir": str(self.knowledge_dir.resolve()),
                "databasePath": str(self.database_path.resolve()), "error": "知识库索引无法读取",
            }
        return {
            "ready": bool(document_count and chunk_count),
            "stale": metadata.get("corpus_hash") != current_hash,
            "documentCount": document_count,
            "chunkCount": chunk_count,
            "indexedAt": metadata.get("indexed_at"),
            "knowledgeDir": str(self.knowledge_dir.resolve()),
            "databasePath": str(self.database_path.resolve()),
        }

    def ensure_current(self) -> dict[str, Any]:
        status = self.status()
        return self.rebuild() if not status["ready"] or status["stale"] else status

    def search(self, query: str, top_k: int = DEFAULT_TOP_K, categories: Sequence[str] | None = None) -> list[dict[str, Any]]:
        normalized_query = query.strip()
        if not normalized_query:
            raise ValueError("检索问题不能为空")
        self.ensure_current()
        limit = max(1, min(int(top_k), 12))
        query_vector = _vector(normalized_query)
        query_terms = set(_tokens(normalized_query))
        filters = [category.strip() for category in categories or [] if category.strip()]
        sql = (
            "SELECT c.id, c.chunk_index, c.heading, c.content, c.terms_json, c.vector, "
            "d.path, d.title, d.category, d.tags_json FROM chunks c JOIN documents d ON d.id = c.document_id"
        )
        params: list[Any] = []
        if filters:
            placeholders = ",".join("?" for _ in filters)
            sql += f" WHERE d.category IN ({placeholders})"
            params.extend(filters)
        with self._connect() as connection:
            rows = connection.execute(sql, params).fetchall()
        scored: list[tuple[float, sqlite3.Row]] = []
        for row in rows:
            document_terms = set(json.loads(row["terms_json"]))
            coverage = len(query_terms & document_terms) / max(len(query_terms), 1)
            cosine = max(0.0, _dot(query_vector, _unpack_vector(row["vector"])))
            score = 0.72 * cosine + 0.28 * coverage
            scored.append((score, row))
        scored.sort(key=lambda item: (-item[0], item[1]["path"], item[1]["chunk_index"]))
        results = []
        for score, row in scored[:limit]:
            citation = f"[知识库：{row['title']} / {row['heading']}]"
            results.append({
                "id": row["id"],
                "title": row["title"],
                "heading": row["heading"],
                "category": row["category"],
                "tags": json.loads(row["tags_json"]),
                "sourcePath": row["path"],
                "content": row["content"],
                "score": round(score, 4),
                "citation": citation,
                "knowledgeType": "general_theory",
            })
        return results


def build_fund_knowledge_query(snapshot: dict[str, Any]) -> str:
    fund = snapshot.get("fund", {})
    market = snapshot.get("market", {})
    valuation = snapshot.get("valuation", {})
    holdings = snapshot.get("holdings", {}).get("current", [])
    concepts = [
        fund.get("name"), fund.get("category"), market.get("regime"),
        "公募基金 净值 收益 风险 波动率 最大回撤 相关性",
        "估值 PE PB 历史分位 因子 宏观传导 持仓披露",
    ]
    if valuation:
        concepts.append("行业估值 周期 风险溢价")
    concepts.extend(item.get("name") for item in holdings[:5] if isinstance(item, dict))
    return " ".join(str(item) for item in concepts if item)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="金融理论 RAG 知识库管理")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("build", help="重建知识库索引")
    subparsers.add_parser("status", help="查看索引状态")
    search_parser = subparsers.add_parser("search", help="检索知识库")
    search_parser.add_argument("query")
    search_parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    args = parser.parse_args(argv)
    knowledge_base = RagKnowledgeBase()
    if args.command == "build":
        payload: Any = knowledge_base.rebuild()
    elif args.command == "status":
        payload = knowledge_base.status()
    else:
        payload = {"query": args.query, "items": knowledge_base.search(args.query, args.top_k)}
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
