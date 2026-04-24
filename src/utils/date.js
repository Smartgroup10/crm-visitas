export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function formatMonthYear(date) {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getCalendarGrid(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekDay);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

/**
 * Devuelve los 7 días (lun–dom) de la semana ISO que contiene `isoDate`.
 * @param {string} isoDate
 * @returns {Date[]}
 */
export function getWeekGrid(isoDate) {
  const base = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  const dow = (base.getDay() + 6) % 7; // lunes = 0
  const monday = new Date(base);
  monday.setDate(base.getDate() - dow);

  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    cells.push(d);
  }
  return cells;
}

/**
 * "21 – 27 abr 2026"  (misma semana, mismo mes)
 * "29 mar – 4 abr 2026" (cambio de mes, mismo año)
 * "30 dic 2025 – 5 ene 2026" (cambio de año)
 */
export function formatWeekRange(isoDate) {
  const cells = getWeekGrid(isoDate);
  const first = cells[0];
  const last = cells[6];

  const sameMonth =
    first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  const sameYear = first.getFullYear() === last.getFullYear();

  if (sameMonth) {
    const monthYear = new Intl.DateTimeFormat("es-ES", {
      month: "short",
      year: "numeric",
    }).format(last);
    return `${first.getDate()} – ${last.getDate()} ${monthYear}`;
  }
  if (sameYear) {
    const firstFmt = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
    }).format(first);
    const lastFmt = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(last);
    return `${firstFmt} – ${lastFmt}`;
  }
  const firstFmt = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(first);
  const lastFmt = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(last);
  return `${firstFmt} – ${lastFmt}`;
}

/** "jueves, 23 de abril de 2026" */
export function formatLongDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Desplaza una fecha ISO ±N meses manteniendo el día de mes cuando se puede
 * (clampando al último día si el mes destino tiene menos días).
 */
export function shiftMonthIso(isoDate, offset) {
  const d = new Date(`${isoDate}T00:00:00`);
  const target = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), maxDay));
  return toISO(target);
}
