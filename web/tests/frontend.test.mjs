import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import fundService from "../server/fund-service.mjs";

test("builds the React npm frontend", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const files = await readdir(new URL("../dist/assets/", import.meta.url));
  const javascript = files.find((file) => file.endsWith(".js"));
  const stylesheet = files.find((file) => file.endsWith(".css"));
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="module" crossorigin src="\/assets\//);
  assert.ok(javascript, "Vite should emit a JavaScript bundle");
  assert.ok(stylesheet, "Vite should emit a stylesheet");
  const css = await readFile(new URL(`../dist/assets/${stylesheet}`, import.meta.url), "utf8");
  assert.match(css, /\.performanceSvg\{[^}]*width:100%;[^}]*height:100%/);
  const bundle = await readFile(new URL(`../dist/assets/${javascript}`, import.meta.url), "utf8");
  assert.match(bundle, /观澜/);
  assert.match(bundle, /OpenAI-compatible/);
  assert.match(bundle, /AI 研究综合判断/);
  assert.match(bundle, /证据约束输出/);
  assert.match(bundle, /事实证据/);
  assert.match(bundle, /当前操作建议/);
  assert.match(bundle, /买入 \/ 持有 \/ 减仓 \/ 卖出/);
  assert.match(bundle, /分析服务仍在运行旧版本/);
  assert.match(bundle, /区间累计收益/);
  assert.match(bundle, /区间起点归一为 0%/);
  assert.match(bundle, /区间收益按所选起始日重新计算/);
  assert.doesNotMatch(bundle, /收益走势对比/);
  assert.match(bundle, /资金与持仓变动/);
  assert.match(bundle, /市场数据监控/);
  assert.match(bundle, /投资信号引擎/);
  assert.doesNotMatch(bundle, /自动日报/);
  assert.match(bundle, /智能分析/);
  assert.match(bundle, /本地金融理论 RAG/);
  assert.doesNotMatch(bundle, /数据已连接/);
  assert.match(bundle, /更改持仓基金/);
  assert.doesNotMatch(bundle, /Claude 分析/);
  assert.doesNotMatch(bundle, /非盘中时段/);
  assert.doesNotMatch(bundle, /每 60 秒检查/);
  assert.match(bundle, /股票价格与日涨跌来自实时行情/);
});

test("restarts the Node API when server code changes in development", async () => {
  const script = await readFile(new URL("../scripts/dev.mjs", import.meta.url), "utf8");
  assert.match(script, /--watch/);
  assert.match(script, /server\/index\.mjs/);
});

test("rejects malformed fund codes", async () => {
  const response = await fundService.fetch(new Request("http://localhost/api/fund?code=123"));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /六位数字基金代码/);
});

test("keeps model credentials on the Node server", async () => {
  const response = await fundService.fetch(new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ code: "510300" }),
  }), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OPENAI_API_KEY/);
});

test("accepts the Vite development proxy origin", async () => {
  const response = await fundService.fetch(new Request("http://127.0.0.1:8787/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:5173" },
    body: JSON.stringify({ code: "510300" }),
  }), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OPENAI_API_KEY/);
});

test("accepts a configured public frontend origin", async () => {
  const response = await fundService.fetch(new Request("http://127.0.0.1:8787/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://fund.example.com" },
    body: JSON.stringify({ code: "510300" }),
  }), { WEB_TRUSTED_ORIGINS: "https://fund.example.com" });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OPENAI_API_KEY/);
});

test("rejects an untrusted AI request origin", async () => {
  const response = await fundService.fetch(new Request("http://127.0.0.1:8787/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    body: JSON.stringify({ code: "510300" }),
  }), {});
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /请求来源不受信任/);
});
