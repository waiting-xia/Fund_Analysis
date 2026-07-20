import type { SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "pulse"
  | "chart"
  | "shield"
  | "holdings"
  | "sparkles"
  | "globe"
  | "bookmark"
  | "clock"
  | "link"
  | "chevronDown"
  | "trendUp"
  | "trendDown"
  | "refresh"
  | "database"
  | "alert"
  | "activity"
  | "flow"
  | "compass"
  | "layers"
  | "info"
  | "wallet"
  | "calendar"
  | "arrowRight"
  | "gauge"
  | "target"
  | "bolt"
  | "check"
  | "newspaper"
  | "arrowUpRight"
  | "report"
  | "sunrise"
  | "moon"
  | "fileText"
  | "swap"
  | "plus"
  | "minus";

export function Icon({ name, className, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const content: Record<IconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    pulse: <><path d="M3 12h4l2.2-5 4.1 10 2.2-5H21"/><path d="M4 5.5A9 9 0 0 1 20 7M20 18.5A9 9 0 0 1 4 17" opacity=".42"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 3.2-3.5 3 2.1L19 7"/></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    holdings: <><path d="M4 5.5h16M4 12h16M4 18.5h16"/><circle cx="7" cy="5.5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="10" cy="18.5" r="1.5"/></>,
    sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3ZM5.5 14l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z"/></>,
    bookmark: <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.8L6 21V4.5Z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    link: <><path d="M9.5 14.5 14.5 9"/><path d="M7.5 17.5H6a4 4 0 0 1 0-8h3M16.5 6.5H18a4 4 0 0 1 0 8h-3"/></>,
    chevronDown: <path d="m6.5 9 5.5 5.5L17.5 9"/>,
    trendUp: <><path d="m4 16 5-5 3.5 3.5L20 7"/><path d="M14 7h6v6"/></>,
    trendDown: <><path d="m4 8 5 5 3.5-3.5L20 17"/><path d="M14 17h6v-6"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M18.3 16A8 8 0 1 1 19 8l1 4"/></>,
    database: <><ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    alert: <><path d="M10.3 4.3 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    activity: <><path d="M3 12h4l2-6 4 12 2-6h6"/><path d="M4 4v3M20 17v3" opacity=".4"/></>,
    flow: <><path d="M4 7h12M13 4l3 3-3 3M20 17H8M11 14l-3 3 3 3"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v15H6.5A2.5 2.5 0 0 1 4 17.5v-11Z"/><path d="M4 8h15M15 12h5v4h-5a2 2 0 0 1 0-4Z"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    arrowRight: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    gauge: <><path d="M4.2 17a9 9 0 1 1 15.6 0"/><path d="m12 12 4-4M7 17h10"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    newspaper: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h3M13 12h3M8 16h3M13 16h3"/></>,
    arrowUpRight: <><path d="M7 17 17 7M8 7h9v9"/></>,
    report: <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 11h6M9 15h6"/></>,
    sunrise: <><path d="M4 18h16M6 14a6 6 0 0 1 12 0M12 3v4M4.2 7.2l2.6 2.6M19.8 7.2l-2.6 2.6"/></>,
    moon: <path d="M20 15.3A8.5 8.5 0 0 1 8.7 4 8.5 8.5 0 1 0 20 15.3Z"/>,
    fileText: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6M9 16h6"/></>,
    swap: <><path d="M7 7h12l-3-3M17 17H5l3 3"/><path d="m19 7-3 3M5 17l3-3"/></>,
    plus: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    minus: <><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></>,
  };

  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{content[name]}</svg>;
}
