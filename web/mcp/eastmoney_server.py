"""东方财富行情 MCP（Python stdio）。"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import re
import time
from typing import Any

import requests
from mcp.server.fastmcp import FastMCP


SERVER = FastMCP("guanlan-eastmoney", log_level="ERROR")
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 Guanlan-Fund-Agent/1.0", "Accept": "application/json,text/plain,*/*", "Referer": "https://quote.eastmoney.com/"})
QUOTE_URL = "https://push2delay.eastmoney.com/api/qt/stock/get"
KLINE_URL = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
SEARCH_URL = "https://searchapi.eastmoney.com/api/suggest/get"
FUND_ESTIMATE_URL = "https://fundgz.1234567.com.cn/js/{code}.js"
FUND_NAV_URL = "https://api.fund.eastmoney.com/f10/lsjz"
FUND_SEARCH_URL = "https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx"
FUND_CATALOG_URL = "https://fund.eastmoney.com/js/fundcode_search.js"
FUND_BATCH_URL = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo"
FUND_POSITION_URL = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition"
MARKET_FLOW_URL = "https://push2.eastmoney.com/api/qt/stock/fflow/kline/get"
SECTOR_FLOW_URL = "https://data.eastmoney.com/dataapi/bkzj/getbkzj"
NORTHBOUND_URL = "https://push2.eastmoney.com/api/qt/kamt.rtmin/get"
INDUSTRY_LIST_URL = "https://push2.eastmoney.com/api/qt/clist/get"
HOLDINGS_QUOTE_URL = "https://push2delay.eastmoney.com/api/qt/ulist.np/get"
GLOBAL_INDEX_SECIDS = {
    "us": ["100.DJIA", "100.SPX", "100.NDX"],
}
FUND_CATALOG_CACHE: list[dict[str, str]] = []
FUND_CATALOG_EXPIRES_AT = 0.0


def _request_json(url: str, params: dict[str, Any], timeout: float = 12, attempts: int = 3) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(max(1, attempts)):
        try:
            response = SESSION.get(url, params=params, timeout=timeout, headers={"Connection": "close"})
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise RuntimeError("东方财富返回了无法识别的数据格式")
            return payload
        except (requests.RequestException, ValueError, RuntimeError) as error:
            last_error = error
            if attempt < attempts - 1:
                time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"东方财富行情请求失败：{last_error}")


def _fund_catalog() -> list[dict[str, str]]:
    """读取东方财富全量基金目录，并在 MCP 进程内缓存六小时。"""
    global FUND_CATALOG_CACHE, FUND_CATALOG_EXPIRES_AT
    now = time.time()
    if FUND_CATALOG_CACHE and now < FUND_CATALOG_EXPIRES_AT:
        return FUND_CATALOG_CACHE

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = SESSION.get(
                FUND_CATALOG_URL,
                params={"v": int(now // 21600)},
                timeout=25,
                headers={"Referer": "https://fund.eastmoney.com/", "Connection": "close"},
            )
            response.raise_for_status()
            text = response.text
            assignment = text.find("var r")
            start = text.find("[", assignment)
            end = text.rfind("]")
            if assignment < 0 or start < 0 or end <= start:
                raise RuntimeError("东方财富全量基金目录格式无法识别")
            rows = json.loads(text[start:end + 1])
            catalog = []
            for row in rows:
                if not isinstance(row, list) or len(row) < 3:
                    continue
                code = str(row[0]).strip()
                name = str(row[2]).strip()
                if not re.fullmatch(r"\d{6}", code) or not name:
                    continue
                catalog.append({
                    "code": code,
                    "name": name,
                    "type": str(row[3]).strip() if len(row) > 3 and row[3] else "基金",
                    "pinyin": str(row[1]).strip() if len(row) > 1 and row[1] else "",
                    "fullPinyin": str(row[4]).strip() if len(row) > 4 and row[4] else "",
                })
            if not catalog:
                raise RuntimeError("东方财富全量基金目录为空")
            FUND_CATALOG_CACHE = catalog
            FUND_CATALOG_EXPIRES_AT = now + 6 * 60 * 60
            return FUND_CATALOG_CACHE
        except (requests.RequestException, ValueError, RuntimeError, json.JSONDecodeError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(0.5 * (attempt + 1))
    if FUND_CATALOG_CACHE:
        return FUND_CATALOG_CACHE
    raise RuntimeError(f"东方财富全量基金目录请求失败：{last_error}")


def _catalog_match_score(item: dict[str, str], keyword: str) -> tuple[int, int, str]:
    query = keyword.casefold().replace(" ", "")
    code = item["code"].casefold()
    name = item["name"].casefold().replace(" ", "")
    pinyin = item.get("pinyin", "").casefold()
    full_pinyin = item.get("fullPinyin", "").casefold()
    if query == code:
        rank = 0
    elif code.startswith(query):
        rank = 1
    elif query == name:
        rank = 2
    elif name.startswith(query):
        rank = 3
    elif query in name:
        rank = 4
    elif pinyin.startswith(query):
        rank = 5
    elif full_pinyin.startswith(query):
        rank = 6
    elif query in pinyin or query in full_pinyin:
        rank = 7
    else:
        rank = 99
    return rank, len(name), code


def _normalized_code(code: str) -> str:
    value = code.strip().upper()
    if len(value) == 8 and value[:2] in {"SH", "SZ"} and value[2:].isdigit():
        return value
    if len(value) != 6 or not value.isdigit():
        raise ValueError("证券代码应为六位数字，或 SH/SZ 加六位数字")
    return ("SH" if value[0] in {"5", "6", "9"} else "SZ") + value


def _secid(code: str) -> str:
    value = _normalized_code(code)
    return ("1." if value.startswith("SH") else "0.") + value[2:]


def _number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _optional_number(value: Any) -> float | None:
    if value in {None, "", "-", "--"}:
        return None
    try:
        number = float(value)
        return number if number == number else None
    except (TypeError, ValueError):
        return None


def _rows(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        if value and any(not isinstance(item, dict) for item in value.values()):
            return [value]
        return [item for item in value.values() if isinstance(item, dict)]
    return []


def _quote(data: dict[str, Any], normalized_code: str) -> dict[str, Any]:
    code = normalized_code[2:]
    return {
        "code": normalized_code,
        "name": str(data.get("f58") or code),
        "now": _number(data.get("f43")),
        "open": _number(data.get("f46")),
        "high": _number(data.get("f44")),
        "low": _number(data.get("f45")),
        "volume": _number(data.get("f47")),
        "amount": _number(data.get("f48")),
        "yesterday": _number(data.get("f60")),
        # MCP 前端约定 0.01 代表 1%；fltt=2 时 f170 的 1 代表 1%。
        "percent": _number(data.get("f170")) / 100.0,
        "change": _number(data.get("f43")) - _number(data.get("f60")),
        "source": "eastmoney-python",
    }


def _quote_fields() -> str:
    return "f13,f43,f44,f45,f46,f47,f48,f57,f58,f60,f170"


def _fund_code(code: str) -> str:
    value = code.strip()
    if len(value) != 6 or not value.isdigit():
        raise ValueError("基金代码必须是六位数字")
    return value


def _fund_estimate(code: str) -> dict[str, Any] | None:
    url = FUND_ESTIMATE_URL.format(code=code)
    response = SESSION.get(url, params={"rt": int(time.time() * 1000)}, timeout=12, headers={"Referer": f"https://fund.eastmoney.com/{code}.html"})
    response.raise_for_status()
    match = re.search(r"jsonpgz\((\{.*\})\)\s*;?", response.text.strip())
    if not match:
        return None
    payload = json.loads(match.group(1))
    return {
        "name": payload.get("name"),
        "officialNav": _number(payload.get("dwjz")),
        "officialNavDate": payload.get("jzrq"),
        "estimatedNav": _number(payload.get("gsz")),
        "estimatedGrowthPercent": _number(payload.get("gszzl")),
        "estimateTime": payload.get("gztime"),
        "estimateSource": url,
    }


def _fund_official_nav(code: str) -> dict[str, Any]:
    response = SESSION.get(
        FUND_NAV_URL,
        params={"fundCode": code, "pageIndex": 1, "pageSize": 20, "startDate": "", "endDate": ""},
        timeout=12,
        headers={"Referer": f"https://fundf10.eastmoney.com/jjjz_{code}.html"},
    )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("Data") if isinstance(payload, dict) else None
    if isinstance(data, str) and data.strip().startswith("{"):
        data = json.loads(data)
    rows = data.get("LSJZList", []) if isinstance(data, dict) else []
    if not rows:
        raise RuntimeError("东方财富未返回该基金的正式净值")
    latest = rows[0]
    return {
        "officialNav": _number(latest.get("DWJZ")),
        "accumulatedNav": _number(latest.get("LJJZ")),
        "officialGrowthPercent": _number(latest.get("JZZZL")),
        "officialNavDate": latest.get("FSRQ"),
        "officialSource": f"https://fundf10.eastmoney.com/jjjz_{code}.html",
    }


@SERVER.tool()
def get_stock(code: str, source: str = "eastmoney") -> dict[str, Any]:
    """获取单只股票、指数或 ETF 的东方财富行情。"""
    if source not in {"eastmoney", "auto"}:
        raise ValueError("Python MCP 仅支持 eastmoney 数据源")
    normalized = _normalized_code(code)
    payload = _request_json(QUOTE_URL, {"fltt": 2, "invt": 2, "secid": _secid(normalized), "fields": _quote_fields()})
    data = payload.get("data")
    if not isinstance(data, dict):
        raise RuntimeError("东方财富未返回该证券行情")
    return {"input": {"code": normalized, "source": "eastmoney"}, "response": {"stock": _quote(data, normalized)}}


@SERVER.tool()
def get_stocks(codes: list[str], source: str = "eastmoney") -> dict[str, Any]:
    """批量获取东方财富股票、指数或 ETF 行情。"""
    if not codes:
        raise ValueError("codes 不能为空")
    if source not in {"eastmoney", "auto"}:
        raise ValueError("Python MCP 仅支持 eastmoney 数据源")
    normalized = [_normalized_code(code) for code in codes[:50]]
    # 东方财富批量端点在不同线路返回的字段结构不一致；逐只调用稳定端点，避免错位行情。
    quotes = [get_stock(code, "eastmoney")["response"]["stock"] for code in normalized]
    return {"input": {"codes": normalized, "source": "eastmoney"}, "response": {"count": len(quotes), "stocks": quotes}}


@SERVER.tool()
def get_global_indices(market: str = "us") -> dict[str, Any]:
    """批量获取美股主要指数实时行情。"""
    region = market.strip().lower()
    secids = GLOBAL_INDEX_SECIDS.get(region)
    if not secids:
        raise ValueError("market 当前仅支持 us")
    payload = _request_json(HOLDINGS_QUOTE_URL, {
        "fltt": 2,
        "invt": 2,
        "secids": ",".join(secids),
        "fields": "f2,f3,f4,f5,f6,f12,f13,f14,f15,f16,f17,f18",
        "_": int(time.time() * 1000),
    }, timeout=6, attempts=2)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    rows = _rows(data.get("diff"))
    by_code = {str(row.get("f12") or ""): row for row in rows}
    indices = []
    for secid in secids:
        code = secid.split(".", 1)[1]
        row = by_code.get(code)
        if not row or _optional_number(row.get("f2")) is None:
            continue
        now = _number(row.get("f2"))
        previous = _number(row.get("f18"))
        indices.append({
            "code": f"US{code}",
            "name": str(row.get("f14") or code),
            "now": now,
            "open": _number(row.get("f17")),
            "high": _number(row.get("f15")),
            "low": _number(row.get("f16")),
            "volume": _number(row.get("f5")),
            "amount": _number(row.get("f6")),
            "yesterday": previous,
            "percent": _number(row.get("f3")) / 100.0,
            "change": _optional_number(row.get("f4")) or now - previous,
            "source": "eastmoney-python-global",
        })
    if not indices:
        raise RuntimeError("东方财富未返回美股主要指数行情")
    return {
        "input": {"market": region},
        "response": {
            "market": region,
            "count": len(indices),
            "indices": indices,
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "notice": "美股指数行情来自东方财富公开接口，可能存在传输或交易所延迟。",
        },
    }


@SERVER.tool()
def get_a_share_quotes(codes: list[str]) -> dict[str, Any]:
    """批量获取基金公开持仓中的 A 股实时价格与当日涨跌。"""
    normalized = []
    seen: set[str] = set()
    for raw_code in codes[:20]:
        code = str(raw_code or "").strip().upper()
        if code.startswith(("SH", "SZ")):
            code = code[2:]
        if not re.fullmatch(r"\d{6}", code) or code in seen or code[0] not in {"0", "3", "4", "6", "8"}:
            continue
        seen.add(code)
        normalized.append({"code": code, "secid": ("1." if code.startswith("6") else "0.") + code})
    if not normalized:
        return {
            "input": {"codes": []},
            "response": {"quotes": [], "retrievedAt": datetime.now(timezone.utc).isoformat(), "notice": "没有可映射的六位 A 股代码。"},
        }
    payload = _request_json(HOLDINGS_QUOTE_URL, {
        "fltt": 2,
        "invt": 2,
        "secids": ",".join(item["secid"] for item in normalized),
        "fields": "f2,f3,f4,f5,f6,f12,f13,f14,f15,f16,f17,f18",
        "_": int(time.time() * 1000),
    }, timeout=6, attempts=2)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    by_code = {str(row.get("f12") or ""): row for row in _rows(data.get("diff"))}
    quotes = []
    for item in normalized:
        row = by_code.get(item["code"])
        price = _optional_number(row.get("f2")) if row else None
        if row is None or price is None:
            continue
        previous = _optional_number(row.get("f18"))
        quotes.append({
            "code": item["code"],
            "name": str(row.get("f14") or item["code"]),
            "price": price,
            "change": _optional_number(row.get("f4")),
            "changePercent": _optional_number(row.get("f3")),
            "open": _optional_number(row.get("f17")),
            "high": _optional_number(row.get("f15")),
            "low": _optional_number(row.get("f16")),
            "previousClose": previous,
            "volume": _optional_number(row.get("f5")),
            "amount": _optional_number(row.get("f6")),
        })
    return {
        "input": {"codes": [item["code"] for item in normalized]},
        "response": {
            "quotes": quotes,
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "source": "东方财富证券行情",
            "notice": "价格与涨跌幅为股票行情，不代表基金经理正在实时调仓。",
        },
    }


@SERVER.tool()
def get_klines(code: str, period: str = "day", count: int = 120, adjust: str = "none", source: str = "eastmoney") -> dict[str, Any]:
    """获取东方财富日、周或月 K 线。"""
    if source not in {"eastmoney", "auto"}:
        raise ValueError("Python MCP 仅支持 eastmoney 数据源")
    klt = {"day": 101, "week": 102, "month": 103}.get(period)
    fqt = {"none": 0, "qfq": 1, "hfq": 2}.get(adjust)
    if klt is None or fqt is None:
        raise ValueError("period 或 adjust 参数不正确")
    limit = max(1, min(int(count), 500))
    payload = _request_json(KLINE_URL, {
        "secid": _secid(code), "klt": klt, "fqt": fqt, "lmt": limit,
        "fields1": "f1,f2,f3,f4,f5,f6", "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
    })
    rows = payload.get("data", {}).get("klines", [])
    klines = []
    for row in rows:
        values = str(row).split(",")
        if len(values) >= 7:
            klines.append({"date": values[0], "open": float(values[1]), "close": float(values[2]), "high": float(values[3]), "low": float(values[4]), "volume": float(values[5]), "amount": float(values[6])})
    return {"input": {"code": _normalized_code(code), "period": period, "count": limit, "adjust": adjust, "source": "eastmoney"}, "response": {"count": len(klines), "klines": klines}}


@SERVER.tool()
def search_stocks(query: str, source: str = "eastmoney") -> dict[str, Any]:
    """按代码或名称搜索东方财富证券。"""
    if source not in {"eastmoney", "auto"}:
        raise ValueError("Python MCP 仅支持 eastmoney 数据源")
    payload = _request_json(SEARCH_URL, {"input": query.strip(), "type": 14, "count": 10, "token": "D43BF722C8E33BDC906FB84D85E326E8"})
    rows = payload.get("QuotationCodeTable", {}).get("Data", [])
    results = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        security_code = str(row.get("Code") or row.get("SecurityCode") or "")
        market = str(row.get("MktNum") or row.get("Market") or "")
        prefix = "SH" if market in {"1", "SH", "sh"} else "SZ"
        results.append({"code": prefix + security_code, "name": row.get("Name") or row.get("SecurityName"), "type": row.get("SecurityTypeName")})
    return {"input": {"query": query, "source": "eastmoney"}, "response": {"count": len(results), "stocks": results}}


@SERVER.tool()
def search_funds(query: str, limit: int = 20) -> dict[str, Any]:
    """合并东方财富全量基金目录与实时联想，按代码、名称或拼音搜索。"""
    keyword = query.strip()
    if not keyword:
        raise ValueError("搜索关键词不能为空")
    size = max(1, min(int(limit), 50))
    catalog = _fund_catalog()
    catalog_by_code = {item["code"]: item for item in catalog}

    # 联想接口提供较好的热门排序；失败时仍可由全量目录独立完成搜索。
    try:
        payload = _request_json(FUND_SEARCH_URL, {"m": 1, "key": keyword, "_": int(time.time() * 1000)})
        rows = payload.get("Datas", [])
    except RuntimeError:
        rows = []

    funds: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        code = str(row.get("CODE") or "").strip()
        name = str(row.get("NAME") or "").strip()
        if len(code) != 6 or not code.isdigit() or not name:
            continue
        catalog_item = catalog_by_code.get(code)
        category = str(row.get("CATEGORYDESC") or "")
        if not catalog_item and category in {"指数", "股票", "债券"}:
            continue
        base_info = row.get("FundBaseInfo")
        base_type = base_info.get("FTYPE") if isinstance(base_info, dict) else None
        funds.append({
            "code": code,
            "name": name,
            "type": (catalog_item or {}).get("type") or category or base_type or "基金",
            "pinyin": (catalog_item or {}).get("pinyin") or row.get("JP") or row.get("PINYIN") or "",
        })
        seen.add(code)

    catalog_matches = [item for item in catalog if _catalog_match_score(item, keyword)[0] < 99]
    catalog_matches.sort(key=lambda item: _catalog_match_score(item, keyword))
    for item in catalog_matches:
        if item["code"] in seen:
            continue
        funds.append({key: value for key, value in item.items() if key != "fullPinyin"})
        seen.add(item["code"])
        if len(funds) >= size:
            break

    funds = funds[:size]
    return {
        "input": {"query": keyword, "limit": size},
        "response": {
            "count": len(funds),
            "funds": funds,
            "catalogSize": len(catalog),
            "source": "eastmoney-full-catalog+suggest",
        },
    }


@SERVER.tool()
def inspect_stock(code: str, source: str = "eastmoney") -> dict[str, Any]:
    """检查东方财富行情是否可用。"""
    result = get_stock(code, source)
    return {"input": result["input"], "response": {"status": "success", "provider": "eastmoney-python", "stock": result["response"]["stock"], "checkedAt": datetime.now(timezone.utc).isoformat()}}


@SERVER.tool()
def get_fund_info(code: str) -> dict[str, Any]:
    """获取东方财富基金正式净值与盘中估算净值，二者严格分开。"""
    normalized = _fund_code(code)
    estimate = None
    try:
        estimate = _fund_estimate(normalized)
    except (requests.RequestException, ValueError, json.JSONDecodeError):
        estimate = None
    try:
        official = _fund_official_nav(normalized)
    except (requests.RequestException, ValueError, json.JSONDecodeError, RuntimeError):
        if not estimate or not estimate.get("officialNav") or not estimate.get("officialNavDate"):
            raise RuntimeError("东方财富暂未返回该基金的正式净值")
        official = {
            "officialNav": estimate["officialNav"],
            "accumulatedNav": 0.0,
            "officialGrowthPercent": 0.0,
            "officialNavDate": estimate["officialNavDate"],
            "officialSource": f"https://fund.eastmoney.com/{normalized}.html",
        }
    estimate_time = estimate.get("estimateTime") if estimate else None
    local_now = datetime.now()
    today = local_now.strftime("%Y-%m-%d")
    minute_of_day = local_now.hour * 60 + local_now.minute
    is_intraday = bool(estimate_time and str(estimate_time).startswith(today) and local_now.weekday() < 5 and 570 <= minute_of_day <= 905)
    estimate_fields = {}
    if estimate:
        estimate_fields = {
            key: estimate[key]
            for key in ("name", "estimatedNav", "estimatedGrowthPercent", "estimateTime", "estimateSource")
            if estimate.get(key) is not None
        }
    fund = {
        "code": normalized,
        **official,
        **estimate_fields,
        "isIntradayEstimate": is_intraday,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "provider": "东方财富 Python MCP",
        "notice": "盘中估算值根据历史披露持仓和行情推算，不是基金公司确认净值；实际收益以正式净值为准。",
    }
    return {"input": {"code": normalized}, "response": {"fund": fund}}


@SERVER.tool()
def get_fund_batch_info(codes: list[str]) -> dict[str, Any]:
    """批量获取最多四只基金的正式净值，用于持仓看板首屏。"""
    normalized = [_fund_code(code) for code in codes[:4]]
    if not normalized:
        raise ValueError("codes 不能为空")
    payload = _request_json(FUND_BATCH_URL, {
        "pageIndex": 1,
        "pageSize": 20,
        "plat": "Android",
        "appType": "ttjj",
        "product": "EFund",
        "Version": 1,
        "deviceid": "Wap",
        "Fcodes": ",".join(normalized),
    })
    funds = []
    for row in _rows(payload.get("Datas")):
        code = str(row.get("FCODE") or "")
        if code not in normalized:
            continue
        funds.append({
            "code": code,
            "name": str(row.get("SHORTNAME") or code),
            "type": str(row.get("FTYPE") or "基金"),
            "date": str(row.get("PDATE") or ""),
            "nav": _optional_number(row.get("NAV")),
            "dayGrowth": _optional_number(row.get("NAVCHGRT")),
            "source": "东方财富-天天基金移动公开接口",
        })
    funds.sort(key=lambda item: normalized.index(item["code"]))
    return {
        "input": {"codes": normalized},
        "response": {
            "funds": funds,
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
        },
    }


@SERVER.tool()
def get_fund_position(code: str) -> dict[str, Any]:
    """获取最近公开报告期的基金持仓及相对上期变化。"""
    normalized = _fund_code(code)
    payload = _request_json(FUND_POSITION_URL, {
        "FCODE": normalized,
        "deviceid": "Wap",
        "plat": "Wap",
        "product": "EFund",
        "version": "2.0.0",
        "Uid": "",
        "_": int(time.time() * 1000),
    })
    data = payload.get("Datas") if isinstance(payload.get("Datas"), dict) else {}
    stocks = []
    for row in _rows(data.get("fundStocks")):
        stocks.append({
            "code": str(row.get("GPDM") or ""),
            "name": str(row.get("GPJC") or ""),
            "exchange": str(row.get("NEWTEXCH") or ""),
            "weight": _optional_number(row.get("JZBL")),
            "changeType": str(row.get("PCTNVCHGTYPE") or "未知"),
            "changeRatio": _optional_number(row.get("PCTNVCHG")),
        })
    return {
        "input": {"code": normalized},
        "response": {
            "period": str(payload.get("Expansion") or "") or None,
            "stocks": stocks,
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "notice": "持仓变化来自最近两期公开报告，不代表报告期内完整交易记录。",
        },
    }


@SERVER.tool()
def get_market_capital_flow() -> dict[str, Any]:
    """获取沪深市场当日主力、超大单、大单、中单和小单资金流。"""
    payload = _request_json(MARKET_FLOW_URL, {
        "lmt": 0,
        "klt": 1,
        "secid": "1.000001",
        "secid2": "0.399001",
        "fields1": "f1,f2,f3,f7",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63",
        "_": int(time.time() * 1000),
    })
    lines = payload.get("data", {}).get("klines", []) if isinstance(payload.get("data"), dict) else []
    points = []
    for line in lines if isinstance(lines, list) else []:
        values = str(line).split(",")
        if len(values) < 6:
            continue
        points.append({
            "time": values[0],
            "mainNet": (_optional_number(values[1]) or 0) / 1e8,
            "smallNet": (_optional_number(values[2]) or 0) / 1e8,
            "mediumNet": (_optional_number(values[3]) or 0) / 1e8,
            "largeNet": (_optional_number(values[4]) or 0) / 1e8,
            "superLargeNet": (_optional_number(values[5]) or 0) / 1e8,
        })
    return {
        "input": {},
        "response": {
            "latest": points[-1] if points else None,
            "points": points[-120:],
            "unit": "亿元",
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
        },
    }


@SERVER.tool()
def get_sector_capital_flow(limit: int = 6) -> dict[str, Any]:
    """获取行业板块当日资金净流入排行。"""
    size = max(1, min(int(limit), 20))
    payload = _request_json(SECTOR_FLOW_URL, {"key": "f62", "code": "m:90+s:4"})
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    sectors = []
    for row in _rows(data.get("diff")):
        sectors.append({
            "code": str(row.get("f12") or ""),
            "name": str(row.get("f14") or ""),
            "netInflow": _optional_number(row.get("f62")),
            "changePercent": _optional_number(row.get("f3")),
        })
    sectors = [item for item in sectors if item["name"]]
    sectors.sort(key=lambda item: item["netInflow"] if item["netInflow"] is not None else float("-inf"), reverse=True)
    return {"input": {"limit": size}, "response": {"sectors": sectors[:size], "retrievedAt": datetime.now(timezone.utc).isoformat()}}


def _parse_connect_flow(items: Any) -> dict[str, Any] | None:
    if not isinstance(items, list) or not items:
        return None
    values = str(items[-1]).split(",")
    if len(values) < 6:
        return None
    convert = lambda value: None if _optional_number(value) is None else _optional_number(value) / 1e4
    return {
        "time": values[0],
        "routeOneNet": convert(values[1]),
        "routeOneBalance": convert(values[2]),
        "routeTwoNet": convert(values[3]),
        "routeTwoBalance": convert(values[4]),
        "total": convert(values[5]),
    }


@SERVER.tool()
def get_northbound_capital() -> dict[str, Any]:
    """读取沪深港通公开分钟口径；无盘中披露时返回明确的不可用状态。"""
    payload = _request_json(NORTHBOUND_URL, {
        "fields1": "f1,f2,f3,f4",
        "fields2": "f51,f52,f53,f54,f55,f56",
        "ut": "",
        "_": int(time.time() * 1000),
    })
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    northbound = _parse_connect_flow(data.get("s2n"))
    southbound = _parse_connect_flow(data.get("n2s"))
    disclosed = bool(
        northbound
        and (northbound.get("routeOneNet") not in {None, 0} or northbound.get("routeTwoNet") not in {None, 0})
    )
    return {
        "input": {},
        "response": {
            "available": disclosed,
            "northbound": northbound,
            "southbound": southbound,
            "unit": "亿元",
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "notice": "北向实时净买入已可能停止盘中披露；仅在公开接口返回有效净额时展示，不以额度余额或估算值冒充净流入。",
        },
    }


def _industry_key(value: str) -> str:
    return re.sub(r"(申万|一级|二级|行业|板块|指数|A股|Ⅱ|III|Ⅲ|\s)", "", value).casefold()


def _percentile(values: list[float], current: float | None) -> float | None:
    if current is None or not values:
        return None
    return round(sum(1 for value in values if value <= current) / len(values) * 100, 1)


def _median(values: list[float]) -> float | None:
    ordered = sorted(value for value in values if value > 0)
    if not ordered:
        return None
    middle = len(ordered) // 2
    return ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2


def _holding_weight(value: Any) -> float:
    text = str(value or "").strip().replace("%", "").replace(",", "")
    number = _optional_number(text)
    return max(0.0, number or 0.0)


def _harmonic_ratio(items: list[dict[str, Any]], key: str) -> tuple[float | None, float]:
    usable = [item for item in items if item.get(key) is not None and item[key] > 0 and item["weight"] > 0]
    covered_weight = sum(item["weight"] for item in usable)
    denominator = sum(item["weight"] / item[key] for item in usable)
    if covered_weight <= 0 or denominator <= 0:
        return None, 0.0
    return round(covered_weight / denominator, 2), round(covered_weight, 2)


@SERVER.tool()
def get_holdings_valuation(holdings: list[dict[str, Any]]) -> dict[str, Any]:
    """读取基金公开重仓股的真实 PE/PB，并按披露持仓权重聚合。"""
    normalized = []
    seen: set[str] = set()
    for holding in holdings[:20]:
        code = str(holding.get("code") or "").strip()
        # 本端点只处理可直接映射到沪深京行情的六位 A 股代码。
        if not re.fullmatch(r"\d{6}", code) or code in seen or code[0] not in {"0", "3", "4", "6", "8"}:
            continue
        seen.add(code)
        normalized.append({
            "code": code,
            "name": str(holding.get("name") or code).strip(),
            "weight": _holding_weight(holding.get("weight")),
            "secid": ("1." if code.startswith("6") else "0.") + code,
        })
    disclosed_weight = round(sum(item["weight"] for item in normalized), 2)
    if not normalized:
        return {
            "input": {"holdings": []},
            "response": {
                "available": False,
                "pe": None,
                "pb": None,
                "coverage": 0.0,
                "peCoverage": 0.0,
                "pbCoverage": 0.0,
                "disclosedWeight": 0.0,
                "securities": [],
                "retrievedAt": datetime.now(timezone.utc).isoformat(),
                "source": "东方财富证券行情",
                "notice": "最近公开持仓中没有可映射到沪深京行情的六位 A 股代码。",
            },
        }

    payload = _request_json(HOLDINGS_QUOTE_URL, {
        "fltt": 2,
        "invt": 2,
        "secids": ",".join(item["secid"] for item in normalized),
        "fields": "f2,f3,f9,f12,f13,f14,f23,f115",
        "_": int(time.time() * 1000),
    }, timeout=5, attempts=1)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    quote_by_code = {str(row.get("f12") or ""): row for row in _rows(data.get("diff"))}
    securities = []
    for item in normalized:
        row = quote_by_code.get(item["code"], {})
        pe_ttm = _optional_number(row.get("f115"))
        pe_dynamic = _optional_number(row.get("f9"))
        pe = pe_ttm if pe_ttm is not None and pe_ttm > 0 else pe_dynamic
        securities.append({
            "code": item["code"],
            "name": str(row.get("f14") or item["name"]),
            "weight": item["weight"],
            "price": _optional_number(row.get("f2")),
            "changePercent": _optional_number(row.get("f3")),
            "pe": pe,
            "peKind": "TTM" if pe_ttm is not None and pe_ttm > 0 else "动态" if pe_dynamic is not None else None,
            "pb": _optional_number(row.get("f23")),
        })
    pe, pe_coverage = _harmonic_ratio(securities, "pe")
    pb, pb_coverage = _harmonic_ratio(securities, "pb")
    covered_weight = round(sum(item["weight"] for item in securities if (item.get("pe") or 0) > 0 or (item.get("pb") or 0) > 0), 2)
    pe_kinds = {item["peKind"] for item in securities if item.get("peKind")}
    return {
        "input": {"holdings": [{"code": item["code"], "weight": item["weight"]} for item in normalized]},
        "response": {
            "available": pe is not None or pb is not None,
            "pe": pe,
            "pb": pb,
            "peLabel": "PE (TTM)" if pe_kinds == {"TTM"} else "PE（TTM/动态）",
            "coverage": covered_weight,
            "peCoverage": pe_coverage,
            "pbCoverage": pb_coverage,
            "disclosedWeight": disclosed_weight,
            "method": "按正值估值指标与披露持仓权重进行调和加权",
            "securities": securities,
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "source": "东方财富证券行情",
            "notice": "PE/PB 来自当前证券行情，聚合只覆盖最近公开报告期中可映射的 A 股重仓股；不代表基金全部资产的估值。",
        },
    }


@SERVER.tool()
def get_industry_valuations(names: list[str]) -> dict[str, Any]:
    """获取行业板块当前 PE/PB、横截面分位和近一年指数位置。"""
    requested = [str(name).strip() for name in names[:6] if str(name).strip()]
    if not requested:
        return {"input": {"names": []}, "response": {"industries": [], "retrievedAt": datetime.now(timezone.utc).isoformat()}}
    boards = []
    try:
        payload = _request_json(INDUSTRY_LIST_URL, {
            "pn": 1,
            "pz": 100,
            "po": 1,
            "np": 1,
            "fltt": 2,
            "invt": 2,
            "fid": "f3",
            "fs": "m:90+t:2+f:!50",
            "fields": "f2,f3,f8,f9,f12,f14,f23",
            "_": int(time.time() * 1000),
        }, timeout=6, attempts=1)
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        for row in _rows(data.get("diff")):
            name = str(row.get("f14") or "").strip()
            code = str(row.get("f12") or "").strip()
            if name and code:
                boards.append({
                    "code": code,
                    "name": name,
                    "price": _optional_number(row.get("f2")),
                    "changePercent": _optional_number(row.get("f3")),
                    "turnoverRate": _optional_number(row.get("f8")),
                    "pe": _optional_number(row.get("f9")),
                    "pb": _optional_number(row.get("f23")),
                    "secid": f"90.{code}",
                })
    except RuntimeError:
        boards = []
    benchmark_ids = {
        "沪深300": ("000300", "1.000300"),
        "中证500": ("000905", "1.000905"),
        "创业板指": ("399006", "0.399006"),
        "科创50": ("000688", "1.000688"),
        "上证指数": ("000001", "1.000001"),
    }
    for requested_name in requested:
        benchmark = next((item for name, item in benchmark_ids.items() if name in requested_name), None)
        if benchmark is None or any(item["code"] == benchmark[0] for item in boards):
            continue
        benchmark_item = {
            "code": benchmark[0],
            "name": requested_name,
            "price": None,
            "changePercent": None,
            "turnoverRate": None,
            "pe": None,
            "pb": None,
            "secid": benchmark[1],
        }
        try:
            quote_payload = _request_json(QUOTE_URL, {
                "fltt": 2,
                "invt": 2,
                "secid": benchmark[1],
                "fields": "f43,f58,f170,f9,f23,f8",
            }, timeout=6, attempts=1)
            quote = quote_payload.get("data") if isinstance(quote_payload.get("data"), dict) else {}
            benchmark_item.update({
                "name": str(quote.get("f58") or requested_name),
                "price": _optional_number(quote.get("f43")),
                "changePercent": _optional_number(quote.get("f170")),
                "turnoverRate": _optional_number(quote.get("f8")),
                "pe": _optional_number(quote.get("f9")),
                "pb": _optional_number(quote.get("f23")),
            })
        except RuntimeError:
            pass
        boards.append(benchmark_item)
    known_boards = {
        "酿酒行业": ("BK0477", "酿酒概念"),
        "白酒": ("BK0477", "酿酒概念"),
    }
    for requested_name in requested:
        known = next((item for name, item in known_boards.items() if name in requested_name), None)
        if known is None or any(item["code"] == known[0] for item in boards):
            continue
        boards.append({
            "code": known[0],
            "name": known[1],
            "price": None,
            "changePercent": None,
            "turnoverRate": None,
            "pe": None,
            "pb": None,
            "secid": f"90.{known[0]}",
        })
    for requested_name in requested:
        requested_key = _industry_key(requested_name)
        if any(requested_key and (requested_key in _industry_key(item["name"]) or _industry_key(item["name"]) in requested_key) for item in boards):
            continue
        try:
            search_payload = _request_json(SEARCH_URL, {
                "input": requested_name,
                "type": 14,
                "count": 12,
                "token": "D43BF722C8E33BDC906FB84D85E326E8",
            }, timeout=6, attempts=1)
            rows = _rows(search_payload.get("QuotationCodeTable", {}).get("Data"))
            candidate = next((row for row in rows if str(row.get("MktNum") or row.get("Market") or "") == "90" and str(row.get("Code") or "").startswith("BK")), None)
            if candidate is None:
                continue
            code = str(candidate.get("Code"))
            board_item = {
                "code": code,
                "name": str(candidate.get("Name") or requested_name),
                "price": None,
                "changePercent": None,
                "turnoverRate": None,
                "pe": None,
                "pb": None,
                "secid": f"90.{code}",
            }
            try:
                quote_payload = _request_json(QUOTE_URL, {
                    "fltt": 2,
                    "invt": 2,
                    "secid": f"90.{code}",
                    "fields": "f43,f58,f170,f9,f23,f8",
                }, timeout=6, attempts=1)
                quote = quote_payload.get("data") if isinstance(quote_payload.get("data"), dict) else {}
                board_item.update({
                    "name": str(quote.get("f58") or candidate.get("Name") or requested_name),
                    "price": _optional_number(quote.get("f43")),
                    "changePercent": _optional_number(quote.get("f170")),
                    "turnoverRate": _optional_number(quote.get("f8")),
                    "pe": _optional_number(quote.get("f9")),
                    "pb": _optional_number(quote.get("f23")),
                })
            except RuntimeError:
                pass
            boards.append(board_item)
        except RuntimeError:
            continue
    positive_pe = [item["pe"] for item in boards if item["pe"] is not None and item["pe"] > 0]
    positive_pb = [item["pb"] for item in boards if item["pb"] is not None and item["pb"] > 0]
    selected = []
    used: set[str] = set()
    for requested_name in requested:
        key = _industry_key(requested_name)
        matches = [item for item in boards if key and (key in _industry_key(item["name"]) or _industry_key(item["name"]) in key)]
        if not matches:
            continue
        match = min(matches, key=lambda item: abs(len(_industry_key(item["name"])) - len(key)))
        if match["code"] in used:
            continue
        used.add(match["code"])
        if str(match["code"]).startswith("BK") and (match.get("pe") is None or match.get("pb") is None):
            try:
                constituents = _request_json(INDUSTRY_LIST_URL, {
                    "pn": 1,
                    "pz": 100,
                    "po": 1,
                    "np": 1,
                    "fltt": 2,
                    "invt": 2,
                    "fid": "f3",
                    "fs": f"b:{match['code']}",
                    "fields": "f9,f12,f14,f23",
                }, timeout=6, attempts=1)
                constituent_data = constituents.get("data") if isinstance(constituents.get("data"), dict) else {}
                constituent_rows = _rows(constituent_data.get("diff"))
                if match.get("pe") is None:
                    match["pe"] = _median([value for row in constituent_rows if (value := _optional_number(row.get("f9"))) is not None])
                if match.get("pb") is None:
                    match["pb"] = _median([value for row in constituent_rows if (value := _optional_number(row.get("f23"))) is not None])
            except RuntimeError:
                pass
        closes: list[float] = []
        try:
            history = _request_json(KLINE_URL, {
                "secid": match.get("secid") or f"90.{match['code']}",
                "ut": "fa5fd1943c7b386f172d6893dbfba10b",
                "klt": 101,
                "fqt": 0,
                "lmt": 250,
                "end": "20500101",
                "iscca": 1,
                "fields1": "f1,f2,f3,f4,f5,f6",
                "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            }, timeout=6, attempts=1)
            rows = history.get("data", {}).get("klines", []) if isinstance(history.get("data"), dict) else []
            for row in rows if isinstance(rows, list) else []:
                values = str(row).split(",")
                close = _optional_number(values[2] if len(values) > 2 else None)
                if close is not None:
                    closes.append(close)
        except RuntimeError:
            closes = []
        current = match["price"] or (closes[-1] if closes else None)
        price_position = None
        return_one_year = None
        if current is not None and closes:
            low, high = min(closes), max(closes)
            price_position = 50.0 if high <= low else round((current - low) / (high - low) * 100, 1)
            if closes[0] > 0:
                return_one_year = round((current / closes[0] - 1) * 100, 2)
        pe_percentile = _percentile(positive_pe, match["pe"] if match["pe"] and match["pe"] > 0 else None)
        pb_percentile = _percentile(positive_pb, match["pb"] if match["pb"] and match["pb"] > 0 else None)
        valuation_percentile = None
        available_percentiles = [value for value in (pe_percentile, pb_percentile) if value is not None]
        if available_percentiles:
            valuation_percentile = round(sum(available_percentiles) / len(available_percentiles), 1)
        selected.append({
            **match,
            "sourceIndustry": requested_name,
            "pePercentile": pe_percentile,
            "pbPercentile": pb_percentile,
            "valuationPercentile": valuation_percentile,
            "pricePosition1y": price_position,
            "return1y": return_one_year,
        })
    return {
        "input": {"names": requested},
        "response": {
            "industries": selected,
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "source": "东方财富行业板块行情",
            "notice": "估值分位为当前行业横截面 PE/PB 分位；历史对比使用近一年行业指数价格位置，免费公开源不补造历史 PE/PB。",
        },
    }


if __name__ == "__main__":
    SERVER.run(transport="stdio")
