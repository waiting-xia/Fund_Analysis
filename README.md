# 基金分析智能体

面向中国公募基金的研究辅助智能体。首期聚焦“有来源、可复算、可解释”的基金分析，不执行交易，也不输出无依据的买卖指令。

```
<img width="1906" height="823" alt="image" src="https://github.com/user-attachments/assets/e098e8d3-0b12-4506-9761-2954549efde9" />
<img width="1848" height="716" alt="image" src="https://github.com/user-attachments/assets/3d48aad9-2cac-4f24-adba-3223fd79638e" />


```

##  能力

1. 按基金代码查询基本信息、净值、规模、费率、基金经理与持仓。
2. 计算区间收益、年化波动、最大回撤、夏普、卡玛、下行风险和相对基准指标。
3. 做同类基金对比、风格与行业暴露、重仓重合度和简单持仓穿透。
4. 汇总公告、定期报告与可信新闻，所有事实保留来源和时间。
5. 生成结构化研究报告，明确区分事实、计算结果、推断和不确定性。

## 调研与设计

- [GitHub 项目与 Skill 调研](docs/github-research.md)
- [MVP 架构与实施路线](docs/mvp-architecture.md)
- [核心功能产品需求](docs/product-requirements.md)

## 基本原则

- 数据必须携带来源、抓取时间、统计口径和复权方式。
- 数值由确定性代码计算，语言模型负责解释和组织，不心算关键指标。
- 缺失或冲突数据必须显式提示，不以估算值冒充事实。
- 输出仅供研究参考，重要结论需人工复核。

## 当前实现

第一版 LangGraph MVP 已可离线运行，包含：

- 请求校验和数据质量检查。
- 市场、基金、新闻、估值、风险、资金与持仓变化的并行分析节点。
- 五因子研究信号和可替换的 LLM 深度分析接口。
- 本地金融理论 RAG：Markdown 知识文档、SQLite 索引、中文混合检索和 Python MCP。
- Markdown 日报生成与内存 checkpoint。
- 固定样例数据和标准库单元测试。

当前使用离线样例基金 `510300`。模型层采用 OpenAI 兼容的 `v1/chat/completions` 协议；未配置密钥时自动使用确定性分析，不影响离线运行。

## 前端界面

已增加“观澜基金研究台”查询界面。公开基金查询由边缘 Worker 实时读取公开基金数据，并计算区间收益、年化波动率、最大回撤和量化研究评分。

- 支持输入六位公募基金代码查询；已验证 `510300`、`000001`、`161725`。
- 净值和持仓来自公开数据源，页面显示抓取时间、净值日期、持仓披露期和来源链接。
- 数据源异常时明确报错，不使用模拟值补位。
- 前端源码位于 `web/`，采用 React + TypeScript + Vite；Node.js 服务同时提供静态页面和基金 API。
- 基金搜索使用东方财富全量目录；蚂蚁财富基金信息通过机构签约接口适配器接入，未授权时不会抓取支付宝 App 私有数据。

## 运行

项目使用已有的 Anaconda `Python_310` 环境：

所有模型、MCP、同花顺和 Web 端口配置统一填写在项目根目录 `.env`。第一次使用可参考同目录 `.env.example`；Node 服务、Python MCP 和 LangGraph CLI 都会自动读取，不需要分别设置环境变量。

```powershell
conda activate Python_310
$env:PYTHONPATH="$PWD\src"
python -m fund_agent.cli 510300 --report-type evening
```

启用模型深度分析时，编辑根目录 `.env`：

```env
OPENAI_API_KEY=你的服务端密钥
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4-mini
```

保存后直接运行 `python -m fund_agent.cli 510300 --report-type evening`。`OPENAI_BASE_URL` 和 `OPENAI_MODEL` 均可替换，因此也兼容实现 OpenAI Chat Completions 协议的其他模型服务。密钥只能配置在根目录 `.env`，不得写进网页代码。

## 金融理论 RAG 知识库

知识原文位于 `knowledge/finance-theory/`，当前覆盖基金分析、组合风险、估值、宏观政策、多因子和行为周期。索引保存在 `data/rag/knowledge.sqlite3`，由源码自动重建，不需要提交数据库文件，也不需要额外 API Key。

```powershell
cd web
npm.cmd run rag:build
npm.cmd run rag:status
conda run --no-capture-output -n Python_310 python mcp/rag_admin.py search "利率上升如何影响成长基金估值" --top-k 5
```

编辑或新增 Markdown 后，下一次检索会根据内容哈希自动更新索引。网页智能分析和 LangGraph 都会检索相关理论；这些段落会被标记为“通用理论”，不得替代基金的当前净值、持仓、公告或行情事实。编写格式与维护规则见 `knowledge/README.md`。

也可以直接运行：

```powershell
.\scripts\run_agent.cmd 510300 evening
```

运行测试：

```powershell
conda activate Python_310
$env:PYTHONPATH="$PWD\src"
python -m unittest discover -s tests -v
```

## Agent流程

```text
请求校验 -> 数据采集 -> 数据质量检查 -> 金融理论检索
                                            ├─ 市场分析 ───────┐
                                            ├─ 基金跟踪 ───────┤
                                            ├─ 新闻过滤 ───────┤
                                            ├─ 估值分析 ───────┼─> 五因子评分 -> 深度分析 -> 报告
                                            ├─ 风险分析 ───────┤
                                            └─ 资金与持仓分析 ─┘
```
