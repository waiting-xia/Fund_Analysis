import { useState, type FormEvent } from "react";
import type { WatchFund } from "../types";
import { Icon } from "./Icon";

function percent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "暂无";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

interface PortfolioMonitorProps {
  funds: WatchFund[];
  codes: string[];
  selectedCode: string;
  loading: boolean;
  pendingFund: { code: string; name: string } | null;
  onSelect: (code: string) => void;
  onReplace: (index: number) => void;
  onCancelReplace: () => void;
  onSaveCodes: (codes: string[]) => void;
}

export function PortfolioMonitor({ funds, codes, selectedCode, loading, pendingFund, onSelect, onReplace, onCancelReplace, onSaveCodes }: PortfolioMonitorProps) {
  const [editing, setEditing] = useState(false);
  const [draftCodes, setDraftCodes] = useState(codes);
  const [editError, setEditError] = useState("");

  const toggleEditor = () => {
    onCancelReplace();
    setDraftCodes(codes);
    setEditError("");
    setEditing((value) => !value);
  };

  const saveCodes = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = draftCodes.map((code) => code.trim());
    if (normalized.length !== 4 || normalized.some((code) => !/^\d{6}$/.test(code))) {
      setEditError("每个监控位都需要填写六位基金代码");
      return;
    }
    if (new Set(normalized).size !== 4) {
      setEditError("四个监控位不能使用重复基金代码");
      return;
    }
    onSaveCodes(normalized);
    setEditing(false);
    setEditError("");
  };

  return <section className="portfolioPanel" id="portfolio">
    <header className="sectionHeading">
      <div className="sectionTitle"><span className="sectionIcon blue"><Icon name="wallet"/></span><div><span className="eyebrow">MY WATCHLIST</span><h2>4 只持仓基金</h2></div></div>
      <div className="portfolioHeadingActions"><span className="sectionHint"><Icon name="refresh"/>正式净值按披露日更新</span><button type="button" className={editing ? "active" : ""} onClick={toggleEditor} aria-expanded={editing}><Icon name="swap"/>{editing ? "取消更改" : "更改持仓基金"}</button></div>
    </header>
    {editing && <form className="portfolioEditor" onSubmit={saveCodes}>
      <div className="portfolioEditorIntro"><span className="slotPickerIcon"><Icon name="wallet"/></span><span><b>编辑四个监控位</b><small>输入新的六位基金代码，保存后会重新加载净值、风险、资讯和日报。</small></span></div>
      <div className="portfolioCodeFields">{[0, 1, 2, 3].map((index) => <label key={index}><span>位置 {index + 1}</span><input value={draftCodes[index] || ""} inputMode="numeric" maxLength={6} aria-label={`位置 ${index + 1} 基金代码`} onChange={(event) => { const value = event.target.value.replace(/\D/g, "").slice(0, 6); setDraftCodes((current) => current.map((code, currentIndex) => currentIndex === index ? value : code)); setEditError(""); }}/><small>{funds[index]?.name || "请输入基金代码"}</small></label>)}</div>
      <div className="portfolioEditorActions">{editError && <span role="alert"><Icon name="alert"/>{editError}</span>}<button type="button" onClick={toggleEditor}>取消</button><button type="submit" className="primary"><Icon name="check"/>保存并更新</button></div>
    </form>}
    {pendingFund && <div className="slotPicker">
      <div><span className="slotPickerIcon"><Icon name="swap"/></span><span><b>选择要替换的监控位</b><small>{pendingFund.name} · {pendingFund.code}</small></span></div>
      <div className="slotOptions">{[0, 1, 2, 3].map((index) => <button type="button" key={index} onClick={() => onReplace(index)}><span>位置 {index + 1}</span><small>{funds[index]?.name || "读取中"}</small></button>)}</div>
      <button type="button" className="slotCancel" onClick={onCancelReplace}>取消</button>
    </div>}
    <div className="portfolioCards">
      {loading && !funds.length ? [0, 1, 2, 3].map((item) => <article className="fundTile tileSkeleton" key={item}><i/><i/><i/></article>) : funds.map((fund, index) => {
        const active = fund.code === selectedCode;
        const tone = (fund.dayGrowth || 0) > 0 ? "up" : (fund.dayGrowth || 0) < 0 ? "down" : "";
        return <button type="button" className={`fundTile ${active ? "active" : ""}`} key={fund.code} onClick={() => onSelect(fund.code)} aria-pressed={active}>
          <div className="fundTileTop"><span className="fundAvatar">{fund.name.slice(0, 1)}</span><span><b>{fund.name}</b><small>{fund.code} · {fund.type}</small></span><span className="slotNumber">{index + 1}</span>{active && <em>当前</em>}</div>
          <div className="fundTileValue"><span><small>最新净值</small><strong>{fund.nav == null ? "--" : fund.nav.toFixed(4)}</strong></span><span><small>日涨跌</small><strong className={tone}>{percent(fund.dayGrowth)}</strong></span></div>
          <footer><span><Icon name="calendar"/>{fund.date || "待披露"}</span><Icon name="arrowRight"/></footer>
        </button>;
      })}
    </div>
  </section>;
}
