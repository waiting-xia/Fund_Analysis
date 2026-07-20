import { useState } from "react";
import { fetchAIAnalysis } from "../api";
import { Icon } from "./Icon";
import type { AIAnalysisResponse } from "../types";

type AnalysisStatus = "idle" | "loading" | "done" | "error";

interface InformationMeta {
  count: number;
  asOf?: string | null;
  knowledgeCount: number;
  knowledgeSources: string[];
}

const researchSteps = [
  { index: "01", icon: "database" as const, title: "事实证据", detail: "近期公告、新闻与净值" },
  { index: "02", icon: "holdings" as const, title: "组合画像", detail: "估值、风险与公开持仓" },
  { index: "03", icon: "layers" as const, title: "理论检索", detail: "本地金融理论 RAG" },
  { index: "04", icon: "target" as const, title: "操作结论", detail: "买入 / 持有 / 减仓 / 卖出" },
];

type ActionRecommendation = AIAnalysisResponse["actionRecommendation"];

function actionTone(action: ActionRecommendation["action"]) {
  return action === "买入" ? "buy" : action === "持有" ? "hold" : action === "减仓" ? "reduce" : "sell";
}

function analysisWithoutDecisionHeader(content: string) {
  return content
    .replace(/^\s*操作建议\s*[：:].*$/m, "")
    .replace(/^\s*建议置信度\s*[：:].*$/m, "")
    .trim();
}

export function AIAnalysis({ code, isHeld }: { code: string; isHeld: boolean }) {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [analysis, setAnalysis] = useState("");
  const [model, setModel] = useState("OpenAI-compatible");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [recommendation, setRecommendation] = useState<ActionRecommendation | null>(null);
  const [informationMeta, setInformationMeta] = useState<InformationMeta>({
    count: 0,
    knowledgeCount: 0,
    knowledgeSources: [],
  });
  const [error, setError] = useState("");

  const run = async () => {
    setStatus("loading");
    setError("");
    try {
      const result = await fetchAIAnalysis(code, isHeld);
      setAnalysis(result.analysis);
      setRecommendation(result.actionRecommendation);
      setModel(result.model);
      setGeneratedAt(new Date());
      setInformationMeta({
        count: result.recentInformationCount || 0,
        asOf: result.recentInformationAsOf,
        knowledgeCount: result.knowledgeCount || 0,
        knowledgeSources: result.knowledgeSources || [],
      });
      setStatus("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "模型服务暂时不可用");
      setStatus("error");
    }
  };

  return <article className="aiWorkbench" id="ai-panel">
    <header className="aiWorkbenchHead">
      <div className="aiResearchTarget">
        <span className="aiFundCode">{code}</span>
        <div><small>研究对象</small><b>当前基金证据工作区</b></div>
      </div>
      <div className="aiEngineMeta">
        <small>分析引擎</small>
        <span><i/>{model}</span>
      </div>
    </header>

    {status === "idle" && <div className="aiIdleLayout">
      <section className="aiBrief">
        <span className="aiKicker">RESEARCH BRIEF</span>
        <h3>基于当前公开证据，生成结构化研究判断</h3>
        <p>系统按证据层级组织数据、理论与推断，不使用知识库内容替代基金的最新事实。</p>
        <div className="aiPipeline">
          {researchSteps.map((step) => <article key={step.index}>
            <div><span>{step.index}</span><Icon name={step.icon}/></div>
            <b>{step.title}</b>
            <small>{step.detail}</small>
          </article>)}
        </div>
      </section>

      <aside className="aiActionPanel">
        <span className="aiActionLabel">本次分析范围</span>
        <dl>
          <div><dt>数据边界</dt><dd>当前基金与最新公开信息</dd></div>
          <div><dt>操作结论</dt><dd>买入 / 持有 / 减仓 / 卖出四选一</dd></div>
          <div><dt>执行约束</dt><dd>分批方式 / 观察周期 / 失效条件</dd></div>
          <div><dt>引用规范</dt><dd>标记资讯来源与理论章节</dd></div>
        </dl>
        <button type="button" onClick={run}>开始深度分析<Icon name="arrowRight"/></button>
        <small><Icon name="shield"/>模型会给出明确研究动作，但不会自动执行交易</small>
      </aside>
    </div>}

    {status === "loading" && <div className="aiLoadingPanel">
      <div className="aiLoadingTitle"><span className="spinner"/><div><b>正在构建研究上下文</b><p>读取近期信息、匹配理论知识并校验数据边界</p></div></div>
      <div className="aiLoadingTrack"><i/></div>
      <ol><li>整理公开数据</li><li>检索理论框架</li><li>生成研究结论</li></ol>
    </div>}

    {status === "done" && <div className="aiResult">
      <div className="aiResultTop">
        <div><span className="aiKicker">RESEARCH OUTPUT</span><h3>结构化研究结论</h3></div>
        {generatedAt && <time>{generatedAt.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</time>}
      </div>
      {recommendation && <section className={`aiDecision ${actionTone(recommendation.action)}`}>
        <div className="aiDecisionPrimary"><span>当前操作建议</span><strong>{recommendation.action}</strong></div>
        <dl><div><dt>建议置信度</dt><dd>{recommendation.confidence}</dd></div><div><dt>判断视角</dt><dd>{recommendation.perspective}</dd></div></dl>
        <small><Icon name="info"/>基于当前公开数据与模型推理，不会自动执行交易</small>
      </section>}
      <div className="aiEvidenceStack">
        {informationMeta.count > 0 && <div className="aiEvidence"><Icon name="database"/><span><b>{informationMeta.count} 条公开信息</b>{informationMeta.asOf ? `最新至 ${informationMeta.asOf.slice(0, 10)}` : "已完成时点校验"}</span></div>}
        {informationMeta.knowledgeCount > 0 && <div className="aiEvidence"><Icon name="layers"/><span><b>{informationMeta.knowledgeCount} 条理论依据</b>{informationMeta.knowledgeSources.length ? informationMeta.knowledgeSources.slice(0, 3).join("、") : "本地金融理论知识库"}</span></div>}
      </div>
      <div className="ai-content">{analysisWithoutDecisionHeader(analysis)}</div>
      <footer className="aiResultActions"><small>结论基于本次数据快照，数据变化后应重新评估。</small><button type="button" onClick={run}><Icon name="refresh"/>重新分析</button></footer>
    </div>}

    {status === "error" && <div className="aiError">
      <span><Icon name="alert"/></span>
      <div><small>ANALYSIS REQUEST FAILED</small><b>智能分析暂不可用</b><p>{error}</p></div>
      <button type="button" onClick={run}><Icon name="refresh"/>重新尝试</button>
    </div>}
  </article>;
}
