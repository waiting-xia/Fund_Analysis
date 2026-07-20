"""Project-root environment loader shared by the LangGraph CLI."""

from __future__ import annotations

import os
from pathlib import Path


PROJECT_ENV = Path(__file__).resolve().parents[2] / ".env"


def load_project_env() -> Path:
    if not PROJECT_ENV.is_file():
        return PROJECT_ENV
    for raw_line in PROJECT_ENV.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)
    return PROJECT_ENV
