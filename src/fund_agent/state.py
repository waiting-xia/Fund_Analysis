"""JSON-serializable state shared by all LangGraph nodes."""

from __future__ import annotations

from typing import Any, Literal, TypedDict


ReportType = Literal["morning", "evening", "on_demand"]


class AgentRequest(TypedDict):
    fund_code: str
    report_type: ReportType
    as_of: str | None


class FundAgentState(TypedDict, total=False):
    request: AgentRequest
    raw_snapshot: dict[str, Any]
    data_quality: dict[str, Any]
    knowledge_context: list[dict[str, Any]]
    market_analysis: dict[str, Any]
    fund_analysis: dict[str, Any]
    news_analysis: dict[str, Any]
    valuation_analysis: dict[str, Any]
    risk_analysis: dict[str, Any]
    factor_signal: dict[str, Any]
    flow_analysis: dict[str, Any]
    deep_analysis: dict[str, Any]
    report: str
    errors: list[str]
    warnings: list[str]
    status: Literal["pending", "running", "completed", "failed"]
