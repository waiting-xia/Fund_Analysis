import "../server/load-env.mjs";
import { closeMcpConnections, getMcpStatus } from "../server/mcp-client.mjs";

try {
  const status = await getMcpStatus();
  const eastmoney = status.providers.find((item) => item.provider === "eastmoney");
  const ifind = status.providers.find((item) => item.provider === "ifind");
  const alipay = status.providers.find((item) => item.provider === "alipay");
  if (!eastmoney?.connected || !eastmoney.tools.includes("get_stock") || !eastmoney.tools.includes("search_funds")) throw new Error("东方财富 MCP 未正确连接");
  if (!ifind?.connected || !ifind.tools.includes("ifind_realtime_quote")) throw new Error("同花顺 iFinD MCP 未正确连接");
  if (!alipay?.connected || !alipay.tools.includes("get_alipay_fund_info")) throw new Error("蚂蚁财富基金 MCP 未正确连接");
  console.log(JSON.stringify(status, null, 2));
} finally {
  await closeMcpConnections();
}
