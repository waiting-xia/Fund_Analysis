"""CLI wrapper that makes the project package importable without installation."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from fund_agent.rag import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())

