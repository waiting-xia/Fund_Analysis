# API Key 与 Token 配置

所有运行配置统一放在项目根目录的 `.env` 中。请复制根目录的 `.env.example` 为 `.env`，并仅在本机填写真实值。`.env` 已被 Git 忽略，不应提交到任何仓库。

常用配置：

```env
# OpenAI 官方或兼容 OpenAI Chat Completions 协议的第三方模型服务
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4-mini

# Python 3.10 / MCP 解释器
MCP_PYTHON_EXECUTABLE=python

# 同花顺 iFinD（可选）
IFIND_ACCESS_TOKEN=
IFIND_REFRESH_TOKEN=

# 蚂蚁财富或合作机构授权接口（可选）
ALIPAY_FUND_API_URL=
ALIPAY_FUND_API_KEY=
```

说明：

- 东方财富公开行情数据源不要求 API Key。
- 第三方模型服务需要兼容 OpenAI Chat Completions 协议。
- 如果服务商提供完整的 `/chat/completions` 地址，请填写 `OPENAI_CHAT_COMPLETIONS_URL`。
- 使用 `x-api-key` 等鉴权头时，可通过 `OPENAI_AUTH_HEADER` 与 `OPENAI_AUTH_SCHEME` 调整。
- iFinD 实时行情需要相应账号权限与 Token；不用时保持为空。
- 蚂蚁财富相关配置只适用于已签约并取得授权的机构接口。
- 不要把真实 Key 写入 `.env.example`、`mcp.config.example.json`、前端源码或 Git 历史。
