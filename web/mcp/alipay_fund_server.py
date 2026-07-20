"""蚂蚁财富机构授权基金数据 MCP（Python stdio）。

支付宝公开开放平台没有面向普通开发者的零售基金行情 API。本适配器只连接
用户已签约取得的蚂蚁财富机构接口或其合规网关，不调用支付宝 App 私有接口。
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from typing import Any
from urllib.parse import urlparse

import requests
from mcp.server.fastmcp import FastMCP
from env_loader import load_project_env


load_project_env()
SERVER = FastMCP("guanlan-alipay-fund", log_level="ERROR")
SESSION = requests.Session()

DEFAULT_FIELD_MAP = {
    "code": "fundCode",
    "name": "fundName",
    "type": "fundType",
    "nav": "nav",
    "navDate": "navDate",
    "dailyGrowthPercent": "dailyGrowthPercent",
    "riskLevel": "riskLevel",
    "saleStatus": "saleStatus",
    "feeRate": "feeRate",
}


def _json_object(name: str, default: dict[str, Any] | None = None) -> dict[str, Any]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return dict(default or {})
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{name} 不是合法 JSON：{error.msg}") from error
    if not isinstance(value, dict):
        raise RuntimeError(f"{name} 必须是 JSON 对象")
    return value


def _path_value(payload: Any, path: str) -> Any:
    if not path:
        return payload
    current = payload
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return None
    return current


def _configuration() -> dict[str, Any]:
    url = os.getenv("ALIPAY_FUND_API_URL", "").strip()
    method = os.getenv("ALIPAY_FUND_HTTP_METHOD", "GET").strip().upper() or "GET"
    if method not in {"GET", "POST"}:
        raise RuntimeError("ALIPAY_FUND_HTTP_METHOD 只支持 GET 或 POST")
    host = urlparse(url).hostname if url else None
    return {
        "url": url,
        "host": host,
        "method": method,
        "codeParam": os.getenv("ALIPAY_FUND_CODE_PARAM", "fundCode").strip() or "fundCode",
        "dataPath": os.getenv("ALIPAY_FUND_DATA_PATH", "data").strip(),
        "timeout": max(3.0, min(float(os.getenv("ALIPAY_FUND_TIMEOUT_SECONDS", "20")), 60.0)),
    }


def _headers() -> dict[str, str]:
    headers = {"Accept": "application/json", "User-Agent": "Guanlan-Fund-Agent/1.0"}
    extra = _json_object("ALIPAY_FUND_EXTRA_HEADERS_JSON")
    forbidden = {"host", "content-length", "connection"}
    for key, value in extra.items():
        if str(key).lower() in forbidden:
            raise RuntimeError(f"ALIPAY_FUND_EXTRA_HEADERS_JSON 不允许设置 {key}")
        headers[str(key)] = str(value)
    api_key = os.getenv("ALIPAY_FUND_API_KEY", "").strip()
    if api_key:
        header = os.getenv("ALIPAY_FUND_AUTH_HEADER", "Authorization").strip() or "Authorization"
        scheme = os.getenv("ALIPAY_FUND_AUTH_SCHEME", "Bearer").strip()
        headers[header] = f"{scheme} {api_key}".strip()
    return headers


def _normalized_fund(payload: dict[str, Any], code: str) -> dict[str, Any]:
    config = _configuration()
    data = _path_value(payload, config["dataPath"])
    if isinstance(data, list):
        data = data[0] if data else None
    if not isinstance(data, dict):
        raise RuntimeError("蚂蚁财富授权接口返回结构与 ALIPAY_FUND_DATA_PATH 不匹配")
    field_map = _json_object("ALIPAY_FUND_FIELD_MAP_JSON", DEFAULT_FIELD_MAP)
    fund = {field: _path_value(data, str(path)) for field, path in field_map.items() if path}
    fund = {key: value for key, value in fund.items() if value is not None and value != ""}
    fund.setdefault("code", code)
    if len(fund) <= 1:
        raise RuntimeError("未映射到基金字段，请检查 ALIPAY_FUND_FIELD_MAP_JSON")
    fund.update({
        "provider": "蚂蚁财富机构授权接口",
        "available": True,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
    })
    return fund


@SERVER.tool()
def alipay_fund_status() -> dict[str, Any]:
    """检查蚂蚁财富机构基金接口配置，不返回任何密钥。"""
    config = _configuration()
    return {
        "provider": "蚂蚁财富机构基金 MCP",
        "configured": bool(config["url"]),
        "apiHost": config["host"],
        "method": config["method"],
        "authConfigured": bool(os.getenv("ALIPAY_FUND_API_KEY", "").strip()),
        "accessModel": "institution-authorized",
        "notice": "需要蚂蚁财富或合作机构提供的签约接口；不使用支付宝 App 私有接口。",
    }


@SERVER.tool()
def get_alipay_fund_info(code: str) -> dict[str, Any]:
    """通过已签约的蚂蚁财富机构接口获取基金补充信息。"""
    normalized = code.strip()
    if len(normalized) != 6 or not normalized.isdigit():
        raise ValueError("基金代码必须是六位数字")
    config = _configuration()
    if not config["url"]:
        raise RuntimeError("未配置蚂蚁财富机构接口，请在项目根目录 .env 填写 ALIPAY_FUND_API_URL")

    endpoint = config["url"].replace("{code}", normalized)
    params = _json_object("ALIPAY_FUND_STATIC_PARAMS_JSON")
    if "{code}" not in config["url"]:
        params[config["codeParam"]] = normalized
    if config["method"] == "GET":
        response = SESSION.get(endpoint, params=params, headers=_headers(), timeout=config["timeout"])
    else:
        response = SESSION.post(endpoint, json=params, headers={**_headers(), "Content-Type": "application/json"}, timeout=config["timeout"])
    try:
        payload = response.json()
    except ValueError as error:
        raise RuntimeError(f"蚂蚁财富授权接口未返回 JSON（HTTP {response.status_code}）") from error
    if not response.ok:
        raise RuntimeError(f"蚂蚁财富授权接口请求失败（HTTP {response.status_code}）")
    if not isinstance(payload, dict):
        raise RuntimeError("蚂蚁财富授权接口返回了无法识别的数据格式")
    return {"input": {"code": normalized}, "response": {"fund": _normalized_fund(payload, normalized)}}


if __name__ == "__main__":
    SERVER.run(transport="stdio")
