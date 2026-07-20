import { useEffect, useState } from "react";
import { fetchSecurityQuotes } from "../api";
import type { HoldingChange, SecurityQuote } from "../types";
import { Icon } from "./Icon";

function changeLabel(item: HoldingChange) {
  const type = item.changeType || "未知";
  const value = item.changeRatio;
  return value == null ? type : `${type} ${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function quotePercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "行情暂无";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function HoldingChanges({ items, period, loading }: { items: HoldingChange[]; period: string | null; loading: boolean }) {
  const [quoteByCode, setQuoteByCode] = useState<Record<string, SecurityQuote>>({});
  const quoteKey = items.slice(0, 6).map((item) => item.code).filter((code) => /^[03468]\d{5}$/.test(code)).join(",");

  useEffect(() => {
    if (!quoteKey) return;
    let active = true;
    let controller = new AbortController();
    const load = async () => {
      controller.abort();
      controller = new AbortController();
      try {
        const result = await fetchSecurityQuotes(quoteKey.split(","), controller.signal);
        if (active) setQuoteByCode(Object.fromEntries(result.quotes.map((quote) => [quote.code, quote])));
      } catch (reason) {
        if (!active || (reason instanceof DOMException && reason.name === "AbortError")) return;
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(timer); controller.abort(); };
  }, [quoteKey]);

  return <article className="moduleCard holdingChanges" id="holdings">
    <header className="cardHeader"><div><span className="cardIcon mint"><Icon name="swap"/></span><span><small>DISCLOSED CHANGES</small><h2>资金与持仓变动</h2></span></div><em>{period || "最近报告期"}</em></header>
    {loading ? <div className="cardLoading"><i/>读取公开持仓变化…</div> : items.length ? <div className="changeList">{items.slice(0, 6).map((item) => {
      const lower = item.changeType.toLowerCase();
      const positive = lower.includes("增") || lower.includes("新") || (item.changeRatio || 0) > 0;
      const negative = lower.includes("减") || lower.includes("退出") || (item.changeRatio || 0) < 0;
      const quote = quoteByCode[item.code];
      const quoteTone = (quote?.changePercent || 0) > 0 ? "up" : (quote?.changePercent || 0) < 0 ? "down" : "";
      return <div key={`${item.code}-${item.name}`}><span className={`changeMark ${positive ? "positive" : negative ? "negative" : ""}`}><Icon name={positive ? "plus" : negative ? "minus" : "minus"}/></span><span><b>{item.name}</b><small>{item.code} · 权重 {item.weight == null ? "--" : `${item.weight.toFixed(2)}%`}</small></span><span className="holdingQuote" title="股票当前价格与当日涨跌"><b>{quote ? `¥${quote.price.toFixed(2)}` : "--"}</b><small className={quoteTone}>{quotePercent(quote?.changePercent)}</small></span><strong className={positive ? "up" : negative ? "down" : ""}>{changeLabel(item)}</strong></div>;
    })}</div> : <div className="emptyModule"><Icon name="swap"/><b>暂无股票持仓变动</b><span>债券、货币或部分跨境基金可能不披露该项</span></div>}
    <p className="moduleNote"><Icon name="info"/>增减持按相邻公开报告期比较；股票价格与日涨跌来自实时行情，不代表基金经理正在实时调仓。</p>
  </article>;
}
