import type { CSSProperties } from "react";
import type { ValuationResponse } from "../types";
import { Icon } from "./Icon";

function number(value: number | null | undefined, suffix = "") {
  return value == null || !Number.isFinite(value) ? "--" : `${value.toFixed(1)}${suffix}`;
}

export function ValuationPanel({ data, loading }: { data: ValuationResponse | null; loading: boolean }) {
  const primary = data?.industries[0];
  const holdings = data?.holdingsValuation;
  const industryMode = data?.mode === "industry" && Boolean(primary);
  const holdingsMode = data?.mode === "holdings" && Boolean(holdings?.available);
  const percentile = industryMode ? primary?.valuationPercentile : null;
  const level = percentile == null ? "有效数据" : percentile <= 30 ? "偏低" : percentile >= 70 ? "偏高" : "中性";
  const arcValue = Math.max(0, Math.min(100, industryMode ? percentile ?? 0 : holdings?.coverage ?? 0));

  return <article className="moduleCard valuationCard" id="valuation">
    <header className="cardHeader"><div><span className="cardIcon amber"><Icon name="gauge"/></span><span><small>VALUATION</small><h2>行业与持仓估值</h2></span></div>{(industryMode || holdingsMode) && <em className={`valuationTag ${level === "偏低" ? "low" : level === "偏高" ? "high" : ""}`}>{industryMode ? level : data?.industryDeferred ? "穿透口径 · 补充中" : "穿透口径"}</em>}</header>
    {loading && !data ? <div className="cardLoading"><i/>正在读取真实估值数据…</div> : industryMode && primary ? <>
      <div className="valuationHero"><div><span>{primary.name}</span><strong>{number(percentile, "%")}</strong><small>当前行业横截面估值分位</small></div><div className="valuationArc" style={{ "--value": `${arcValue}%` } as CSSProperties}><i/><span>{level}</span></div></div>
      <div className="valuationMetrics"><div><span>PE</span><b>{number(primary.pe)}x</b><small>横截面分位 {number(primary.pePercentile, "%")}</small></div><div><span>PB</span><b>{number(primary.pb)}x</b><small>横截面分位 {number(primary.pbPercentile, "%")}</small></div><div><span>行业指数近一年位置</span><b>{number(primary.pricePosition1y, "%")}</b><small>同期收益 {number(primary.return1y, "%")}</small></div></div>
      <div className="valuationPeers">{data.industries.slice(1, 4).map((industry) => <span key={industry.code}>{industry.name}<b>{number(industry.valuationPercentile, "%")}</b></span>)}</div>
      <p className="moduleNote"><Icon name="info"/>{data.notice}</p>
    </> : holdingsMode && holdings ? <>
      <div className="valuationHero"><div><span>最近一期前十大持仓穿透</span><strong>{number(holdings.coverage, "%")}</strong><small>可估值重仓股占基金净资产比例</small></div><div className="valuationArc holdings" style={{ "--value": `${arcValue}%` } as CSSProperties}><i/><span>已覆盖</span></div></div>
      <div className="valuationMetrics"><div><span>{holdings.peLabel || "PE"}</span><b>{number(holdings.pe)}x</b><small>估值覆盖 {number(holdings.peCoverage, "%")}</small></div><div><span>PB</span><b>{number(holdings.pb)}x</b><small>估值覆盖 {number(holdings.pbCoverage, "%")}</small></div><div><span>基金净值近一年位置</span><b>{number(data?.fundNavContext.position1y, "%")}</b><small>同期收益 {number(data?.fundNavContext.return1y, "%")}</small></div></div>
      <div className="valuationPeers holdingPeers">{holdings.securities.filter((item) => item.pe != null || item.pb != null).slice(0, 3).map((item) => <span key={item.code}>{item.name}<b>PE {number(item.pe)}</b></span>)}</div>
      <p className="moduleNote"><Icon name="info"/>{data.notice}</p>
    </> : <div className="emptyModule"><Icon name="gauge"/><b>当前没有足够的权益估值数据</b><span>{data?.notice || "暂无可映射的行业或公开 A 股重仓持仓"}</span></div>}
  </article>;
}
