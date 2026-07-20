import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAlipayFund, fetchFund, fetchFundNews, fetchFundPortfolio, fetchRiskWorkspace, fetchValuation, fetchWatchlist } from "./api";
import { AIAnalysis } from "./components/AIAnalysis";
import { FundRealtime } from "./components/FundRealtime";
import { HoldingChanges } from "./components/HoldingChanges";
import { Icon } from "./components/Icon";
import { NavChart } from "./components/NavChart";
import { NewsRadar } from "./components/NewsRadar";
import { PortfolioMonitor } from "./components/PortfolioMonitor";
import { RealtimeMarket } from "./components/RealtimeMarket";
import { RiskCenter } from "./components/RiskCenter";
import { SearchBar } from "./components/SearchBar";
import { SignalEngine } from "./components/SignalEngine";
import { ValuationPanel } from "./components/ValuationPanel";
import type { FundData, FundPortfolioResponse, NewsWorkspaceResponse, RiskWorkspaceResponse, ValuationResponse, WatchlistResponse } from "./types";

const DEFAULT_WATCHLIST = ["510300", "161725", "005827", "110011"];
const FUND_CACHE_KEY = "guanlan:fundCache:v2";
const WATCHLIST_KEY = "guanlan:watchlist";
const FUND_CACHE_TTL = 15 * 60 * 1000;

function readWatchlist() {
  try {
    const value = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "null");
    if (Array.isArray(value) && value.length === 4 && value.every((code) => /^\d{6}$/.test(code))) return value as string[];
  } catch { /* use defaults */ }
  return DEFAULT_WATCHLIST;
}

function readCachedFund(code: string): FundData | null {
  try {
    const cache = JSON.parse(localStorage.getItem(FUND_CACHE_KEY) || "{}") as Record<string, { cachedAt: number; fund: FundData }>;
    const item = cache[code];
    if (!item?.fund || Date.now() - item.cachedAt > FUND_CACHE_TTL || !Array.isArray(item.fund.history)) return null;
    return item.fund;
  } catch { return null; }
}

function saveCachedFund(fund: FundData) {
  try {
    const cache = JSON.parse(localStorage.getItem(FUND_CACHE_KEY) || "{}") as Record<string, { cachedAt: number; fund: FundData }>;
    cache[fund.code] = { cachedAt: Date.now(), fund };
    const entries = Object.entries(cache).sort((left, right) => right[1].cachedAt - left[1].cachedAt).slice(0, 8);
    localStorage.setItem(FUND_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage can be unavailable */ }
}

function percent(value: number | null) {
  return value == null || !Number.isFinite(value) ? "暂无" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function tone(value: number | null) {
  return value == null || value === 0 ? "" : value > 0 ? "up" : "down";
}

function shortTime(value?: string) {
  if (!value) return "--:--";
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function App() {
  const initialWatchlist = useMemo(() => readWatchlist(), []);
  const queryCode = new URLSearchParams(location.search).get("code") || "";
  const initialCode = /^\d{6}$/.test(queryCode) ? queryCode : initialWatchlist[0];
  const initialFund = readCachedFund(initialCode);
  const [watchlistCodes, setWatchlistCodes] = useState(initialWatchlist);
  const [watchlist, setWatchlist] = useState<WatchlistResponse | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [code, setCode] = useState(initialCode);
  const [fund, setFund] = useState<FundData | null>(initialFund);
  const [portfolio, setPortfolio] = useState<FundPortfolioResponse | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [fundStatus, setFundStatus] = useState<"loading" | "done" | "error">(initialFund ? "done" : "loading");
  const [fundError, setFundError] = useState("");
  const [risk, setRisk] = useState<RiskWorkspaceResponse | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);
  const [news, setNews] = useState<NewsWorkspaceResponse | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [valuationLoading, setValuationLoading] = useState(true);
  const [requestKey, setRequestKey] = useState(0);
  const [watchlistMessage, setWatchlistMessage] = useState("");
  const [watchlistPickerOpen, setWatchlistPickerOpen] = useState(false);

  const selectFund = useCallback((nextCode: string) => {
    if (!/^\d{6}$/.test(nextCode)) { setFundError("请输入六位数字基金代码"); setFundStatus("error"); return; }
    const cached = readCachedFund(nextCode);
    setCode(nextCode);
    setFund(cached);
    setFundStatus(cached ? "done" : "loading");
    setFundError("");
    setPortfolio(null);
    setPortfolioLoading(true);
    setValuation(null);
    setValuationLoading(true);
    setWatchlistPickerOpen(false);
    setRequestKey((key) => key + 1);
    document.querySelector("#fund-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchWatchlist(watchlistCodes, controller.signal).then((result) => setWatchlist(result)).catch(() => setWatchlist(null)).finally(() => setWatchlistLoading(false));
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlistCodes));
    return () => controller.abort();
  }, [watchlistCodes]);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedFund(code);
    fetchFund(code, controller.signal).then((result) => {
      setFund(result); setFundStatus("done"); saveCachedFund(result); history.replaceState(null, "", `?code=${code}`);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (cached) { setFund(cached); setFundStatus("done"); return; }
      setFundError(reason instanceof Error ? reason.message : "基金数据暂时不可用"); setFundStatus("error");
    });
    fetchFundPortfolio(code, controller.signal).then((result) => setPortfolio(result)).catch(() => setPortfolio(null)).finally(() => setPortfolioLoading(false));
    fetchAlipayFund(code, controller.signal).then((channel) => setFund((current) => current?.code === code ? { ...current, alipay: channel } : current)).catch(() => {});
    const valuationTimer = window.setTimeout(() => {
      fetchValuation(code, controller.signal).then((result) => setValuation(result)).catch(() => setValuation(null)).finally(() => setValuationLoading(false));
    }, 160);
    const industryTimer = window.setTimeout(() => {
      fetchValuation(code, controller.signal, true).then((result) => setValuation(result)).catch(() => {});
    }, 1_500);
    return () => { window.clearTimeout(valuationTimer); window.clearTimeout(industryTimer); controller.abort(); };
  }, [code, requestKey]);

  useEffect(() => {
    const controller = new AbortController();
    const riskTimer = window.setTimeout(() => {
      fetchRiskWorkspace(watchlistCodes, controller.signal).then((result) => setRisk(result)).catch(() => setRisk(null)).finally(() => setRiskLoading(false));
    }, 320);
    const newsTimer = window.setTimeout(() => {
      fetchFundNews(watchlistCodes, controller.signal).then((result) => setNews(result)).catch(() => setNews(null)).finally(() => setNewsLoading(false));
    }, 700);
    return () => { window.clearTimeout(riskTimer); window.clearTimeout(newsTimer); controller.abort(); };
  }, [watchlistCodes]);

  const openWatchlistPicker = () => {
    if (watchlistCodes.includes(code)) return;
    setWatchlistPickerOpen(true);
    window.requestAnimationFrame(() => document.querySelector("#portfolio")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const replaceWatchFund = (index: number) => {
    if (watchlistCodes.includes(code) || index < 0 || index > 3) return;
    const replaced = watchlist?.funds[index];
    setWatchlistLoading(true);
    setRiskLoading(true);
    setNewsLoading(true);
    setWatchlistCodes((current) => current.map((currentCode, currentIndex) => currentIndex === index ? code : currentCode));
    setWatchlistPickerOpen(false);
    setWatchlistMessage(`已用当前基金替换位置 ${index + 1}${replaced ? `（原 ${replaced.name}）` : ""}`);
    window.setTimeout(() => setWatchlistMessage(""), 2600);
  };

  const saveWatchlistCodes = (nextCodes: string[]) => {
    setWatchlistLoading(true);
    setRiskLoading(true);
    setNewsLoading(true);
    setWatchlistPickerOpen(false);
    setWatchlistCodes(nextCodes);
    setWatchlistMessage("四个持仓监控位已更新，正在重新加载相关分析");
    window.setTimeout(() => setWatchlistMessage(""), 3200);
  };

  const metrics = fund?.metrics;
  const selectedInWatchlist = watchlistCodes.includes(code);

  return <main className="appShell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brandMark"><Icon name="activity"/></span><span><b>观澜</b><small>Fund Intelligence</small></span></a>
      <nav aria-label="主导航">
        <span>研究工作台</span>
        <a href="#market"><Icon name="pulse"/>市场监控</a>
        <a href="#portfolio"><Icon name="wallet"/>持仓基金</a>
        <a href="#valuation"><Icon name="gauge"/>估值分析</a>
        <a href="#risk"><Icon name="shield"/>风险管理</a>
        <a href="#signals"><Icon name="target"/>信号引擎</a>
        <a href="#news"><Icon name="newspaper"/>智能资讯</a>
        <a href="#ai-panel"><Icon name="sparkles"/>智能分析</a>
      </nav>
      <p className="sidebarDisclaimer">公开数据用于研究辅助<br/>不构成投资建议</p>
    </aside>

    <section className="workspace" id="top">
      <header className="topbar">
        <div className="pageIdentity"><span>基金投研工作台</span><b>全景监控与决策辅助</b></div>
        <SearchBar key={code} value={code} loading={fundStatus === "loading"} onSearch={selectFund}/>
        <div className="topbarMeta"><span className="connectionBadge"><i/>实时数据</span></div>
      </header>

      <div className="dashboardContent">
        <section className="introBand"><div><span className="eyebrow">FUND RESEARCH COMMAND CENTER</span><h1>把行情、风险和信息放在同一张桌面上</h1><p>真实公开数据分层加载，重点结论保留来源、日期与计算口径。</p></div><div className="introStats"><span><b>4</b><small>持仓监控</small></span><span><b>5</b><small>量化因子</small></span><span><b>30s</b><small>行情刷新</small></span></div></section>

        <RealtimeMarket/>
        <PortfolioMonitor funds={watchlist?.funds || []} codes={watchlistCodes} selectedCode={code} loading={watchlistLoading} pendingFund={watchlistPickerOpen && fund?.code === code ? { code: fund.code, name: fund.name } : null} onSelect={selectFund} onReplace={replaceWatchFund} onCancelReplace={() => setWatchlistPickerOpen(false)} onSaveCodes={saveWatchlistCodes}/>
        {watchlistMessage && <div className="toastMessage"><Icon name="check"/>{watchlistMessage}</div>}

        <section className="fundDetail" id="fund-detail">
          {fundStatus === "loading" && !fund && <div className="fundLoading"><span className="spinner"/><div><b>正在读取基金详情</b><p>首屏行情与持仓卡片可继续使用，详细分析在后台加载。</p></div></div>}
          {fundStatus === "error" && !fund && <div className="fundError"><Icon name="alert"/><div><b>暂时无法获取该基金</b><p>{fundError}</p></div><button type="button" onClick={() => selectFund(code)}>重试</button></div>}
          {fund && metrics && <>
            <header className="fundProfile"><div className="fundProfileMain"><span className="fundMonogram">{fund.name.slice(0, 1)}</span><div><span className="eyebrow">SELECTED FUND · {fund.code}</span><h2>{fund.name}</h2><p>{fund.type || "基金"} · {fund.manager || "经理暂无"} · {fund.company || "管理人暂无"}</p></div></div><div className="fundProfileActions"><span><Icon name="clock"/>净值 {fund.latest.date}</span><span>更新 {shortTime(fund.retrievedAt)}</span><button className={selectedInWatchlist ? "monitored" : ""} type="button" disabled={selectedInWatchlist} onClick={openWatchlistPicker}><Icon name={selectedInWatchlist ? "check" : "swap"}/>{selectedInWatchlist ? "持仓监控中" : "选择监控位"}</button></div></header>
            <div className="fundSnapshot"><article className="navMetric"><span>最新单位净值</span><strong>{fund.latest.nav.toFixed(4)}</strong><b className={tone(fund.latest.dayGrowth)}>{percent(fund.latest.dayGrowth)}</b></article>{[
              ["近 1 月", metrics.return1m], ["近 3 月", metrics.return3m], ["近 1 年", metrics.return1y], ["最大回撤", metrics.maxDrawdown],
            ].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong className={tone(value as number | null)}>{percent(value as number | null)}</strong><small>正式净值计算</small></article>)}</div>
            <FundRealtime key={fund.code} code={fund.code} initial={fund.realtime} valueKind={fund.valueKind}/>
            <div className="analysisGrid"><NavChart history={fund.history} comparisons={fund.comparisons} industries={portfolio?.industries || []} industryPeriod={portfolio?.industryPeriod || null} contextStatus={portfolioLoading ? "loading" : portfolio ? "done" : "error"} valueKind={fund.valueKind}/><SignalEngine score={fund.score}/></div>
            <div className="insightGrid"><ValuationPanel data={valuation} loading={valuationLoading}/><HoldingChanges items={portfolio?.holdingChanges || []} period={portfolio?.holdingPeriod || null} loading={portfolioLoading}/></div>
          </>}
        </section>

        <RiskCenter data={risk} loading={riskLoading}/>
        <NewsRadar data={news} loading={newsLoading}/>

        <section className="aiSection">
          <header className="aiSectionHead">
            <div className="sectionTitle"><span className="sectionIcon"><Icon name="sparkles"/></span><div><span className="eyebrow">RESEARCH SYNTHESIS</span><h2>AI 研究综合判断</h2><p>将公开数据、风险指标与金融理论组织为可核验的研究结论。</p></div></div>
            <div className="aiSectionRule"><Icon name="shield"/><span><b>证据约束输出</b><small>事实 / 理论 / 推断分层</small></span></div>
          </header>
          {fund ? <AIAnalysis key={fund.code} code={fund.code} isHeld={selectedInWatchlist}/> : <div className="wideLoading"><i/>等待基金数据…</div>}
        </section>

        <section className="sourceFooter"><div><Icon name="database"/><span><b>数据与模型边界</b><small>公开基金与市场数据 · 兼容模型服务</small></span></div><p>净值以基金公司正式披露为准；估算净值、量化信号与模型分析均不构成买卖建议。</p><a href={fund?.sources.profile} target="_blank" rel="noreferrer">查看原始基金档案<Icon name="arrowUpRight"/></a></section>
      </div>
    </section>
  </main>;
}
