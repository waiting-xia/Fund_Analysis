"""Command-line entry point for local graph execution."""

from __future__ import annotations

import argparse
import uuid

from fund_agent.graph import build_graph


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="运行基金研究智能体")
    parser.add_argument("fund_code", nargs="?", default="510300", help="6 位基金代码")
    parser.add_argument(
        "--report-type",
        choices=["morning", "evening", "on_demand"],
        default="on_demand",
    )
    parser.add_argument("--as-of", default=None, help="数据截止日期 YYYY-MM-DD")
    parser.add_argument("--thread-id", default=None, help="LangGraph checkpoint thread id")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    graph = build_graph()
    thread_id = args.thread_id or str(uuid.uuid4())
    result = graph.invoke(
        {
            "request": {
                "fund_code": args.fund_code,
                "report_type": args.report_type,
                "as_of": args.as_of,
            },
            "status": "pending",
        },
        config={"configurable": {"thread_id": thread_id}},
    )
    print(result["report"])


if __name__ == "__main__":
    main()

