import { useState } from "react";
import type { NewsWorkspaceResponse } from "../types";
import { Icon } from "./Icon";

function date(value: string) {
  if (!value) return "日期未知";
  return value.slice(0, 10);
}

export function NewsRadar({ data, loading }: { data: NewsWorkspaceResponse | null; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const items = expanded ? data?.items || [] : data?.items.slice(0, 6) || [];
  return <section className="newsPanel" id="news">
    <header className="sectionHeading">
      <div className="sectionTitle"><span className="sectionIcon violet"><Icon name="newspaper"/></span><div><span className="eyebrow">INTELLIGENCE FEED</span><h2>智能新闻采集</h2></div></div>
      <div className="newsMode"><Icon name="sparkles"/><span>{data?.mode || "关键词 + LLM"}</span>{data?.items.length ? <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : `查看全部 ${data.items.length} 条`}</button> : null}</div>
    </header>
    {loading && !data ? <div className="wideLoading"><i/>正在进行关键词过滤与模型复核…</div> : items.length ? <div className="newsGrid">{items.map((item) => <a href={item.url || undefined} target="_blank" rel="noreferrer" className="newsItem" key={`${item.title}-${item.publishedAt}`}>
      <div className="newsMeta"><span className={`severity ${item.severity}`}>{item.severity === "high" ? "高影响" : item.severity === "medium" ? "需关注" : "一般"}</span><span>{item.fundName}</span><time>{date(item.publishedAt)}</time></div>
      <h3>{item.title}</h3>
      <p>{item.summary || item.reason}</p>
      <footer><span>{item.source}</span><span>相关度 {item.relevance}<Icon name="arrowUpRight"/></span></footer>
    </a>)}</div> : <div className="emptyModule"><Icon name="newspaper"/><b>暂无通过筛选的近期资讯</b><span>{data?.notice || "新闻源正在更新"}</span></div>}
    {data && <p className="moduleNote"><Icon name="info"/>{data.notice}</p>}
  </section>;
}
