import tempfile
import unittest
from pathlib import Path

from fund_agent.rag import RagKnowledgeBase


class RagKnowledgeBaseTests(unittest.TestCase):
    def test_builds_and_retrieves_relevant_financial_theory(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            knowledge = root / "knowledge"
            knowledge.mkdir()
            (knowledge / "risk.md").write_text(
                "---\ntitle: 回撤风险\ncategory: 风险管理\ntags: 最大回撤,波动率\n---\n"
                "# 最大回撤\n最大回撤描述净值从历史高点到后续低点的跌幅，还应观察修复时间。",
                encoding="utf-8",
            )
            (knowledge / "valuation.md").write_text(
                "---\ntitle: 估值框架\ncategory: 估值分析\ntags: PE,PB\n---\n"
                "# 市盈率\n周期行业盈利高点的低 PE 不一定代表低估。",
                encoding="utf-8",
            )
            database = root / "index.sqlite3"
            store = RagKnowledgeBase(knowledge, database)

            result = store.rebuild()
            items = store.search("基金最大回撤和修复时间", top_k=1)

            self.assertEqual(result["documentCount"], 2)
            self.assertGreaterEqual(result["chunkCount"], 2)
            self.assertEqual(items[0]["title"], "回撤风险")
            self.assertIn("[知识库：回撤风险 / 最大回撤]", items[0]["citation"])
            self.assertEqual(items[0]["knowledgeType"], "general_theory")

    def test_detects_document_changes_and_rebuilds_on_search(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            knowledge = root / "knowledge"
            knowledge.mkdir()
            document = knowledge / "macro.md"
            document.write_text("# 利率\n利率影响资产折现率。", encoding="utf-8")
            store = RagKnowledgeBase(knowledge, root / "index.sqlite3")
            store.rebuild()
            document.write_text("# 利率\n实际利率上升会提高远期现金流折现率。", encoding="utf-8")

            self.assertTrue(store.status()["stale"])
            items = store.search("实际利率 远期现金流", top_k=1)

            self.assertIn("实际利率", items[0]["content"])
            self.assertFalse(store.status()["stale"])


if __name__ == "__main__":
    unittest.main()
