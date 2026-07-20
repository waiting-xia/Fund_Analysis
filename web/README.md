# 观澜 Fund Intelligence

面向中国公募基金的 npm Web 应用。前端使用 React 19 + TypeScript + Vite，Node 服务端通过 Python MCP 获取东方财富-天天基金公开数据，并通过 OpenAI Chat Completions 兼容协议连接可配置智能模型或第三方中转站。

## 功能

- 市场数据监控：按 A 股/美股常规交易时段自动切换；A 股展示核心指数和资金流，美股展示道琼斯、标普 500、纳斯达克及盘中区间
- 4 只持仓基金：批量正式净值、日涨跌、单基金详细收益和公开持仓变化；查询新基金后可替换任意监控位
- 智能新闻：基金公告与相关资讯的关键词筛选；配置模型后增加 LLM 分级复核
- 估值分析：先按最近公开重仓股返回真实 PE/PB 穿透值与覆盖率，再后台补行业/指数横截面对比；上游缺失时不补造数据
- 风险管理：年化波动率、最大回撤、4 基金相关性矩阵
- 5 因子信号：短期动量、中期趋势、年度表现、波动控制、回撤韧性
- 智能分析：近期公告、新闻、净值、估值和持仓联合分析
- 自动日报：交易日 08:00 早间简报、19:00 晚间完整日报；支持手动即时生成

## 配置

所有环境变量集中放在项目根目录 `E:\PythonLearn\Agent\funding\.env`：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=claude-sonnet-4-5
OPENAI_CHAT_COMPLETIONS_URL=
OPENAI_AUTH_HEADER=Authorization
OPENAI_AUTH_SCHEME=Bearer
OPENAI_EXTRA_HEADERS_JSON={}
OPENAI_TIMEOUT_MS=90000

MCP_PYTHON_EXECUTABLE=D:\software\Anaconda\envs\Python_310\python.exe
FUND_WATCHLIST_CODES=510300,161725,005827,110011

IFIND_ACCESS_TOKEN=
IFIND_REFRESH_TOKEN=
ALIPAY_FUND_API_URL=
ALIPAY_FUND_API_KEY=
```

`OPENAI_BASE_URL` 可以填写支持 OpenAI Chat Completions 协议的第三方中转站 `/v1` 地址；模型名称按中转站实际提供的模型填写。页面中的 4 个监控位都可替换并保存在当前浏览器；服务端定时日报持仓读取 `FUND_WATCHLIST_CODES`。

## 启动

开发模式：

```powershell
cd E:\PythonLearn\Agent\funding\web
npm.cmd run dev
```

生产模式：

```powershell
cd E:\PythonLearn\Agent\funding\web
npm.cmd run build
npm.cmd start
```

开发模式默认前端为 `http://localhost:5173`、API 为 `http://localhost:8787`。若端口被占用，请先结束旧进程，避免 Vite 自动切换端口后 API 仍因 `8787` 冲突退出。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:mcp-live
npm.cmd run test:live
```

实时测试会联网读取东方财富公开接口，但不会启动 Web 服务。

## 数据口径

- 基金正式净值与盘中估算值分开显示；实际收益以基金公司正式净值为准。
- 持仓变化来自相邻公开报告期，不是基金实时交易流水。
- 北向资金仅在公开接口返回有效净额时显示；固定额度余额不会被当成净流入。
- PE/PB 或历史样本缺失时返回空值，不生成模拟数据。
- 所有量化信号和模型分析仅供研究参考，不构成投资建议。
