import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { searchFunds } from "../api";
import type { FundSearchItem } from "../types";

interface SearchBarProps {
  value: string;
  loading: boolean;
  onSearch: (code: string) => void;
}

type SuggestionState = "idle" | "loading" | "ready" | "error";

export function SearchBar({ value, loading, onSearch }: SearchBarProps) {
  const [draft, setDraft] = useState(value);
  const [suggestions, setSuggestions] = useState<FundSearchItem[]>([]);
  const [suggestionState, setSuggestionState] = useState<SuggestionState>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [feedback, setFeedback] = useState("");
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = draft.trim();
    if (!touched || query.length < 1) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestionState("loading");
      setFeedback("");
      setOpen(true);
      try {
        const result = await searchFunds(query, controller.signal);
        setSuggestions(result.funds);
        setSuggestionState("ready");
        setActiveIndex(result.funds.length ? 0 : -1);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setSuggestionState("error");
        setActiveIndex(-1);
        setFeedback(error instanceof Error ? error.message : "基金搜索暂不可用");
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, touched]);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  function chooseFund(item: FundSearchItem) {
    setDraft(item.code);
    setOpen(false);
    setTouched(false);
    setFeedback("");
    onSearch(item.code);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = draft.trim();
    if (/^\d{6}$/.test(query)) {
      setOpen(false);
      setFeedback("");
      onSearch(query);
      return;
    }
    const item = suggestions[activeIndex] ?? suggestions[0];
    if (item) {
      chooseFund(item);
      return;
    }
    setOpen(true);
    setFeedback("请选择匹配的基金，或输入六位基金代码");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && (suggestionState !== "idle" || Boolean(feedback));

  return (
    <form className="searchBar" onSubmit={submit} role="search">
      <label htmlFor="fund-code">查询基金</label>
      <svg className="searchIcon" aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="10.8" cy="10.8" r="6.3" />
        <path d="m15.5 15.5 4.2 4.2" />
      </svg>
      <input
        id="fund-code"
        value={draft}
        onChange={(event) => {
          const nextValue = event.target.value.slice(0, 40);
          setDraft(nextValue);
          setTouched(true);
          setFeedback("");
          if (nextValue.trim().length < 1) {
            setSuggestions([]);
            setSuggestionState("idle");
            setActiveIndex(-1);
            setOpen(false);
          }
        }}
        onFocus={() => {
          if (suggestions.length || suggestionState !== "idle") setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 140);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        placeholder="输入基金名称或代码，例如 沪深300 / 510300"
        autoComplete="off"
      />
      <button type="submit" disabled={loading}>{loading ? "查询中" : "查询"}</button>

      {showPanel && (
        <div className="searchSuggestions" id={listId} role="listbox" aria-label="基金搜索结果">
          {suggestionState === "loading" && <p className="searchFeedback"><i />正在搜索基金库…</p>}
          {suggestionState === "ready" && suggestions.length === 0 && <p className="searchFeedback">未找到匹配基金，可尝试输入六位代码</p>}
          {suggestionState === "error" && <p className="searchFeedback searchFeedbackError">{feedback || "搜索暂不可用，可直接输入基金代码"}</p>}
          {suggestionState !== "error" && feedback && <p className="searchFeedback searchFeedbackError">{feedback}</p>}
          {suggestions.map((item, index) => (
            <button
              type="button"
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              key={item.code}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => chooseFund(item)}
            >
              <span><b>{item.name}</b><small>{item.type || "基金"}</small></span>
              <code>{item.code}</code>
            </button>
          ))}
          <footer>全量基金目录 · 最多展示 20 条</footer>
        </div>
      )}
    </form>
  );
}
