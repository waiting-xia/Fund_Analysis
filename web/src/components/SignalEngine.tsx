import type { FundScore } from "../types";
import { Icon } from "./Icon";

export function SignalEngine({ score }: { score: FundScore | null }) {
  return <article className="moduleCard signalCard" id="signals">
    <header className="cardHeader"><div><span className="cardIcon violet"><Icon name="target"/></span><span><small>5-FACTOR ENGINE</small><h2>投资信号引擎</h2></span></div>{score && <strong className="signalTotal">{score.total.toFixed(0)}<small>/100</small></strong>}</header>
    {score ? <>
      <div className="factorList">{score.factors.map((factor) => <div key={factor.key}><span><b>{factor.label}</b><small>{factor.detail}</small></span><div><i style={{ width: `${factor.score}%` }}/></div><strong>{factor.score.toFixed(0)}</strong></div>)}</div>
      <div className={`actionBox ${score.action.tone}`}><span className="actionIcon"><Icon name="bolt"/></span><div><small>当前研究信号</small><b>{score.action.title}</b><p>{score.action.steps.join("；")}</p></div></div>
      <p className="moduleNote"><Icon name="shield"/>规则由真实净值计算，建议不含自动交易或收益承诺。</p>
    </> : <div className="cardLoading"><i/>等待基金指标…</div>}
  </article>;
}
