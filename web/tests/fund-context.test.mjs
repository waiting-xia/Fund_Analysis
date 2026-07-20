import assert from "node:assert/strict";
import test from "node:test";
import { getMarketSession, parseActionRecommendation, parseIndustryAllocation, parsePerformanceSeries } from "../server/fund-service.mjs";

test("parses Eastmoney comparison series", () => {
  const script = `var Data_grandTotal = [
    {"name":"示例基金","data":[[1704067200000,0],[1704153600000,1.25]]},
    {"name":"同类平均","data":[[1704067200000,0],[1704153600000,0.8]]},
    {"name":"沪深300","data":[[1704067200000,0],[1704153600000,-0.3]]}
  ];`;
  const result = parsePerformanceSeries(script, "示例基金");
  assert.equal(result.length, 3);
  assert.equal(result[0].role, "fund");
  assert.equal(result[1].role, "peer");
  assert.equal(result[2].role, "benchmark");
  assert.equal(result[0].points[1].value, 1.25);
});

test("parses the latest disclosed industry allocation", () => {
  const payload = `jQuery({"Data":{"QuarterInfos":[{"HYPZInfo":[
    {"FSRQ":"2026-03-31","HYMC":"制造业","ZJZBL":"35.20","SZ":"12345"},
    {"FSRQ":"2026-03-31","HYMC":"金融业","ZJZBL":"18.60","SZ":"6543"},
    {"FSRQ":"2025-12-31","HYMC":"旧行业","ZJZBL":"99","SZ":"1"}
  ]}]}});`;
  const result = parseIndustryAllocation(payload);
  assert.equal(result.period, "2026-03-31");
  assert.deepEqual(result.industries.map((item) => item.name), ["制造业", "金融业"]);
  assert.equal(result.industries[0].weight, 35.2);
});

test("requires one explicit model action and confidence", () => {
  assert.deepEqual(parseActionRecommendation("操作建议：减仓\n建议置信度：中\n主要风险：波动上升", true), {
    action: "减仓",
    confidence: "中",
    perspective: "持仓视角",
  });
  assert.deepEqual(parseActionRecommendation("操作建议：买入\n建议置信度：高", false), {
    action: "买入",
    confidence: "高",
    perspective: "未持仓视角",
  });
  assert.equal(parseActionRecommendation("建议保持谨慎并继续观察", true), null);
});

test("switches between A-share and US regular trading sessions", () => {
  const chinaOpen = getMarketSession(new Date("2026-07-15T02:00:00Z"));
  assert.equal(chinaOpen.region, "cn");
  assert.equal(chinaOpen.phase, "open");

  const chinaLunch = getMarketSession(new Date("2026-07-15T04:00:00Z"));
  assert.equal(chinaLunch.region, "cn");
  assert.equal(chinaLunch.phase, "break");

  const usSummerOpen = getMarketSession(new Date("2026-07-15T14:00:00Z"));
  assert.equal(usSummerOpen.region, "us");
  assert.equal(usSummerOpen.phase, "open");
  assert.match(usSummerOpen.newYorkTime, /10:00$/);

  const usWinterOpen = getMarketSession(new Date("2026-01-15T15:00:00Z"));
  assert.equal(usWinterOpen.region, "us");
  assert.equal(usWinterOpen.phase, "open");
  assert.match(usWinterOpen.newYorkTime, /10:00$/);
});
