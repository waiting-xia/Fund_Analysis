import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { fetchAIAnalysis, fetchAIChat } from "../api";
import { Icon } from "./Icon";
import type { AIAnalysisResponse, AIChatMessage, InvestorMemory } from "../types";

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

interface ConversationMessage extends AIChatMessage {
  id: string;
}

const suggestedQuestions = [
  "当前建议最关键的三项依据是什么？",
  "什么条件出现时需要调整当前操作？",
  "重仓股波动会怎样传导到基金净值？",
];

const MEMORY_STORAGE_KEY = "guanlan:investor-memory:v1";
const MEMORY_QUERY_KEY = "guanlan:investor-memory:last-query";
const DEFAULT_INVESTOR_MEMORY: InvestorMemory = {
  version: 1,
  riskPreference: "稳健",
  investmentHorizon: "中长期",
  executionPreference: "分批交易",
  frequentSectors: [],
};

function loadInvestorMemory(): InvestorMemory {
  try {
    const stored = JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || "null") as Partial<InvestorMemory> | null;
    if (!stored) return DEFAULT_INVESTOR_MEMORY;
    return {
      version: 1,
      riskPreference: ["保守", "稳健", "进取"].includes(String(stored.riskPreference))
        ? stored.riskPreference as InvestorMemory["riskPreference"]
        : DEFAULT_INVESTOR_MEMORY.riskPreference,
      investmentHorizon: ["短线", "波段", "中长期"].includes(String(stored.investmentHorizon))
        ? stored.investmentHorizon as InvestorMemory["investmentHorizon"]
        : DEFAULT_INVESTOR_MEMORY.investmentHorizon,
      executionPreference: ["分批交易", "定投为主", "一次性交易"].includes(String(stored.executionPreference))
        ? stored.executionPreference as InvestorMemory["executionPreference"]
        : DEFAULT_INVESTOR_MEMORY.executionPreference,
      frequentSectors: Array.isArray(stored.frequentSectors)
        ? stored.frequentSectors
          .map((item) => ({ name: String(item?.name || "").slice(0, 30), count: Math.max(1, Number(item?.count) || 1) }))
          .filter((item) => item.name)
          .slice(0, 8)
        : [],
    };
  } catch {
    return DEFAULT_INVESTOR_MEMORY;
  }
}

function persistInvestorMemory(memory: InvestorMemory) {
  try { localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory)); } catch { /* browser storage may be disabled */ }
}

function actionTone(action: ActionRecommendation["action"]) {
  return action === "买入" ? "buy" : action === "持有" ? "hold" : action === "减仓" ? "reduce" : "sell";
}

function analysisWithoutDecisionHeader(content: string) {
  return content
    .replace(/^\s*操作建议\s*[：:].*$/m, "")
    .replace(/^\s*建议置信度\s*[：:].*$/m, "")
    .trim();
}

export function AIAnalysis({ code, isHeld, sectors = [] }: { code: string; isHeld: boolean; sectors?: string[] }) {
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
  const [chatMessages, setChatMessages] = useState<ConversationMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [memory, setMemory] = useState<InvestorMemory>(loadInvestorMemory);
  const recordedSectorQuery = useRef(false);
  const sectorKey = sectors.slice(0, 3).join("|");

  useEffect(() => {
    if (recordedSectorQuery.current || !sectorKey) return;
    recordedSectorQuery.current = true;
    try {
      const lastQuery = JSON.parse(localStorage.getItem(MEMORY_QUERY_KEY) || "null") as { code?: string; recordedAt?: number } | null;
      if (lastQuery?.code === code && Date.now() - Number(lastQuery.recordedAt || 0) < 30 * 60 * 1000) return;
      const timer = window.setTimeout(() => {
        setMemory((current) => {
          const counts = new Map(current.frequentSectors.map((item) => [item.name, item.count]));
          for (const sector of sectorKey.split("|")) {
            const normalized = sector.trim().slice(0, 30);
            if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
          }
          const next = {
            ...current,
            frequentSectors: [...counts.entries()]
              .map(([name, count]) => ({ name, count }))
              .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"))
              .slice(0, 8),
          };
          persistInvestorMemory(next);
          return next;
        });
        localStorage.setItem(MEMORY_QUERY_KEY, JSON.stringify({ code, recordedAt: Date.now() }));
      }, 0);
      return () => window.clearTimeout(timer);
    } catch { /* browser storage may be disabled */ }
  }, [code, sectorKey]);

  const updateMemory = <Key extends "riskPreference" | "investmentHorizon" | "executionPreference">(
    key: Key,
    value: InvestorMemory[Key],
  ) => {
    setMemory((current) => {
      const next = { ...current, [key]: value };
      persistInvestorMemory(next);
      return next;
    });
  };

  const run = async () => {
    setStatus("loading");
    setError("");
    setChatMessages([]);
    setChatInput("");
    setChatError("");
    try {
      const result = await fetchAIAnalysis(code, isHeld, memory);
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

  const sendQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question || chatSending || status !== "done") return;
    const userMessage: ConversationMessage = { id: `user-${Date.now()}`, role: "user", content: question };
    const nextVisibleMessages = [...chatMessages, userMessage];
    setChatMessages(nextVisibleMessages);
    setChatInput("");
    setChatSending(true);
    setChatError("");
    try {
      const history: AIChatMessage[] = [
        ...(analysis ? [{ role: "assistant" as const, content: analysis }] : []),
        ...nextVisibleMessages.map(({ role, content }) => ({ role, content })),
      ].slice(-12);
      const result = await fetchAIChat(code, isHeld, history, memory);
      setChatMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.reply,
      }]);
      setModel(result.model);
      setInformationMeta((current) => ({
        count: result.recentInformationCount ?? current.count,
        asOf: result.recentInformationAsOf ?? current.asOf,
        knowledgeCount: result.knowledgeCount ?? current.knowledgeCount,
        knowledgeSources: result.knowledgeSources ?? current.knowledgeSources,
      }));
    } catch (reason) {
      setChatError(reason instanceof Error ? reason.message : "对话服务暂时不可用");
    } finally {
      setChatSending(false);
    }
  };

  const handleChatKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
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

    <section className="aiMemory">
      <header><div><Icon name="bookmark"/><span><b>投资偏好记忆</b><small>保存在当前浏览器，每轮分析自动调用</small></span></div><em>LONG-TERM MEMORY</em></header>
      <div className="aiMemorySettings">
        <label><span>风险偏好</span><select value={memory.riskPreference} onChange={(event) => updateMemory("riskPreference", event.target.value as InvestorMemory["riskPreference"])}><option>保守</option><option>稳健</option><option>进取</option></select></label>
        <label><span>投资周期</span><select value={memory.investmentHorizon} onChange={(event) => updateMemory("investmentHorizon", event.target.value as InvestorMemory["investmentHorizon"])}><option>短线</option><option>波段</option><option>中长期</option></select></label>
        <label><span>买卖方式</span><select value={memory.executionPreference} onChange={(event) => updateMemory("executionPreference", event.target.value as InvestorMemory["executionPreference"])}><option>分批交易</option><option>定投为主</option><option>一次性交易</option></select></label>
        <div className="aiMemorySectors"><span>常查板块</span><div>{memory.frequentSectors.length ? memory.frequentSectors.slice(0, 5).map((sector) => <i key={sector.name}>{sector.name}<small>{sector.count}</small></i>) : <em>查询基金后自动积累</em>}</div></div>
      </div>
      <p><Icon name="info"/>模型会据此调整分批比例、观察周期和触发条件；偏好与风险冲突时仍以风险约束优先。</p>
    </section>

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
      <section className="aiConversation">
        <header>
          <div><span><Icon name="sparkles"/></span><div><small>CONTEXTUAL DIALOGUE</small><h4>追问当前研究结论</h4></div></div>
          <p>每轮重新校验基金数据、近期信息与金融理论</p>
        </header>
        {chatMessages.length === 0 ? <div className="aiConversationEmpty">
          <p>可以继续询问建议依据、风险传导、持仓影响或操作失效条件。</p>
          <div>{suggestedQuestions.map((question) => <button key={question} type="button" onClick={() => setChatInput(question)}>{question}<Icon name="arrowRight"/></button>)}</div>
        </div> : <div className="aiMessageList" aria-live="polite">
          {chatMessages.map((message) => <article key={message.id} className={message.role}>
            <span>{message.role === "assistant" ? <Icon name="sparkles"/> : "你"}</span>
            <div><small>{message.role === "assistant" ? "研究助手" : "我的问题"}</small><p>{message.content}</p></div>
          </article>)}
          {chatSending && <article className="assistant pending"><span><Icon name="sparkles"/></span><div><small>研究助手</small><p><i className="spinner"/>正在更新上下文并生成回答…</p></div></article>}
        </div>}
        <form onSubmit={sendQuestion}>
          <textarea
            aria-label="输入关于当前基金的问题"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleChatKeyDown}
            maxLength={1200}
            rows={3}
            placeholder="例如：如果半导体板块继续回调，当前建议是否需要调整？"
          />
          <div><small>{chatError || "Enter 发送 · Shift + Enter 换行 · 不会自动执行交易"}</small><button type="submit" disabled={!chatInput.trim() || chatSending}>{chatSending ? "分析中" : "发送问题"}<Icon name="arrowRight"/></button></div>
        </form>
      </section>
    </div>}

    {status === "error" && <div className="aiError">
      <span><Icon name="alert"/></span>
      <div><small>ANALYSIS REQUEST FAILED</small><b>智能分析暂不可用</b><p>{error}</p></div>
      <button type="button" onClick={run}><Icon name="refresh"/>重新尝试</button>
    </div>}
  </article>;
}
