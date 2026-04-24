import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { TASK_TYPES, TASK_TYPE_KEYS } from "../../data/taskTypes";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../../data/constants";
import { toISO, todayISO, addDays, formatShortDate } from "../../utils/date";
import { getClientName, getTechnicianName, peopleFromIds } from "../../utils/id";
import { statusSlug, getPriorityClass } from "../../utils/status";
import EmptyState from "../EmptyState";

// Paleta para donuts / barras apiladas — mezcla nuestros colores + tokens de tema.
const STATUS_COLORS = {
  "No iniciado": "#b0bac3",
  "En curso":    "#0073ea",
  "Listo":       "#00c875",
  "Bloqueado":   "#e2445c",
};

const PRIORITY_COLORS = {
  "Baja":    "#a0d3ff",
  "Media":   "#0073ea",
  "Alta":    "#fdab3d",
  "Urgente": "#e2445c",
};

const TYPE_COLORS = [
  "#0073ea",
  "#00c875",
  "#a358d0",
  "#fdab3d",
  "#e2445c",
  "#037f4c",
];

// ─── Presets de rango de fechas ──────────────────────────
function rangePreset(key) {
  const today = todayISO();
  switch (key) {
    case "7d":        return { from: addDays(today, -6),  to: today };
    case "30d":       return { from: addDays(today, -29), to: today };
    case "90d":       return { from: addDays(today, -89), to: today };
    case "year": {
      const now = new Date();
      const jan = new Date(now.getFullYear(), 0, 1);
      return { from: toISO(jan), to: today };
    }
    case "all":
    default:          return { from: "", to: "" };
  }
}

// Agrupa tareas por día (para la serie temporal).
function groupByDate(tasks) {
  const acc = {};
  for (const t of tasks) {
    if (!t.date) continue;
    acc[t.date] = (acc[t.date] || 0) + 1;
  }
  return Object.entries(acc)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count, label: formatShortDate(date) }));
}

// Escapa un valor para CSV RFC-4180: si contiene coma, comilla o salto, se
// envuelve entre comillas dobles y las comillas internas se duplican.
function csvCell(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  const lines = [
    header.join(","),
    ...rows.map((r) => header.map((k) => csvCell(r[k])).join(",")),
  ];
  // BOM para que Excel abra UTF-8 correctamente (tildes, ñ).
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InformesView({ tasks, users, clients, onEditTask }) {
  // ─── Filtros ────────────────────────────────────────────
  const [preset, setPreset] = useState("30d");
  const initial = rangePreset("30d");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo,   setDateTo]   = useState(initial.to);
  const [typeFilter,     setTypeFilter]     = useState("Todas");
  const [statusFilter,   setStatusFilter]   = useState("Todos");
  const [priorityFilter, setPriorityFilter] = useState("Todas");
  const [userFilter,     setUserFilter]     = useState("Todos");
  const [clientFilter,   setClientFilter]   = useState("Todos");

  function applyPreset(key) {
    setPreset(key);
    if (key !== "custom") {
      const r = rangePreset(key);
      setDateFrom(r.from);
      setDateTo(r.to);
    }
  }

  function resetFilters() {
    applyPreset("30d");
    setTypeFilter("Todas");
    setStatusFilter("Todos");
    setPriorityFilter("Todas");
    setUserFilter("Todos");
    setClientFilter("Todos");
  }

  // ─── Aplicación de filtros ───────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (dateFrom && (!t.date || t.date < dateFrom)) return false;
      if (dateTo   && (!t.date || t.date > dateTo))   return false;
      if (typeFilter     !== "Todas"  && t.type     !== typeFilter)     return false;
      if (statusFilter   !== "Todos"  && t.status   !== statusFilter)   return false;
      if (priorityFilter !== "Todas"  && t.priority !== priorityFilter) return false;
      if (userFilter     !== "Todos"  && !(t.technicianIds || []).includes(userFilter)) return false;
      if (clientFilter   !== "Todos"  && t.clientId !== clientFilter)   return false;
      return true;
    });
  }, [tasks, dateFrom, dateTo, typeFilter, statusFilter, priorityFilter, userFilter, clientFilter]);

  // ─── KPIs ──────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total    = filteredTasks.length;
    const done     = filteredTasks.filter((t) => t.status === "Listo").length;
    const blocked  = filteredTasks.filter((t) => t.status === "Bloqueado").length;
    const progress = filteredTasks.filter((t) => t.status === "En curso").length;
    const pending  = filteredTasks.filter((t) => t.status === "No iniciado").length;
    const urgent   = filteredTasks.filter((t) => t.priority === "Urgente").length;
    return {
      total,
      done,
      blocked,
      progress,
      pending,
      urgent,
      donePct:    total ? Math.round((done    / total) * 100) : 0,
      blockedPct: total ? Math.round((blocked / total) * 100) : 0,
    };
  }, [filteredTasks]);

  // ─── Serie temporal (tareas/día) ─────────────────────────
  const timeSeries = useMemo(() => groupByDate(filteredTasks), [filteredTasks]);

  // ─── Donut por tipo ──────────────────────────────────────
  const byType = useMemo(() => {
    const acc = {};
    for (const t of filteredTasks) {
      const key = t.type || "sin-tipo";
      acc[key] = (acc[key] || 0) + 1;
    }
    return Object.entries(acc).map(([k, v]) => ({
      name: TASK_TYPES[k]?.label || k,
      value: v,
      key: k,
    }));
  }, [filteredTasks]);

  // ─── Carga por técnico (barras apiladas por estado) ──────
  const byUser = useMemo(() => {
    const acc = {};
    // Inicializamos a 0 para todos los usuarios conocidos (así aparecen
    // en el gráfico aunque no tengan tareas en el rango filtrado).
    for (const u of users) {
      acc[u.id] = {
        id: u.id,
        name: u.name || u.email || "Sin nombre",
        "No iniciado": 0,
        "En curso":    0,
        "Listo":       0,
        "Bloqueado":   0,
        total: 0,
      };
    }
    for (const t of filteredTasks) {
      for (const id of t.technicianIds || []) {
        if (!acc[id]) {
          acc[id] = {
            id,
            name: getTechnicianName(id, users) || "Sin nombre",
            "No iniciado": 0, "En curso": 0, "Listo": 0, "Bloqueado": 0, total: 0,
          };
        }
        acc[id][t.status] = (acc[id][t.status] || 0) + 1;
        acc[id].total++;
      }
    }
    return Object.values(acc)
      .filter((u) => u.total > 0 || userFilter === "Todos")
      .sort((a, b) => b.total - a.total);
  }, [filteredTasks, users, userFilter]);

  // ─── Barras por prioridad ────────────────────────────────
  const byPriority = useMemo(() => {
    return PRIORITY_OPTIONS.map((p) => ({
      name: p,
      count: filteredTasks.filter((t) => t.priority === p).length,
    }));
  }, [filteredTasks]);

  // ─── Tabla ordenable ─────────────────────────────────────
  const [sortBy, setSortBy]       = useState("date");
  const [sortDir, setSortDir]     = useState("desc");

  const sortedRows = useMemo(() => {
    const rows = filteredTasks.slice();
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const va  = a[sortBy] ?? "";
      const vb  = b[sortBy] ?? "";
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
    return rows;
  }, [filteredTasks, sortBy, sortDir]);

  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  function exportCSV() {
    const rows = sortedRows.map((t) => ({
      Fecha:       t.date || "",
      Título:      t.title,
      Tipo:        TASK_TYPES[t.type]?.label || t.type || "",
      Cliente:     getClientName(t.clientId, clients),
      Estado:      t.status,
      Prioridad:   t.priority,
      Técnicos:    peopleFromIds(t.technicianIds, users),
      "Tiempo estimado": t.estimatedTime || "",
      Vehículo:    t.vehicle || "",
      Notas:       t.notes || "",
    }));
    downloadCSV(`informe-${todayISO()}.csv`, rows);
  }

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="informes-view">
      <div className="informes-header">
        <div>
          <h2>Informes</h2>
          <p>Histórico, estadísticas y rendimiento del equipo.</p>
        </div>
        <div className="informes-header-actions">
          <button type="button" className="btn-secondary" onClick={resetFilters}>
            Limpiar filtros
          </button>
          <button type="button" className="btn-primary" onClick={exportCSV} disabled={!filteredTasks.length}>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ─── Filtros ─────────────────────────── */}
      <div className="informes-filters">
        <div className="informes-range-presets">
          {[
            { k: "7d",     label: "7 días" },
            { k: "30d",    label: "30 días" },
            { k: "90d",    label: "90 días" },
            { k: "year",   label: "Este año" },
            { k: "all",    label: "Todo" },
            { k: "custom", label: "Personalizado" },
          ].map((r) => (
            <button
              key={r.k}
              type="button"
              className={`range-chip ${preset === r.k ? "active" : ""}`}
              onClick={() => applyPreset(r.k)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="informes-filters-grid">
          <label>
            <span>Desde</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPreset("custom"); }}
            />
          </label>
          <label>
            <span>Hasta</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPreset("custom"); }}
            />
          </label>
          <label>
            <span>Tipo</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="Todas">Todas</option>
              {TASK_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>{TASK_TYPES[k].label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Estado</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="Todos">Todos</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span>Prioridad</span>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="Todas">Todas</option>
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>
            <span>Técnico</span>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="Todos">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Cliente</span>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="Todos">Todos</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ─── KPIs ─────────────────────────────── */}
      <div className="kpi-row informes-kpis">
        <div className="kpi-card kpi-total">
          <span className="kpi-num">{kpis.total}</span>
          <span className="kpi-label">Tareas</span>
        </div>
        <div className="kpi-card kpi-rate">
          <span className="kpi-num">{kpis.donePct}%</span>
          <span className="kpi-label">Completadas</span>
        </div>
        <div className="kpi-card kpi-progress">
          <span className="kpi-num">{kpis.progress}</span>
          <span className="kpi-label">En curso</span>
        </div>
        <div className="kpi-card kpi-blocked">
          <span className="kpi-num">{kpis.blocked}</span>
          <span className="kpi-label">Bloqueadas ({kpis.blockedPct}%)</span>
        </div>
        <div className="kpi-card kpi-pending">
          <span className="kpi-num">{kpis.pending}</span>
          <span className="kpi-label">Sin iniciar</span>
        </div>
        <div className="kpi-card kpi-urgent">
          <span className="kpi-num">{kpis.urgent}</span>
          <span className="kpi-label">Urgentes</span>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="panel-block informes-empty">
          <EmptyState
            icon="inbox"
            title="Sin datos en este rango"
            description="Prueba a ampliar el periodo o a relajar algún filtro."
          />
        </div>
      ) : (
        <>
          {/* ─── Gráficos ────────────────────── */}
          <div className="informes-charts">
            <div className="panel-block">
              <div className="panel-block-header">
                <h2>Tareas por día</h2>
                <span>{timeSeries.length} días con actividad</span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={timeSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Tareas"
                      stroke="#0073ea"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel-block">
              <div className="panel-block-header">
                <h2>Por tipo</h2>
                <span>{byType.length} tipos</span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={byType}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {byType.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel-block">
              <div className="panel-block-header">
                <h2>Por prioridad</h2>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={byPriority} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Tareas">
                      {byPriority.map((p, i) => (
                        <Cell key={i} fill={PRIORITY_COLORS[p.name] || "#999"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel-block dashboard-full">
              <div className="panel-block-header">
                <h2>Carga por técnico</h2>
                <span>{byUser.length} personas</span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={Math.max(220, byUser.length * 36)}>
                  <BarChart
                    data={byUser}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {STATUS_OPTIONS.map((s) => (
                      <Bar
                        key={s}
                        dataKey={s}
                        stackId="load"
                        fill={STATUS_COLORS[s]}
                        name={s}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ─── Tabla detallada ────────────────── */}
          <div className="panel-block informes-table-panel">
            <div className="panel-block-header">
              <h2>Detalle</h2>
              <span>{sortedRows.length} tareas</span>
            </div>
            <div className="table-wrapper">
              <table className="tasks-table informes-table">
                <thead>
                  <tr>
                    <SortTh col="date"     label="Fecha"     sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                    <SortTh col="title"    label="Título"    sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                    <SortTh col="type"     label="Tipo"      sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                    <th>Cliente</th>
                    <SortTh col="status"   label="Estado"    sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                    <SortTh col="priority" label="Prioridad" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                    <th>Técnicos</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((t) => (
                    <tr key={t.id} onClick={() => onEditTask?.(t)}>
                      <td>{t.date ? formatShortDate(t.date) : "—"}</td>
                      <td>{t.title}</td>
                      <td>{TASK_TYPES[t.type]?.label || t.type || "—"}</td>
                      <td>{getClientName(t.clientId, clients) || "—"}</td>
                      <td><span className={`mini-status ${statusSlug(t.status)}`}>{t.status}</span></td>
                      <td><span className={`mini-priority ${getPriorityClass(t.priority)}`}>{t.priority}</span></td>
                      <td>{peopleFromIds(t.technicianIds, users) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SortTh({ col, label, sortBy, sortDir, onClick }) {
  const active = sortBy === col;
  return (
    <th
      className={`sortable ${active ? "active" : ""}`}
      onClick={() => onClick(col)}
      title="Ordenar"
    >
      {label}
      {active && <span className="sort-arrow"> {sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

