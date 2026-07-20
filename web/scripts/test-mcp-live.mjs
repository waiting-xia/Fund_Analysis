import "../server/load-env.mjs";
import { callMcpTool, closeMcpConnections } from "../server/mcp-client.mjs";

try {
  const result = await callMcpTool("eastmoney", "get_stocks", {
    codes: ["SH000001", "SZ399001", "SZ399006", "SH000300", "SH000688"],
    source: "eastmoney",
  });
  const quotes = result?.response?.stocks;
  if (!Array.isArray(quotes) || quotes.length === 0) throw new Error("东方财富 MCP 未返回行情");
  if (quotes.length !== 5 || quotes.some((quote) => !/^(SH|SZ)\d{6}$/.test(quote.code) || !quote.name || !Number.isFinite(quote.now) || quote.now <= 0 || !Number.isFinite(quote.open) || !Number.isFinite(quote.amount))) {
    throw new Error("东方财富 MCP 返回了无效行情字段");
  }
  console.log(JSON.stringify({ provider: "东方财富 MCP", quotes, retrievedAt: new Date().toISOString() }, null, 2));

  const fundResult = await callMcpTool("eastmoney", "get_fund_info", { code: "510300" });
  const fund = fundResult?.response?.fund;
  if (!fund || fund.code !== "510300" || !Number.isFinite(fund.officialNav) || fund.officialNav <= 0 || !fund.officialNavDate) {
    throw new Error("东方财富 MCP 未返回有效的基金正式净值");
  }
  console.log(JSON.stringify({ provider: "东方财富基金 MCP", fund }, null, 2));

  const searchResult = await callMcpTool("eastmoney", "search_funds", { query: "新能源", limit: 20 });
  const funds = searchResult?.response?.funds;
  if (!Array.isArray(funds) || funds.length < 15 || searchResult?.response?.catalogSize < 10_000 || funds.some((item) => !/^\d{6}$/.test(item.code) || !item.name || !item.type)) {
    throw new Error("东方财富 MCP 未返回有效的基金搜索结果");
  }
  console.log(JSON.stringify({ provider: "东方财富全量基金搜索 MCP", query: "新能源", catalogSize: searchResult.response.catalogSize, funds }, null, 2));

  const batchResult = await callMcpTool("eastmoney", "get_fund_batch_info", { codes: ["510300", "161725", "005827", "110011"] });
  const batchFunds = batchResult?.response?.funds;
  if (!Array.isArray(batchFunds) || batchFunds.length !== 4 || batchFunds.some((item) => !item.name || !Number.isFinite(item.nav))) {
    throw new Error("东方财富 MCP 未返回有效的四基金批量净值");
  }
  console.log(JSON.stringify({ provider: "东方财富批量净值 MCP", funds: batchFunds }, null, 2));

  const [marketFlow, northbound, sectors, position, valuation] = await Promise.all([
    callMcpTool("eastmoney", "get_market_capital_flow", {}),
    callMcpTool("eastmoney", "get_northbound_capital", {}),
    callMcpTool("eastmoney", "get_sector_capital_flow", { limit: 6 }),
    callMcpTool("eastmoney", "get_fund_position", { code: "161725" }),
    callMcpTool("eastmoney", "get_industry_valuations", { names: ["酿酒行业", "沪深300"] }),
  ]);
  if (!marketFlow?.response || !northbound?.response || !Array.isArray(sectors?.response?.sectors) || !Array.isArray(position?.response?.stocks) || !Array.isArray(valuation?.response?.industries)) {
    throw new Error("东方财富市场、持仓变化或估值 MCP 返回结构无效");
  }
  console.log(JSON.stringify({
    provider: "东方财富研究数据 MCP",
    capitalFlow: marketFlow.response.latest,
    northbound: northbound.response,
    sectors: sectors.response.sectors,
    position: position.response.stocks.slice(0, 3),
    valuation: valuation.response.industries,
  }, null, 2));

  if (process.env.IFIND_ACCESS_TOKEN?.trim() || process.env.IFIND_REFRESH_TOKEN?.trim()) {
    const ifind = await callMcpTool("ifind", "ifind_realtime_quote", { codes: "000001.SH", indicators: "latest" });
    console.log(JSON.stringify(ifind, null, 2));
  } else {
    console.log("同花顺 iFinD：未配置令牌，跳过实时请求。MCP 握手已由 mcp:check 验证。");
  }
} finally {
  await closeMcpConnections();
}
