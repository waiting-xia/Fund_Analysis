import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { IndustryAllocation, NavPoint, PerformanceSeries } from "../types";
import { Icon } from "./Icon";

type Range = "30" | "90" | "365" | "all";
type SeriesRole = PerformanceSeries["role"];

const RANGE_LABELS: Record<Range, string> = { "30": "1月", "90": "3月", "365": "1年", all: "全部" };
const CHART_PADDING = { top: 18, right: 24, bottom: 34, left: 54 };

function timestamp(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function formatPercent(value: number) {
  const normalized = Math.abs(value) < .005 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(2)}%`;
}

function formatAxisPercent(value: number) {
  if (Math.abs(value) < .005) return "0%";
  const digits = Math.abs(value) < 10 ? 1 : 0;
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function historyAsReturns(history: NavPoint[]): PerformanceSeries {
  const first = history.find((point) => Number.isFinite(point.nav) && point.nav > 0)?.nav || 1;
  return {
    name: "本基金",
    role: "fund",
    points: history.map((point) => ({ date: point.date, value: (point.nav / first - 1) * 100 })),
  };
}

function rebaseVisiblePoints(points: PerformanceSeries["points"]) {
  if (!points.length) return [];
  const base = points[0].value;
  const baseIndex = 1 + base / 100;
  return points.map((point) => ({
    ...point,
    value: baseIndex > 0 ? ((1 + point.value / 100) / baseIndex - 1) * 100 : point.value - base,
  }));
}

function niceStep(span: number, targetTicks = 5) {
  const rough = Math.max(span, .01) / targetTicks;
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * power;
}

function tone(value: number) {
  return value > .005 ? "positive" : value < -.005 ? "negative" : "flat";
}

export function NavChart({
  history,
  comparisons,
  industries,
  industryPeriod,
  contextStatus,
  valueKind = "nav",
}: {
  history: NavPoint[];
  comparisons: PerformanceSeries[];
  industries: IndustryAllocation[];
  industryPeriod: string | null;
  contextStatus: "loading" | "done" | "error";
  valueKind?: "nav" | "money";
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>("90");
  const [size, setSize] = useState({ width: 820, height: 278 });
  const [hovered, setHovered] = useState<{
    date: string;
    x: number;
    left: number;
    items: { name: string; value: number; role: SeriesRole }[];
  } | null>(null);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const update = () => {
      const rect = plot.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  const series = useMemo(() => {
    const source = comparisons.length ? comparisons : [historyAsReturns(history)];
    const normalized = source.map((item) => ({
      ...item,
      points: [...item.points].filter((point) => Number.isFinite(point.value)).sort((left, right) => timestamp(left.date) - timestamp(right.date)),
    }));
    const latestTime = Math.max(...normalized.flatMap((item) => item.points.map((point) => timestamp(point.date))));
    const threshold = range === "all" || !Number.isFinite(latestTime) ? -Infinity : latestTime - Number(range) * 86_400_000;
    return normalized.map((item) => {
      const visible = item.points.filter((point) => timestamp(point.date) >= threshold);
      return { ...item, points: rebaseVisiblePoints(visible) };
    }).filter((item) => item.points.length > 1);
  }, [comparisons, history, range]);

  const chart = useMemo(() => {
    const allPoints = series.flatMap((item) => item.points);
    if (!allPoints.length) return null;
    const width = Math.max(320, size.width);
    const height = Math.max(220, size.height);
    const plotWidth = Math.max(1, width - CHART_PADDING.left - CHART_PADDING.right);
    const plotHeight = Math.max(1, height - CHART_PADDING.top - CHART_PADDING.bottom);
    const times = allPoints.map((point) => timestamp(point.date));
    const values = allPoints.map((point) => point.value);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values);
    const padding = Math.max((rawMax - rawMin) * .08, .4);
    const step = niceStep(rawMax - rawMin + padding * 2, 5);
    const minValue = Math.floor((rawMin - padding) / step) * step;
    const maxValue = Math.ceil((rawMax + padding) / step) * step;
    const x = (date: string) => CHART_PADDING.left + ((timestamp(date) - minTime) / Math.max(1, maxTime - minTime)) * plotWidth;
    const y = (value: number) => CHART_PADDING.top + (1 - (value - minValue) / Math.max(.0001, maxValue - minValue)) * plotHeight;
    const yTicks: number[] = [];
    for (let value = minValue; value <= maxValue + step / 2; value += step) yTicks.push(Number(value.toFixed(8)));
    const xTicks = Array.from({ length: 4 }, (_, index) => minTime + ((maxTime - minTime) * index) / 3);
    const paths = series.map((item) => ({
      ...item,
      path: item.points.map((point, index) => `${index ? "L" : "M"}${x(point.date).toFixed(2)},${y(point.value).toFixed(2)}`).join(" "),
    }));
    const fund = paths.find((item) => item.role === "fund") || paths[0];
    const zeroY = y(0);
    const fundArea = fund ? `${fund.path} L${x(fund.points.at(-1)!.date).toFixed(2)},${zeroY.toFixed(2)} L${x(fund.points[0].date).toFixed(2)},${zeroY.toFixed(2)} Z` : "";
    return { width, height, plotWidth, minTime, maxTime, x, y, yTicks, xTicks, paths, zeroY, fundArea };
  }, [series, size]);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!chart) return;
    const primary = series.find((item) => item.role === "fund") || series[0];
    if (!primary?.points.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * chart.width;
    const boundedX = Math.max(CHART_PADDING.left, Math.min(chart.width - CHART_PADDING.right, svgX));
    const targetTime = chart.minTime + ((boundedX - CHART_PADDING.left) / chart.plotWidth) * (chart.maxTime - chart.minTime);
    const point = primary.points.reduce((best, candidate) => Math.abs(timestamp(candidate.date) - targetTime) < Math.abs(timestamp(best.date) - targetTime) ? candidate : best, primary.points[0]);
    const pointTime = timestamp(point.date);
    const items = series.map((item) => {
      const nearest = item.points.reduce((best, candidate) => Math.abs(timestamp(candidate.date) - pointTime) < Math.abs(timestamp(best.date) - pointTime) ? candidate : best, item.points[0]);
      return { name: item.name, value: nearest.value, role: item.role };
    });
    const pointX = chart.x(point.date);
    const tooltipWidth = Math.min(210, chart.width - 16);
    const proposedLeft = pointX > chart.width * .68 ? pointX - tooltipWidth - 12 : pointX + 12;
    setHovered({ date: point.date, x: pointX, left: Math.max(8, Math.min(chart.width - tooltipWidth - 8, proposedLeft)), items });
  };

  const latestDate = series.flatMap((item) => item.points).map((point) => point.date).sort().at(-1);

  return <article className="card chartCard" id="performance">
    <header className="cardHead chartHead">
      <div><h2><Icon name="chart"/>区间累计收益</h2><p>{valueKind === "money" ? "万份收益折算表现" : "区间起点归一为 0% · 对比同类与业绩基准"}</p></div>
      <div className="rangeSwitch" aria-label="收益曲线区间">
        {(["30", "90", "365", "all"] as Range[]).map((item) => <button type="button" key={item} aria-pressed={range === item} className={range === item ? "active" : ""} onClick={() => { setRange(item); setHovered(null); }}>{RANGE_LABELS[item]}</button>)}
      </div>
    </header>

    <div className="chartContext">
      <div className="performanceLegend">{series.map((item) => {
        const latest = item.points.at(-1)?.value || 0;
        return <span key={`${item.role}-${item.name}`}><i className={item.role}/><b title={item.name}>{item.name}</b><strong className={tone(latest)}>{formatPercent(latest)}</strong></span>;
      })}</div>
      <div className="industryContext"><b>最新行业配置</b>{contextStatus === "loading" ? <span className="contextLoading">读取中…</span> : industries.length ? industries.slice(0, 3).map((item) => <span key={item.name}>{item.name}<em>{item.weight.toFixed(1)}%</em></span>) : <span className="contextEmpty">暂无披露</span>}{industryPeriod && <time>{industryPeriod}</time>}</div>
    </div>

    <div className="performancePlot" ref={plotRef} onPointerLeave={() => setHovered(null)}>
      {chart ? <svg className="performanceSvg" width="100%" height="100%" viewBox={`0 0 ${chart.width} ${chart.height}`} onPointerMove={onPointerMove} role="img" aria-label="当前基金、同类平均和业绩基准的区间累计收益曲线">
        <title>区间累计收益对比</title>
        <desc>所有序列在所选区间起点归一为零，纵轴单位为百分比。</desc>
        <defs><linearGradient id="fund-return-area" x1="0" y1="0" x2="0" y2="1"><stop className="fundAreaStart" offset="0%"/><stop className="fundAreaEnd" offset="100%"/></linearGradient></defs>
        <g className="chartGrid">{chart.yTicks.map((value) => <g key={value}><line className={Math.abs(value) < .0001 ? "zeroLine" : ""} x1={CHART_PADDING.left} x2={chart.width - CHART_PADDING.right} y1={chart.y(value)} y2={chart.y(value)}/><text x={CHART_PADDING.left - 10} y={chart.y(value) + 4} textAnchor="end">{formatAxisPercent(value)}</text></g>)}</g>
        <g className="chartDates">{chart.xTicks.map((value, index) => { const date = new Date(value).toISOString().slice(0, 10); return <text key={value} x={CHART_PADDING.left + (chart.plotWidth * index) / 3} y={chart.height - 9} textAnchor={index === 0 ? "start" : index === 3 ? "end" : "middle"}>{range === "365" || range === "all" ? date.slice(0, 7) : date.slice(5)}</text>; })}</g>
        <path className="fundArea" d={chart.fundArea}/>
        <g className="performanceLines">{[...chart.paths].reverse().map((item) => <path key={`${item.role}-${item.name}`} className={`seriesLine ${item.role}`} d={item.path}/>)}</g>
        <g className="latestMarkers">{chart.paths.map((item) => { const point = item.points.at(-1)!; return <circle key={`${item.role}-${item.name}`} className={item.role} cx={chart.x(point.date)} cy={chart.y(point.value)} r={item.role === "fund" ? 3.5 : 2.5}/>; })}</g>
        {hovered && <g className="chartCrosshair"><line x1={hovered.x} x2={hovered.x} y1={CHART_PADDING.top} y2={chart.height - CHART_PADDING.bottom}/>{hovered.items.map((item) => <circle key={`${item.role}-${item.name}`} className={item.role} cx={hovered.x} cy={chart.y(item.value)} r="4"/>)}</g>}
      </svg> : <div className="emptyChart">暂无可用收益序列</div>}
      {hovered && <div className="performanceTooltip" style={{ left: hovered.left, top: 12 }}><header><time>{hovered.date}</time><small>区间累计收益</small></header>{hovered.items.map((item) => <div key={`${item.role}-${item.name}`}><span><i className={item.role}/><em>{item.name}</em></span><b className={tone(item.value)}>{formatPercent(item.value)}</b></div>)}</div>}
    </div>

    <footer className="chartFootnote"><span>单位：%</span><span>区间收益按所选起始日重新计算</span>{latestDate && <time>数据至 {latestDate}</time>}</footer>
  </article>;
}
