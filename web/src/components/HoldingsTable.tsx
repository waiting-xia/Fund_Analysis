import { useState } from "react";
import type { Holding } from "../types";
import { Icon } from "./Icon";

export function HoldingsTable({ holdings, period, loading = false }: { holdings: Holding[]; period: string | null; loading?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? holdings.slice(0, 10) : holdings.slice(0, 5);
  return <article className="card holdingsCard" id="holdings">
    <header className="cardHead holdingsHead"><div><h2><Icon name="holdings"/>公开持仓摘要</h2><p>披露期：{period || (loading ? "正在读取" : "暂无")} · 默认展示前五大</p></div><div className="holdingsActions"><span className="noticeBadge">定期披露</span>{holdings.length > 5 && <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "收起" : `查看全部 ${Math.min(10, holdings.length)} 项`}<Icon name="chevronDown"/></button>}</div></header>
    <div className="holdingsTable" role="table" aria-label="基金前十大公开持仓">
      <div className="holdingRow holdingHeader" role="row"><span>证券名称</span><span>证券代码</span><span>占净值比例</span><span>持仓市值</span></div>
      {loading ? <div className="holdingsLoading"><i/>正在后台读取持仓与行业配置…</div> : visible.length ? visible.map((holding) => <div className="holdingRow" role="row" key={`${holding.code}-${holding.name}`}>
        <span><b>{holding.name}</b></span><span>{holding.code}</span><span>{holding.weight || "暂无"}</span><span>{holding.marketValue || "暂无"}</span>
      </div>) : <div className="noHoldings">暂无股票持仓披露；货币基金、纯债基金可能不提供该表。</div>}
    </div>
    <p className="holdingNote">公开报告有披露延迟，持仓变化不等于期间完整交易记录。</p>
  </article>;
}
