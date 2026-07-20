import "../server/load-env.mjs";
import { callMcpTool, closeMcpConnections } from "../server/mcp-client.mjs";

try {
  const holdingsResult = await callMcpTool("eastmoney", "get_holdings_valuation", { holdings: [
    { code: "600519", name: "贵州茅台", weight: "9.25%" },
    { code: "000858", name: "五粮液", weight: "7.10%" },
    { code: "300750", name: "宁德时代", weight: "5.50%" },
  ] });
  const holdings = holdingsResult?.response;
  if (!holdings?.available || !Number.isFinite(holdings.pe) || !Number.isFinite(holdings.pb)) throw new Error("持仓穿透估值不可用");
  if (holdings.coverage <= 0 || holdings.coverage > holdings.disclosedWeight) throw new Error("估值覆盖率无效");

  const industryResult = await callMcpTool("eastmoney", "get_industry_valuations", { names: ["酿酒行业", "沪深300"] });
  const industries = industryResult?.response?.industries;
  console.log(JSON.stringify({ holdings, industries }, null, 2));
  if (!Array.isArray(industries) || industries.length < 1) throw new Error("行业与指数估值映射不完整");
  if (industries.some((item) => item.pe != null && (!Number.isFinite(item.pe) || item.pe <= 0))) throw new Error("PE 字段无效");
  if (industries.some((item) => item.pricePosition1y != null && (item.pricePosition1y < 0 || item.pricePosition1y > 100))) throw new Error("近一年位置字段无效");
} finally {
  await closeMcpConnections();
}
