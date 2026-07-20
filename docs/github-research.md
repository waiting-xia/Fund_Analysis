# GitHub 项目与 Skill 调研

调研快照：2026-07-11。GitHub 的活跃度、版本与接口会变化，接入前应再次核对。

## 结论

建议以 **AKShare + pandas/NumPy + QuantStats** 完成首个可用版本；组合优化在第二阶段引入 **skfolio**。智能体工作流参考 FinRobot 的“数据—分析—审校—报告”分层，但不要直接搬用其偏美股的整套数据源与估值流程。

领域能力不宜完全依赖第三方 skill。公开金融 skills 大多偏股票、投行或财富管理，针对中国公募基金的净值口径、基金分类、持仓披露滞后和基准比较仍需自建。

## 推荐参考仓库

| 优先级 | 仓库 | 可借鉴内容 | 使用建议与边界 | 许可 |
|---|---|---|---|---|
| P0 | [akfamily/akshare](https://github.com/akfamily/akshare) | 中国基金、指数和宏观等数据接口 | MVP 主数据入口；上游网页接口可能变化，必须加缓存、字段校验和降级策略 | MIT |
| P0 | [ranaroussi/quantstats](https://github.com/ranaroussi/quantstats) | 收益、波动、回撤、滚动指标与 tear sheet | 复用绩效计算与报告思路；统一交易日、无风险利率和年化因子后再比较 | Apache-2.0 |
| P1 | [skfolio/skfolio](https://github.com/skfolio/skfolio) | 组合优化、风险管理、交叉验证和压力测试 | 第二阶段用于组合与基金篮子；避免把样本内最优当成投资结论 | BSD-3-Clause |
| P1 | [PyPortfolio/PyPortfolioOpt](https://github.com/PyPortfolio/PyPortfolioOpt) | 均值方差、Black-Litterman、HRP | 与 skfolio 二选一作为首个优化引擎，不建议 MVP 同时引入两套 | MIT |
| P1 | [AI4Finance-Foundation/FinRobot](https://github.com/AI4Finance-Foundation/FinRobot) | 金融多智能体分工、数据工具、量化分析和报告生成 | 参考架构，不直接照搬；其公开示例主要面向股票研究且依赖外部 API | Apache-2.0 |
| P2 | [OpenBB-finance/OpenBB](https://github.com/OpenBB-finance/OpenBB) | 面向分析师和智能体的多源金融数据平台 | 需要扩展到海外 ETF、宏观与机构数据时再评估，MVP 可能偏重 | AGPL-3.0（接入前复核） |
| P2 | [microsoft/qlib](https://github.com/microsoft/qlib) | AI 量化研究、数据集与模型实验流程 | 更适合预测研究平台，不是基金分析 MVP 的必要依赖 | MIT |
| 参考 | [anthropics/financial-services](https://github.com/anthropics/financial-services) | 金融分析、股票研究、财富管理的 agent/skill 组织方式 | 只借鉴工作流和 skill 拆分；不能直接替代中国公募基金规则 | Apache-2.0 |

## Codex 官方可安装 Skills

以下来自本次读取的 `openai/skills` curated 清单。当前只建议安装与 MVP 直接相关的项，不要一次性安装全部。

| Skill | 阶段 | 用途 |
|---|---|---|
| `jupyter-notebook` | 立即 | 探索基金接口、验证指标口径、形成可复算研究笔记 |
| `pdf` | 立即 | 读取基金招募说明书、季报、半年报和年报，并生成报告 |
| `playwright` | 可选 | 当公开页面无稳定 API 时进行页面级采集与回归验证；须遵守网站条款 |
| `security-best-practices` | 上线前 | 检查密钥、输入校验、依赖与服务端安全边界 |
| `screenshot` | 可选 | 保存网页证据或做报告页面核验，不承担结构化数据抽取主流程 |

`openai-docs`、`skill-creator` 和 `skill-installer` 属于系统已有能力，无需重复安装。GitHub 插件已经提供仓库调研能力。

## 建议自建的领域 Skills

| Skill 名称 | 优先级 | 责任边界 | 关键输出 |
|---|---|---|---|
| `cn-fund-data` | P0 | 获取并标准化基金基本信息、净值、费率、经理、持仓、基准和分类；记录来源、抓取时间与字段口径 | 统一数据模型、数据质量报告 |
| `fund-performance` | P0 | 用确定性代码计算收益、风险、回撤、风险调整收益和基准相对指标 | 指标表、计算参数、异常说明 |
| `fund-peer-comparison` | P0 | 构建同类基金池，处理成立时间、份额类别和幸存者偏差 | 同类排名、可比性说明 |
| `fund-holdings-exposure` | P1 | 持仓重合度、行业/风格暴露、集中度与披露滞后提示 | 暴露表、集中度和穿透说明 |
| `fund-document-research` | P1 | 从公告和定期报告提取带页码/链接的事实，区分披露期与当前时点 | 证据清单、事实摘要 |
| `fund-report-writer` | P0 | 按固定模板组织事实、计算结果、推断、风险与数据缺口 | Markdown/HTML/PDF 研究报告 |
| `investment-compliance-guard` | P0 | 禁止伪造实时性、保证收益或无依据评级；检查免责声明与人工复核点 | 合规检查结果、阻断原因 |

### 每个领域 Skill 的共同约束

- 输入和输出使用明确 schema；基金代码不能只作为自由文本传递。
- 每条外部事实至少包含 `source_url`、`source_name`、`retrieved_at`、`as_of_date`。
- 所有指标包含频率、年化因子、基准、无风险利率、缺失值处理和复权口径。
- 推断必须引用事实或计算结果，不允许语言模型生成未经验证的数值。
- 数据不足时返回“不可判断”，不得自动补齐关键事实。

## 不建议首期引入

- FinGPT 或其他金融大模型微调：成本高，且不能替代准确数据和确定性计算。
- Qlib 预测/强化学习交易链路：偏离“基金研究辅助”的首期目标。
- 多个组合优化库并存：口径与维护成本会快速上升。
- 自动下单和账户连接：会显著扩大安全、合规和授权边界。
- 仅依靠网页搜索做净值与持仓事实：实时性和可复现性不足。

## 接入前检查清单

1. 核对目标基金范围：公募开放式、ETF、LOF、QDII、货币基金是否全部覆盖。
2. 为净值、分红、拆分、份额类别和基准建立统一口径。
3. 记录每个数据源的许可、使用条款、频率限制与失败降级方案。
4. 用已知样本对收益、最大回撤、夏普等指标做金标准测试。
5. 把报告中的事实、计算、推断和观点分栏展示。
6. 对任何“推荐、评级、预测”功能单独做法律与合规评审。

