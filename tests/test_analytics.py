import unittest

from fund_agent.analytics import calculate_risk, compare_holdings, maximum_drawdown


class AnalyticsTests(unittest.TestCase):
    def test_maximum_drawdown_uses_peak_to_trough(self):
        self.assertAlmostEqual(maximum_drawdown([100, 110, 99, 120]), -0.1)

    def test_calculate_risk_returns_expected_fields(self):
        result = calculate_risk([1.0, 1.01, 0.99, 1.03], [1.0, 1.005, 0.995, 1.02])
        self.assertGreater(result["annualized_volatility"], 0)
        self.assertLess(result["max_drawdown"], 0)
        self.assertTrue(-1 <= result["benchmark_correlation"] <= 1)

    def test_compare_holdings_labels_disclosed_changes(self):
        previous = [
            {"code": "A", "name": "甲", "weight": 2.0},
            {"code": "B", "name": "乙", "weight": 1.0},
        ]
        current = [
            {"code": "A", "name": "甲", "weight": 2.5},
            {"code": "C", "name": "丙", "weight": 1.2},
        ]
        result = compare_holdings(previous, current)
        labels = {(item["code"], item["change_type"]) for item in result}
        self.assertEqual(labels, {("A", "增持"), ("B", "退出"), ("C", "新增")})
        self.assertTrue(all(item["evidence_level"] == "已披露" for item in result))


if __name__ == "__main__":
    unittest.main()
