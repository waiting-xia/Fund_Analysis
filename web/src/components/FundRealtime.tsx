import { useEffect, useState } from "react";
import { fetchFundRealtime } from "../api";
import type { FundRealtime as FundRealtimeData } from "../types";

function value(number?: number) {
  return number == null || !Number.isFinite(number) || number <= 0 ? "暂无" : number.toFixed(4);
}

function percent(number?: number) {
  return number == null || !Number.isFinite(number) ? "暂无" : `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

export function FundRealtime({ code, initial, valueKind }: { code: string; initial: FundRealtimeData | null; valueKind: "nav" | "money" }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let controller = new AbortController();
    const load = async () => {
      controller.abort();
      controller = new AbortController();
      try {
        const result = await fetchFundRealtime(code, controller.signal);
        if (active) { setData(result); setError(""); }
      } catch (reason) {
        if (!active || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setError(reason instanceof Error ? reason.message : "基金行情暂不可用");
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(timer); controller.abort(); };
  }, [code]);

  if (!data) return <section className="fundRealtime unavailable"><span>{error || "正在读取正式净值与盘中估算…"}</span></section>;
  if (valueKind === "money") return <section className="fundRealtime" aria-label="货币基金收益">
    <div className="navLedgerCell officialNav">
      <span>每万份收益</span><strong>{value(data.officialNav)}</strong>
      <p><b>元</b><time>{data.officialNavDate}</time></p>
    </div>
    <div className="navLedgerDivider"><i/></div>
    <div className="navLedgerCell estimatedNav">
      <span>七日年化收益</span><strong>{Number.isFinite(data.accumulatedNav) ? `${data.accumulatedNav.toFixed(4)}%` : "暂无"}</strong>
      <p><b>基金公司披露</b><time>{data.officialNavDate}</time></p>
    </div>
    <p className="estimateNotice">货币基金不使用单位净值口径，展示每万份收益与七日年化收益。{error ? ` · 刷新提示：${error}` : ""}</p>
  </section>;
  const estimateTone = (data.estimatedGrowthPercent || 0) > 0 ? "up" : (data.estimatedGrowthPercent || 0) < 0 ? "down" : "";
  return <section className="fundRealtime" aria-label="基金净值">
    <div className="navLedgerCell officialNav">
      <span>基金公司确认净值</span><strong>{value(data.officialNav)}</strong>
      <p><b className={(data.officialGrowthPercent || 0) > 0 ? "up" : (data.officialGrowthPercent || 0) < 0 ? "down" : ""}>{percent(data.officialGrowthPercent)}</b><time>{data.officialNavDate}</time></p>
    </div>
    <div className="navLedgerDivider"><i/></div>
    <div className="navLedgerCell estimatedNav">
      <span>盘中估算净值</span><strong>{value(data.estimatedNav)}</strong>
      <p><b className={estimateTone}>{percent(data.estimatedGrowthPercent)}</b><time>{data.estimateTime || "当前基金暂无估算"}</time></p>
    </div>
    <p className="estimateNotice">{data.notice}{error ? ` · 刷新提示：${error}` : ""}</p>
  </section>;
}
