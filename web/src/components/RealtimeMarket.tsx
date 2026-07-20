import { useEffect, useState } from "react";
import { fetchRealtimeMarket } from "../api";
import type { RealtimeMarketResponse } from "../types";
import { Icon } from "./Icon";

function displayPercent(value: number) {
  const percent = value * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

function displayTime(value?: string) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function displayAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "暂无";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)} 万亿`;
  return `${(value / 1e8).toFixed(0)} 亿`;
}

function displayVolume(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "暂无";
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)} 亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(1)} 万`;
  return value.toFixed(0);
}

function displayFlow(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "暂无";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} 亿`;
}

export function RealtimeMarket() {
  const [market, setMarket] = useState<RealtimeMarketResponse | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let controller = new AbortController();
    const load = async () => {
      controller.abort();
      controller = new AbortController();
      try {
        const result = await fetchRealtimeMarket(controller.signal);
        if (!active) return;
        setMarket(result);
        setError("");
      } catch (reason) {
        if (!active || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setError(reason instanceof Error ? reason.message : "市场数据暂不可用");
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(timer); controller.abort(); };
  }, []);

  const mainFlow = market?.capitalFlow.latest?.mainNet;
  const northbound = market?.northbound.northbound;
  const northboundTotal = northbound?.total ?? ((northbound?.routeOneNet ?? 0) + (northbound?.routeTwoNet ?? 0));
  const leadingSector = market?.sectors[0];
  const isUs = market?.session.region === "us";
  const leadingIndex = market?.quotes.reduce((best, quote) => !best || quote.percent > best.percent ? quote : best, market.quotes[0]);
  const averageChange = market?.quotes.length ? market.quotes.reduce((sum, quote) => sum + quote.percent, 0) / market.quotes.length : 0;

  return <section className="marketPanel" id="market" aria-label="市场数据监控">
    <header className="sectionHeading marketHeading">
      <div className="sectionTitle"><span className={`sectionIcon ${isUs ? "violet" : "mint"}`}><Icon name={isUs ? "globe" : "pulse"}/></span><div><span className="eyebrow">{isUs ? "WALL STREET LIVE" : "MARKET PULSE"}</span><h2>{market?.session.name || "市场数据监控"}</h2></div></div>
      <div className="liveMeta"><span className={market?.session.isOpen ? "" : "sessionClosed"}><i/>{market?.session.phaseLabel || "行情连接中"}</span><time>{displayTime(market?.retrievedAt)}</time><button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : "展开"}<Icon name="chevronDown"/></button></div>
    </header>

    {error && !market ? <div className="inlineError"><Icon name="alert"/><span>{error}</span></div> : market ? <>
      <div className={`marketIndexGrid ${isUs ? "usIndices" : ""}`}>
        {market.quotes.map((quote, index) => <article className={index === 0 ? "leadIndex" : ""} key={quote.code}>
          <div><b>{quote.name}</b><code>{quote.code.replace(/^(SH|SZ|US)/, "")}</code></div>
          <strong>{quote.now.toFixed(2)}</strong>
          <span className={quote.percent > 0 ? "up" : quote.percent < 0 ? "down" : ""}><Icon name={quote.percent < 0 ? "trendDown" : "trendUp"}/>{displayPercent(quote.percent)}</span>
          <small>{isUs ? `成交量 ${displayVolume(quote.volume)}` : `成交额 ${displayAmount(quote.amount)}`}</small>
        </article>)}
      </div>
      <div className="marketMetrics">
        {isUs ? <>
          <article><span className="metricGlyph violet"><Icon name="clock"/></span><div><small>当前交易阶段</small><b>{market.session.phaseLabel}</b></div></article>
          <article><span className="metricGlyph blue"><Icon name="activity"/></span><div><small>三大指数平均涨跌</small><b className={averageChange >= 0 ? "up" : "down"}>{displayPercent(averageChange)}</b></div></article>
          <article><span className="metricGlyph amber"><Icon name="trendUp"/></span><div><small>当前领先指数</small><b>{leadingIndex?.name || "暂无"}</b></div></article>
          <article><span className="metricGlyph mint"><Icon name="globe"/></span><div><small>纽约当地时间</small><b>{market.session.newYorkTime.slice(-5)}</b></div></article>
        </> : <>
          <article><span className="metricGlyph blue"><Icon name="activity"/></span><div><small>沪深成交额</small><b>{displayAmount(market.totalAmount)}</b></div></article>
          <article><span className="metricGlyph amber"><Icon name="flow"/></span><div><small>主力资金</small><b className={(mainFlow || 0) >= 0 ? "up" : "down"}>{displayFlow(mainFlow)}</b></div></article>
          <article title={market.northbound.notice}><span className="metricGlyph violet"><Icon name="compass"/></span><div><small>北向公开口径</small><b className={market.northbound.available ? (northboundTotal >= 0 ? "up" : "down") : "mutedValue"}>{market.northbound.available ? displayFlow(northboundTotal) : "盘中暂无"}</b></div></article>
          <article><span className="metricGlyph mint"><Icon name="layers"/></span><div><small>资金领涨行业</small><b>{leadingSector?.name || "读取中"}</b></div></article>
        </>}
      </div>
      {expanded && (isUs ? <div className="marketExpansion usExpansion">
        {market.quotes.map((quote) => <article key={quote.code}><div><b>{quote.name}</b><code>{quote.code.replace(/^US/, "")}</code></div><dl><span><dt>开盘</dt><dd>{quote.open.toFixed(2)}</dd></span><span><dt>最高</dt><dd>{quote.high.toFixed(2)}</dd></span><span><dt>最低</dt><dd>{quote.low.toFixed(2)}</dd></span><span><dt>昨收</dt><dd>{quote.yesterday.toFixed(2)}</dd></span></dl></article>)}
        <p><Icon name="info"/>{market.notice}</p>
      </div> : <div className="marketExpansion">
        <div className="flowBreakdown"><h3>资金结构</h3>{[
          ["超大单", market.capitalFlow.latest?.superLargeNet], ["大单", market.capitalFlow.latest?.largeNet], ["中单", market.capitalFlow.latest?.mediumNet], ["小单", market.capitalFlow.latest?.smallNet],
        ].map(([label, value]) => <div key={String(label)}><span>{label}</span><b className={Number(value) >= 0 ? "up" : "down"}>{displayFlow(value as number | null)}</b></div>)}</div>
        <div className="sectorFlow"><h3>行业净流入</h3>{market.sectors.slice(0, 5).map((sector) => <div key={sector.code}><span>{sector.name}</span><b className={(sector.netInflow || 0) >= 0 ? "up" : "down"}>{sector.netInflow == null ? "暂无" : displayFlow(sector.netInflow / 1e8)}</b></div>)}</div>
        <p><Icon name="info"/>{market.notice}</p>
      </div>)}
    </> : <div className="panelSkeleton marketSkeleton"><i/><i/><i/><i/></div>}
  </section>;
}
