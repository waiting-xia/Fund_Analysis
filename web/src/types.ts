export interface NavPoint {
  date: string;
  nav: number;
  dayGrowth: number | null;
}

export interface PerformancePoint {
  date: string;
  value: number;
}

export interface PerformanceSeries {
  name: string;
  role: "fund" | "peer" | "benchmark";
  points: PerformancePoint[];
}

export interface IndustryAllocation {
  name: string;
  weight: number;
  marketValue: number | null;
  date: string;
}

export interface Holding {
  code: string;
  name: string;
  weight: string;
  shares?: string;
  marketValue: string;
}

export interface HoldingChange {
  code: string;
  name: string;
  exchange?: string;
  weight: number | null;
  changeType: string;
  changeRatio: number | null;
}

export interface FundMetrics {
  return1m: number | null;
  return3m: number | null;
  return1y: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
}

export interface FundScore {
  total: number;
  label: string;
  dataCompleteness: number;
  reasons: string[];
  factors: Array<{
    key: string;
    label: string;
    weight: number;
    score: number;
    detail: string;
  }>;
  action: {
    tone: "positive" | "neutral" | "caution" | "danger";
    title: string;
    steps: string[];
  };
}

export interface FundRealtime {
  code: string;
  officialNav: number;
  accumulatedNav: number;
  officialGrowthPercent: number;
  officialNavDate: string;
  officialSource: string;
  estimatedNav?: number;
  estimatedGrowthPercent?: number;
  estimateTime?: string;
  estimateSource?: string;
  isIntradayEstimate: boolean;
  retrievedAt: string;
  provider: string;
  notice: string;
}

export interface FundData {
  code: string;
  name: string;
  valueKind: "nav" | "money";
  type: string | null;
  company: string | null;
  manager: string | null;
  latest: NavPoint;
  metrics: FundMetrics;
  score: FundScore;
  history: NavPoint[];
  comparisons: PerformanceSeries[];
  holdings: Holding[];
  holdingPeriod: string | null;
  realtime: FundRealtime | null;
  alipay: AlipayFundChannel;
  retrievedAt: string;
  sources: { profile: string; history: string; holdings: string };
}

export interface FundPortfolioResponse {
  code: string;
  holdings: Holding[];
  holdingPeriod: string | null;
  holdingChanges: HoldingChange[];
  holdingChangeNotice?: string;
  industries: IndustryAllocation[];
  industryPeriod: string | null;
  retrievedAt: string;
  sources: { holdings: string; industries: string };
}

export interface AlipayFundChannel {
  provider: string;
  configured: boolean;
  available: boolean;
  message?: string;
  code?: string;
  name?: string;
  type?: string;
  nav?: number | string;
  navDate?: string;
  dailyGrowthPercent?: number | string;
  riskLevel?: string;
  saleStatus?: string;
  feeRate?: number | string;
  retrievedAt?: string;
}

export interface FundSearchItem {
  code: string;
  name: string;
  type: string;
  pinyin?: string;
}

export interface FundSearchResponse {
  query: string;
  funds: FundSearchItem[];
  catalogSize?: number;
  provider: string;
  retrievedAt: string;
}

export interface AIAnalysisResponse {
  analysisContractVersion: 2;
  analysis: string;
  model: string;
  code: string;
  recentInformationCount?: number;
  recentInformationAsOf?: string | null;
  knowledgeCount?: number;
  knowledgeSources?: string[];
  actionRecommendation: {
    action: "买入" | "持有" | "减仓" | "卖出";
    confidence: "高" | "中" | "低";
    perspective: "持仓视角" | "未持仓视角";
  };
}

export interface RealtimeQuote {
  name: string;
  code: string;
  now: number;
  open: number;
  low: number;
  high: number;
  volume: number;
  amount: number;
  change: number;
  percent: number;
  yesterday: number;
  source?: string;
}

export interface SecurityQuote {
  code: string;
  name: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  volume: number | null;
  amount: number | null;
}

export interface SecurityQuotesResponse {
  quotes: SecurityQuote[];
  retrievedAt: string;
  source?: string;
  notice: string;
}

export interface RealtimeMarketResponse {
  provider: string;
  session: {
    region: "cn" | "us";
    name: string;
    timeZone: "Asia/Shanghai" | "America/New_York";
    phase: "pre" | "open" | "break" | "closed" | "weekend";
    phaseLabel: string;
    isOpen: boolean;
    localTime: string;
    chinaTime: string;
    newYorkTime: string;
  };
  quotes: RealtimeQuote[];
  retrievedAt: string;
  notice: string;
  totalAmount: number;
  capitalFlow: {
    latest: null | {
      time: string;
      mainNet: number;
      smallNet: number;
      mediumNet: number;
      largeNet: number;
      superLargeNet: number;
    };
    points: Array<{ time: string; mainNet: number }>;
    unit: string;
  };
  northbound: {
    available: boolean;
    northbound: null | {
      time: string;
      routeOneNet: number | null;
      routeOneBalance: number | null;
      routeTwoNet: number | null;
      routeTwoBalance: number | null;
      total: number | null;
    };
    unit: string;
    notice: string;
  };
  sectors: Array<{
    code: string;
    name: string;
    netInflow: number | null;
    changePercent: number | null;
  }>;
}

export interface WatchFund {
  code: string;
  name: string;
  type: string;
  date: string;
  nav: number | null;
  dayGrowth: number | null;
  source: string;
}

export interface WatchlistResponse {
  funds: WatchFund[];
  provider: string;
  retrievedAt: string;
}

export interface RiskWorkspaceResponse {
  funds: Array<{
    code: string;
    name: string;
    metrics: FundMetrics;
    score: FundScore;
  }>;
  correlation: {
    labels: string[];
    matrix: Array<Array<number | null>>;
    observationDays: number;
  };
  highCorrelationPairs: Array<{
    leftCode: string;
    rightCode: string;
    leftName: string;
    rightName: string;
    value: number;
  }>;
  retrievedAt: string;
  notice: string;
}

export interface IndustryValuation {
  code: string;
  name: string;
  sourceIndustry: string;
  price: number | null;
  changePercent: number | null;
  turnoverRate: number | null;
  pe: number | null;
  pb: number | null;
  pePercentile: number | null;
  pbPercentile: number | null;
  valuationPercentile: number | null;
  pricePosition1y: number | null;
  return1y: number | null;
}

export interface HoldingValuationSecurity {
  code: string;
  name: string;
  weight: number;
  price: number | null;
  changePercent: number | null;
  pe: number | null;
  peKind: "TTM" | "动态" | null;
  pb: number | null;
}

export interface HoldingsValuation {
  available: boolean;
  pe: number | null;
  pb: number | null;
  peLabel: string;
  coverage: number;
  peCoverage: number;
  pbCoverage: number;
  disclosedWeight: number;
  method: string;
  securities: HoldingValuationSecurity[];
  retrievedAt: string;
  source: string;
  notice: string;
}

export interface ValuationResponse {
  code: string;
  mode: "industry" | "holdings" | "unavailable";
  industries: IndustryValuation[];
  holdingsValuation: HoldingsValuation | null;
  industryDeferred: boolean;
  fundNavContext: {
    position1y: number | null;
    return1y: number | null;
    startDate: string | null;
    endDate: string | null;
  };
  retrievedAt: string;
  source: string;
  notice: string;
}

export interface NewsItem {
  type: "announcement" | "news";
  category: string;
  title: string;
  summary: string;
  publishedAt: string;
  source: string;
  url: string;
  fundCode: string;
  fundName: string;
  severity: "high" | "medium" | "low";
  relevance: number;
  reason: string;
}

export interface NewsWorkspaceResponse {
  items: NewsItem[];
  mode: string;
  modelConfigured: boolean;
  retrievedAt: string;
  notice: string;
}

export interface GeneratedReport {
  id: string;
  type: "morning" | "evening";
  title: string;
  trigger: "manual" | "schedule";
  generatedAt: string;
  summary: string;
  alerts: string[];
  actions: Array<{ code: string; name: string; signal: string; steps: string[] }>;
  sources: string[];
  notice: string;
}

export interface ReportsResponse {
  schedules: Array<{ type: "morning" | "evening"; label: string; time: string; enabled: boolean }>;
  reports: GeneratedReport[];
  timezone: string;
  serverDate: string;
  retrievedAt: string;
  notice: string;
  report?: GeneratedReport;
}

export interface McpProviderStatus {
  provider: "eastmoney" | "ifind" | "alipay";
  connected: boolean;
  configured: boolean;
  tools: string[];
  error?: string;
}

export interface McpStatusResponse {
  providers: McpProviderStatus[];
  checkedAt: string;
}
