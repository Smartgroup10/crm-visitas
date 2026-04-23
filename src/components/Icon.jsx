/**
 * Iconos SVG inline, estilo Lucide (stroke 1.8, redondeado, currentColor).
 * Se usan en toda la app para evitar depender de una librería externa
 * y para que el color/tamaño se controle desde CSS (font-size + color).
 */

const base = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconHome(p)       { return <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /><path d="M10 20v-5h4v5" /></svg>; }
export function IconCheckSquare(p){ return <svg {...base} {...p}><path d="m9 11 3 3 5-6" /><rect x="3" y="3" width="18" height="18" rx="3" /></svg>; }
export function IconClipboard(p)  { return <svg {...base} {...p}><rect x="7" y="4" width="10" height="4" rx="1.2" /><path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" /><path d="m9 13 2 2 4-4" /></svg>; }
export function IconUsers(p)      { return <svg {...base} {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
export function IconWrench(p)     { return <svg {...base} {...p}><path d="M14.7 6.3a3.5 3.5 0 0 1 4.6 4.6L11.5 18.7 6 20l1.3-5.5 7.4-8.2z" /><path d="m13 8 3 3" /></svg>; }
export function IconBarChart(p)   { return <svg {...base} {...p}><path d="M3 3v18h18" /><rect x="7"  y="12" width="3" height="6" rx="0.6" /><rect x="12" y="8"  width="3" height="10" rx="0.6" /><rect x="17" y="5"  width="3" height="13" rx="0.6" /></svg>; }
export function IconKey(p)        { return <svg {...base} {...p}><circle cx="8" cy="15" r="4" /><path d="m10.85 12.15 8.65-8.65" /><path d="m15 8 3 3" /><path d="m18 5 2 2" /></svg>; }
export function IconLogOut(p)     { return <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>; }
export function IconAlert(p)      { return <svg {...base} {...p}><path d="M10.3 3.85 1.8 18.5A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.85a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" /></svg>; }
export function IconPlus(p)       { return <svg {...base} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></svg>; }
export function IconSearch(p)     { return <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>; }
