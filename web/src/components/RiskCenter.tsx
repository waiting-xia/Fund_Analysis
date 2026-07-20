import type { RiskWorkspaceResponse } from "../types";
import { Icon } from "./Icon";

function percent(value: number | null) {
  return value == null || !Number.isFinite(value) ? "--" : `${value.toFixed(1)}%`;
}

function cellTone(value: number | null) {
  if (value == null) return "missing";
  const strength = Math.round(Math.abs(value) * 4);
  return value >= 0 ? `positive c${strength}` : `negative c${strength}`;
}

export function RiskCenter({ data, loading }: { data: RiskWorkspaceResponse | null; loading: boolean }) {
  const riskiest = data?.funds.slice().sort((left, right) => (right.metrics.volatility || 0) - (left.metrics.volatility || 0))[0];
  return <section className="riskPanel" id="risk">
    <header className="sectionHeading">
      <div className="sectionTitle"><span className="sectionIcon coral"><Icon name="shield"/></span><div><span className="eyebrow">RISK CONTROL</span><h2>组合风险管理</h2></div></div>
      <span className="sectionHint">近 252 个净值日</span>
    </header>
    {loading && !data ? <div className="wideLoading"><i/>正在计算波动、回撤与相关性…</div> : data ? <div className="riskLayout">
      <div className="riskStatGrid">{data.funds.map((fund) => <article key={fund.code}><header className="riskFundHead"><div><b title={fund.name}>{fund.name}</b><code>{fund.code}</code></div><span className={`riskSignal ${fund.score.action.tone}`}>{fund.score.label}</span></header><dl><div><dt>年化波动率</dt><dd>{percent(fund.metrics.volatility)}</dd></div><div><dt>最大回撤</dt><dd className="down">{percent(fund.metrics.maxDrawdown)}</dd></div></dl></article>)}</div>
      <div className="correlationCard"><div className="correlationHead"><span><b>相关性矩阵</b><small>日收益 Pearson 相关系数</small></span>{riskiest && <em>最高波动：{riskiest.name}</em>}</div><div className="correlationMatrix" style={{ gridTemplateColumns: `54px repeat(${data.correlation.labels.length}, 1fr)` }}><span/>{data.correlation.labels.map((label) => <b key={`h-${label}`}>{label.slice(-3)}</b>)}{data.correlation.matrix.flatMap((row, rowIndex) => [<b key={`r-${rowIndex}`}>{data.correlation.labels[rowIndex].slice(-3)}</b>, ...row.map((value, columnIndex) => <span className={cellTone(value)} key={`${rowIndex}-${columnIndex}`}>{value == null ? "--" : value.toFixed(2)}</span>)])}</div>{data.highCorrelationPairs.length ? <p className="correlationAlert"><Icon name="alert"/>{data.highCorrelationPairs[0].leftName} 与 {data.highCorrelationPairs[0].rightName} 同向性较高，注意重复暴露。</p> : <p className="correlationOk"><Icon name="check"/>暂未发现绝对值超过 0.75 的高相关组合。</p>}</div>
    </div> : <div className="emptyModule">风险数据暂不可用</div>}
  </section>;
}
