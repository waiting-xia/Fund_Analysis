"""Financial-theory RAG MCP server (Python stdio)."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Any

from mcp.server.fastmcp import FastMCP

from env_loader import load_project_env


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

load_project_env()

from fund_agent.rag import RagKnowledgeBase  # noqa: E402


SERVER = FastMCP("guanlan-financial-theory-rag", log_level="ERROR")
KNOWLEDGE_BASE = RagKnowledgeBase()


@SERVER.tool()
def search_knowledge(query: str, top_k: int = 5, categories: list[str] | None = None) -> dict[str, Any]:
    """Search general financial and economic theory relevant to a fund question."""
    items = KNOWLEDGE_BASE.search(query, top_k=top_k, categories=categories)
    return {
        "query": query,
        "items": items,
        "count": len(items),
        "status": KNOWLEDGE_BASE.status(),
        "provider": "本地金融理论 RAG",
        "notice": "检索结果是通用理论框架，不是当前基金事实或投资建议。",
    }


@SERVER.tool()
def rebuild_knowledge_base() -> dict[str, Any]:
    """Rebuild the SQLite index after adding or editing knowledge documents."""
    return KNOWLEDGE_BASE.rebuild()


@SERVER.tool()
def get_knowledge_base_status() -> dict[str, Any]:
    """Return index freshness and document/chunk counts without exposing secrets."""
    return KNOWLEDGE_BASE.status()


if __name__ == "__main__":
    SERVER.run(transport="stdio")

