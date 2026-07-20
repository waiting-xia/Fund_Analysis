"""Deterministic financial calculations used by graph nodes."""

from __future__ import annotations

import math
import statistics
from collections.abc import Iterable


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def returns(values: Iterable[float]) -> list[float]:
    series = list(values)
    return [series[i] / series[i - 1] - 1 for i in range(1, len(series)) if series[i - 1] != 0]


def annualized_return(values: list[float], periods_per_year: int = 252) -> float:
    if len(values) < 2 or values[0] <= 0:
        return 0.0
    periods = len(values) - 1
    return (values[-1] / values[0]) ** (periods_per_year / periods) - 1


def annualized_volatility(period_returns: list[float], periods_per_year: int = 252) -> float:
    if len(period_returns) < 2:
        return 0.0
    return statistics.stdev(period_returns) * math.sqrt(periods_per_year)


def maximum_drawdown(values: list[float]) -> float:
    if not values:
        return 0.0
    peak = values[0]
    worst = 0.0
    for value in values:
        peak = max(peak, value)
        worst = min(worst, value / peak - 1)
    return worst


def downside_volatility(period_returns: list[float], periods_per_year: int = 252) -> float:
    downside = [min(item, 0.0) for item in period_returns]
    if len(downside) < 2:
        return 0.0
    return math.sqrt(sum(item * item for item in downside) / len(downside)) * math.sqrt(periods_per_year)


def correlation(left: list[float], right: list[float]) -> float | None:
    size = min(len(left), len(right))
    if size < 2:
        return None
    x, y = left[-size:], right[-size:]
    mean_x, mean_y = statistics.mean(x), statistics.mean(y)
    numerator = sum((a - mean_x) * (b - mean_y) for a, b in zip(x, y, strict=True))
    denominator = math.sqrt(
        sum((a - mean_x) ** 2 for a in x) * sum((b - mean_y) ** 2 for b in y)
    )
    return numerator / denominator if denominator else None


def calculate_risk(nav_values: list[float], benchmark_values: list[float], risk_free_rate: float = 0.02) -> dict[str, float | None]:
    fund_returns = returns(nav_values)
    benchmark_returns = returns(benchmark_values)
    ann_return = annualized_return(nav_values)
    ann_vol = annualized_volatility(fund_returns)
    drawdown = maximum_drawdown(nav_values)
    down_vol = downside_volatility(fund_returns)
    return {
        "annualized_return": ann_return,
        "annualized_volatility": ann_vol,
        "downside_volatility": down_vol,
        "max_drawdown": drawdown,
        "sharpe": (ann_return - risk_free_rate) / ann_vol if ann_vol else None,
        "sortino": (ann_return - risk_free_rate) / down_vol if down_vol else None,
        "calmar": ann_return / abs(drawdown) if drawdown else None,
        "benchmark_correlation": correlation(fund_returns, benchmark_returns),
    }


def compare_holdings(previous: list[dict], current: list[dict], threshold_pp: float = 0.25) -> list[dict]:
    before = {item["code"]: item for item in previous}
    after = {item["code"]: item for item in current}
    changes: list[dict] = []
    for code in sorted(before.keys() | after.keys()):
        old = before.get(code)
        new = after.get(code)
        old_weight = float(old["weight"]) if old else 0.0
        new_weight = float(new["weight"]) if new else 0.0
        delta = new_weight - old_weight
        if not old:
            kind = "新增"
        elif not new:
            kind = "退出"
        elif delta >= threshold_pp:
            kind = "增持"
        elif delta <= -threshold_pp:
            kind = "减持"
        else:
            continue
        changes.append({
            "code": code,
            "name": (new or old)["name"],
            "change_type": kind,
            "previous_weight": old_weight,
            "current_weight": new_weight,
            "weight_change_pp": round(delta, 4),
            "evidence_level": "已披露",
        })
    return sorted(changes, key=lambda item: abs(item["weight_change_pp"]), reverse=True)

