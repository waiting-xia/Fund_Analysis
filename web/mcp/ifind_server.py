"""同花顺 iFinD 官方 HTTP API MCP（Python stdio）。"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any

import requests
from mcp.server.fastmcp import FastMCP
from env_loader import load_project_env


load_project_env()
SERVER = FastMCP("guanlan-ifind", log_level="ERROR")
BASE_URL = os.getenv("IFIND_API_BASE_URL", "https://quantapi.51ifind.com/api/v1").rstrip("/")
SESSION = requests.Session()
_access_token = os.getenv("IFIND_ACCESS_TOKEN", "").strip()
_token_expires_at = time.time() + 6 * 24 * 60 * 60 if _access_token else 0.0


def _find_access_token(payload: dict[str, Any]) -> str:
    direct = payload.get("access_token")
    nested = payload.get("data", {}).get("access_token") if isinstance(payload.get("data"), dict) else None
    tables = payload.get("tables")
    table_token = None
    if isinstance(tables, list) and tables and isinstance(tables[0], dict):
        table = tables[0].get("table")
        if isinstance(table, dict):
            table_token = table.get("access_token")
    return str(direct or nested or table_token or "")


def _get_access_token() -> str:
    global _access_token, _token_expires_at
    if _access_token and time.time() < _token_expires_at:
        return _access_token
    refresh_token = os.getenv("IFIND_REFRESH_TOKEN", "").strip()
    if not refresh_token:
        raise RuntimeError("未配置同花顺 iFinD 令牌，请在项目根目录 .env 中填写 IFIND_ACCESS_TOKEN 或 IFIND_REFRESH_TOKEN")
    response = SESSION.post(f"{BASE_URL}/get_access_token", headers={"refresh_token": refresh_token}, timeout=15)
    payload = response.json() if response.content else {}
    token = _find_access_token(payload)
    if not response.ok or not token:
        raise RuntimeError(f"iFinD 获取 access_token 失败（HTTP {response.status_code}）")
    _access_token = token
    _token_expires_at = time.time() + 6 * 24 * 60 * 60
    return token


def _call(endpoint: str, body: dict[str, Any]) -> dict[str, Any]:
    response = SESSION.post(
        f"{BASE_URL}/{endpoint}",
        headers={"access_token": _get_access_token(), "Content-Type": "application/json"},
        json=body,
        timeout=20,
    )
    payload = response.json() if response.content else {}
    if not response.ok:
        raise RuntimeError(f"iFinD {endpoint} 请求失败（HTTP {response.status_code}）")
    return {"provider": "同花顺 iFinD Python MCP", "endpoint": endpoint, "retrievedAt": datetime.now(timezone.utc).isoformat(), "data": payload}


@SERVER.tool()
def ifind_status() -> dict[str, Any]:
    """检查同花顺 iFinD 官方 API 是否配置授权。"""
    access = bool(os.getenv("IFIND_ACCESS_TOKEN", "").strip())
    refresh = bool(os.getenv("IFIND_REFRESH_TOKEN", "").strip())
    return {"provider": "同花顺 iFinD Python MCP", "configured": access or refresh, "authMode": "access_token" if access else "refresh_token" if refresh else "none", "baseUrl": BASE_URL}


@SERVER.tool()
def ifind_realtime_quote(codes: str, indicators: str = "latest") -> dict[str, Any]:
    """获取同花顺 iFinD 授权实时行情。"""
    return _call("real_time_quotation", {"codes": codes.strip(), "indicators": indicators.strip() or "latest"})


@SERVER.tool()
def ifind_high_frequency(codes: str, indicators: str, starttime: str, endtime: str) -> dict[str, Any]:
    """获取同花顺 iFinD 高频行情。"""
    return _call("high_frequency", {"codes": codes.strip(), "indicators": indicators.strip(), "starttime": starttime.strip(), "endtime": endtime.strip()})


@SERVER.tool()
def ifind_snapshot(codes: str, indicators: str) -> dict[str, Any]:
    """获取同花顺 iFinD 市场快照。"""
    return _call("snap_shot", {"codes": codes.strip(), "indicators": indicators.strip()})


if __name__ == "__main__":
    SERVER.run(transport="stdio")
