import unittest

from fund_agent.graph import build_graph


def invoke(graph, fund_code="510300", report_type="evening"):
    return graph.invoke(
        {
            "request": {
                "fund_code": fund_code,
                "report_type": report_type,
                "as_of": None,
            },
            "status": "pending",
        },
        config={"configurable": {"thread_id": f"test-{fund_code}-{report_type}"}},
    )


class GraphTests(unittest.TestCase):
    def test_graph_generates_complete_report(self):
        result = invoke(build_graph())
        self.assertEqual(result["status"], "completed")
        self.assertGreater(result["factor_signal"]["total_score"], 0)
        self.assertTrue(result["flow_analysis"]["changes"])
        self.assertTrue(result["knowledge_context"])
        self.assertIn("资金与持仓变动分析", result["report"])
        self.assertIn("理论依据", result["report"])
        self.assertIn("正式净值尚未披露", result["report"])

    def test_graph_rejects_invalid_fund_code(self):
        result = invoke(build_graph(), fund_code="ABC")
        self.assertEqual(result["status"], "failed")
        self.assertIn("6 位数字", result["report"])


if __name__ == "__main__":
    unittest.main()
