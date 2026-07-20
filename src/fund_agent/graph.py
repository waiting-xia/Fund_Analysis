"""LangGraph topology for the fund research agent."""

from __future__ import annotations

from typing import Literal

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from fund_agent.nodes import make_nodes
from fund_agent.providers import (
    AnalysisProvider,
    DataProvider,
    DeterministicAnalysisProvider,
    OpenAICompatibleAnalysisProvider,
    SampleDataProvider,
)
from fund_agent.rag import RagKnowledgeBase
from fund_agent.state import FundAgentState


def build_graph(
    data_provider: DataProvider | None = None,
    analysis_provider: AnalysisProvider | None = None,
    *,
    checkpointer=None,
    knowledge_base: RagKnowledgeBase | None = None,
):
    """Build and compile the fund analysis graph.

    Production callers should supply a durable SQLite/PostgreSQL checkpointer.
    The default InMemorySaver keeps local development self-contained.
    """
    default_analysis_provider: AnalysisProvider = (
        OpenAICompatibleAnalysisProvider()
        if OpenAICompatibleAnalysisProvider.is_configured()
        else DeterministicAnalysisProvider()
    )
    nodes = make_nodes(
        data_provider or SampleDataProvider(),
        analysis_provider or default_analysis_provider,
        knowledge_base or RagKnowledgeBase(),
    )
    builder = StateGraph(FundAgentState)
    for name, function in nodes.items():
        builder.add_node(name, function)

    def after_validation(state: FundAgentState) -> Literal["collect_data", "generate_report"]:
        return "generate_report" if state.get("errors") else "collect_data"

    def after_collection(state: FundAgentState) -> Literal["assess_data_quality", "generate_report"]:
        return "generate_report" if state.get("errors") else "assess_data_quality"

    builder.add_edge(START, "validate_request")
    builder.add_conditional_edges("validate_request", after_validation)
    builder.add_conditional_edges("collect_data", after_collection)

    analysis_nodes = [
        "analyze_market",
        "analyze_fund",
        "filter_news",
        "analyze_valuation",
        "analyze_risk",
        "analyze_flows",
    ]
    builder.add_edge("assess_data_quality", "retrieve_knowledge")
    for node in analysis_nodes:
        builder.add_edge("retrieve_knowledge", node)
    builder.add_edge(analysis_nodes, "score_factors")
    builder.add_edge("score_factors", "deep_analysis")
    builder.add_edge("deep_analysis", "generate_report")
    builder.add_edge("generate_report", END)

    return builder.compile(checkpointer=checkpointer or InMemorySaver())
