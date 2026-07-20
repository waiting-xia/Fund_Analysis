import fundService from "../server/fund-service.mjs";
import { closeMcpConnections } from "../server/mcp-client.mjs";

try {
  for (const code of ["510300", "000001", "161725", "000198", "513100"]) {
    const response = await fundService.fetch(new Request(`http://local.test/api/fund?code=${code}`), {});
    const payload = await response.json();
    if (!response.ok) throw new Error(`${code}: ${payload.error || `HTTP ${response.status}`}`);
    if (payload.code !== code || !payload.name || !Number.isFinite(payload.latest?.nav) || !payload.latest?.date) {
      throw new Error(`${code}: live fund response is incomplete`);
    }
    if (!payload.alipay || typeof payload.alipay.configured !== "boolean" || typeof payload.alipay.available !== "boolean") {
      throw new Error(`${code}: 蚂蚁财富渠道状态缺失`);
    }
    if (!Array.isArray(payload.comparisons)) throw new Error(`${code}: 收益对比序列缺失`);
    const portfolioResponse = await fundService.fetch(new Request(`http://local.test/api/fund/portfolio?code=${code}`), {});
    const portfolio = await portfolioResponse.json();
    if (!portfolioResponse.ok) throw new Error(`${code}: ${portfolio.error || `portfolio HTTP ${portfolioResponse.status}`}`);
    if (!Array.isArray(portfolio.holdings) || !Array.isArray(portfolio.industries)) throw new Error(`${code}: 持仓或行业配置结构缺失`);
    if (code === "000198" && (payload.valueKind !== "money" || !Number.isFinite(payload.latest.dayGrowth))) {
      throw new Error("000198: 货币基金收益口径解析失败");
    }
    if (["161725", "513100"].includes(code) && (!portfolio.holdings.length || !portfolio.holdings[0].weight?.includes("%"))) {
      throw new Error(`${code}: 公开持仓解析失败`);
    }
    console.log(JSON.stringify({
      code: payload.code,
      name: payload.name,
      valueKind: payload.valueKind,
      latestValue: payload.latest.nav,
      latestDate: payload.latest.date,
      historyPoints: payload.history.length,
      comparisonSeries: payload.comparisons.map((item) => item.name),
      holdings: portfolio.holdings.length,
      industries: portfolio.industries.slice(0, 3),
      firstHolding: portfolio.holdings[0] || null,
      retrievedAt: payload.retrievedAt,
    }));
  }

  const codes = "510300,161725,005827,110011";
  for (const path of [
    `/api/funds/watchlist?codes=${codes}`,
    `/api/funds/risk?codes=${codes}`,
    "/api/market/dashboard",
    "/api/fund/valuation?code=161725",
    `/api/reports?codes=${codes}`,
  ]) {
    const response = await fundService.fetch(new Request(`http://local.test${path}`), {});
    const payload = await response.json();
    if (!response.ok) throw new Error(`${path}: ${payload.error || `HTTP ${response.status}`}`);
    console.log(JSON.stringify({ path, ok: true, keys: Object.keys(payload), sample: path.includes("valuation") ? payload.industries?.[0] || null : null }));
  }
} finally {
  await closeMcpConnections();
}
