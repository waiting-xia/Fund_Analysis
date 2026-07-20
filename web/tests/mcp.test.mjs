import assert from "node:assert/strict";
import test from "node:test";
import { callMcpTool, closeMcpConnections, getMcpStatus, parseMcpResult } from "../server/mcp-client.mjs";

test("parses MCP structured and text results", () => {
  assert.deepEqual(parseMcpResult({ structuredContent: { ok: true } }), { ok: true });
  assert.deepEqual(parseMcpResult({ content: [{ type: "text", text: "{\"ok\":true}" }] }), { ok: true });
  assert.throws(() => parseMcpResult({ isError: true, content: [{ type: "text", text: "{\"error\":\"failed\"}" }] }), /failed/);
});

test("connects Eastmoney and local RAG while skipping unconfigured optional providers", async () => {
  try {
    const status = await getMcpStatus();
    const eastmoney = status.providers.find((item) => item.provider === "eastmoney");
    const ifind = status.providers.find((item) => item.provider === "ifind");
    const alipay = status.providers.find((item) => item.provider === "alipay");
    const rag = status.providers.find((item) => item.provider === "rag");
    assert.equal(eastmoney?.connected, true);
    assert.ok(eastmoney?.tools.includes("get_stocks"));
    assert.ok(eastmoney?.tools.includes("get_holdings_valuation"));
    assert.ok(eastmoney?.tools.includes("get_global_indices"));
    assert.ok(eastmoney?.tools.includes("get_a_share_quotes"));
    assert.equal(ifind?.connected, false);
    assert.equal(ifind?.configured, false);
    assert.deepEqual(ifind?.tools, []);
    assert.equal(alipay?.connected, false);
    assert.equal(alipay?.configured, false);
    assert.deepEqual(alipay?.tools, []);
    assert.equal(rag?.connected, true);
    assert.ok(rag?.tools.includes("search_knowledge"));
    assert.ok(rag?.tools.includes("rebuild_knowledge_base"));
    assert.ok(rag?.tools.includes("get_knowledge_base_status"));
    const knowledge = await callMcpTool("rag", "search_knowledge", { query: "最大回撤和波动率如何用于基金风险分析", top_k: 2 });
    assert.equal(knowledge?.items?.length, 2);
    assert.match(knowledge.items[0].citation, /^\[知识库：/);
    assert.equal(knowledge.items[0].knowledgeType, "general_theory");
  } finally {
    await closeMcpConnections();
  }
});
