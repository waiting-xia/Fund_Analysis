import type { AIAnalysisResponse, AlipayFundChannel, FundData, FundPortfolioResponse, FundRealtime, FundSearchResponse, McpStatusResponse, NewsWorkspaceResponse, RealtimeMarketResponse, ReportsResponse, RiskWorkspaceResponse, SecurityQuotesResponse, ValuationResponse, WatchlistResponse } from "./types";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
  return payload;
}

export async function fetchFund(code: string, signal?: AbortSignal): Promise<FundData> {
  const response = await fetch(`/api/fund?code=${encodeURIComponent(code)}`, { signal });
  return readJson<FundData>(response);
}

export async function searchFunds(query: string, signal?: AbortSignal): Promise<FundSearchResponse> {
  const response = await fetch(`/api/fund/search?q=${encodeURIComponent(query)}`, { signal, cache: "no-store" });
  return readJson<FundSearchResponse>(response);
}

export async function fetchFundRealtime(code: string, signal?: AbortSignal): Promise<FundRealtime> {
  const response = await fetch(`/api/fund/realtime?code=${encodeURIComponent(code)}`, { signal, cache: "no-store" });
  return readJson<FundRealtime>(response);
}

export async function fetchFundPortfolio(code: string, signal?: AbortSignal): Promise<FundPortfolioResponse> {
  const response = await fetch(`/api/fund/portfolio?code=${encodeURIComponent(code)}`, { signal });
  return readJson<FundPortfolioResponse>(response);
}

export async function fetchAlipayFund(code: string, signal?: AbortSignal): Promise<AlipayFundChannel> {
  const response = await fetch(`/api/fund/alipay?code=${encodeURIComponent(code)}`, { signal, cache: "no-store" });
  return readJson<AlipayFundChannel>(response);
}

export async function fetchAIAnalysis(code: string, isHeld: boolean, signal?: AbortSignal): Promise<AIAnalysisResponse> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, isHeld }),
    signal,
  });
  const result = await readJson<AIAnalysisResponse>(response);
  if (result.analysisContractVersion !== 2 || !result.actionRecommendation?.action) {
    throw new Error("分析服务仍在运行旧版本，请停止当前进程后重新执行 npm.cmd run dev");
  }
  return result;
}

export async function fetchRealtimeMarket(signal?: AbortSignal): Promise<RealtimeMarketResponse> {
  const response = await fetch("/api/market/dashboard", { signal, cache: "no-store" });
  return readJson<RealtimeMarketResponse>(response);
}

export async function fetchSecurityQuotes(codes: string[], signal?: AbortSignal): Promise<SecurityQuotesResponse> {
  const response = await fetch(`/api/realtime/stocks?codes=${encodeURIComponent(codes.join(","))}`, { signal, cache: "no-store" });
  return readJson<SecurityQuotesResponse>(response);
}

function codesQuery(codes: string[]) {
  return encodeURIComponent(codes.join(","));
}

export async function fetchWatchlist(codes: string[], signal?: AbortSignal): Promise<WatchlistResponse> {
  const response = await fetch(`/api/funds/watchlist?codes=${codesQuery(codes)}`, { signal, cache: "no-store" });
  return readJson<WatchlistResponse>(response);
}

export async function fetchRiskWorkspace(codes: string[], signal?: AbortSignal): Promise<RiskWorkspaceResponse> {
  const response = await fetch(`/api/funds/risk?codes=${codesQuery(codes)}`, { signal });
  return readJson<RiskWorkspaceResponse>(response);
}

export async function fetchValuation(code: string, signal?: AbortSignal, includeIndustry = false): Promise<ValuationResponse> {
  const response = await fetch(`/api/fund/valuation?code=${encodeURIComponent(code)}${includeIndustry ? "&includeIndustry=1" : ""}`, { signal });
  return readJson<ValuationResponse>(response);
}

export async function fetchFundNews(codes: string[], signal?: AbortSignal): Promise<NewsWorkspaceResponse> {
  const response = await fetch(`/api/funds/news?codes=${codesQuery(codes)}`, { signal });
  return readJson<NewsWorkspaceResponse>(response);
}

export async function fetchReports(codes: string[], signal?: AbortSignal): Promise<ReportsResponse> {
  const response = await fetch(`/api/reports?codes=${codesQuery(codes)}`, { signal, cache: "no-store" });
  return readJson<ReportsResponse>(response);
}

export async function generateReport(codes: string[], type: "morning" | "evening", signal?: AbortSignal): Promise<ReportsResponse> {
  const response = await fetch("/api/reports/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ codes, type }),
    signal,
  });
  return readJson<ReportsResponse>(response);
}

export async function fetchMcpStatus(signal?: AbortSignal): Promise<McpStatusResponse> {
  const response = await fetch("/api/mcp/status", { signal, cache: "no-store" });
  return readJson<McpStatusResponse>(response);
}
