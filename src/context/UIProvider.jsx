import { useState } from "react";

import { CALENDAR_MODES, UI_STORAGE_KEY, VALID_SECTIONS } from "../data/constants";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { UIContext } from "./UIContext";

const DEFAULT_UI = {
  section: "inicio",
  activeView: "Calendario",
  calendarMode: "mes",
  search: "",
  personFilter: "Todos",
  statusFilter: "Todos",
  priorityFilter: "Todas",
  categoryFilter: "Todas",
};

export function UIProvider({ children }) {
  const [ui, setUi] = useLocalStorage(UI_STORAGE_KEY, DEFAULT_UI, {
    parser: (parsed, fallback) => {
      if (!parsed || typeof parsed !== "object") return fallback;
      const merged = { ...fallback, ...parsed };
      if (!VALID_SECTIONS.includes(merged.section)) {
        merged.section = fallback.section;
      }
      if (!CALENDAR_MODES.includes(merged.calendarMode)) {
        merged.calendarMode = fallback.calendarMode;
      }
      return merged;
    },
  });

  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [counterFilter, setCounterFilter] = useState("Total");
  const [counterSearch, setCounterSearch] = useState("");

  const setSection = (v) => setUi((u) => ({ ...u, section: v }));
  const setActiveView = (v) => setUi((u) => ({ ...u, activeView: v }));
  const setCalendarMode = (v) => setUi((u) => ({ ...u, calendarMode: v }));
  const setSearch = (v) => setUi((u) => ({ ...u, search: v }));
  const setPersonFilter = (v) => setUi((u) => ({ ...u, personFilter: v }));
  const setStatusFilter = (v) => setUi((u) => ({ ...u, statusFilter: v }));
  const setPriorityFilter = (v) => setUi((u) => ({ ...u, priorityFilter: v }));
  const setCategoryFilter = (v) => setUi((u) => ({ ...u, categoryFilter: v }));

  function resetFilters() {
    setUi((u) => ({
      ...u,
      search: "",
      personFilter: "Todos",
      statusFilter: "Todos",
      priorityFilter: "Todas",
      categoryFilter: "Todas",
    }));
  }

  function openCounterModal(filterName) {
    setCounterFilter(filterName);
    setCounterSearch("");
    setCounterModalOpen(true);
  }

  const value = {
    section: ui.section,
    activeView: ui.activeView,
    calendarMode: ui.calendarMode,
    search: ui.search,
    personFilter: ui.personFilter,
    statusFilter: ui.statusFilter,
    priorityFilter: ui.priorityFilter,
    categoryFilter: ui.categoryFilter,
    setUi,
    setSection,
    setActiveView,
    setCalendarMode,
    setSearch,
    setPersonFilter,
    setStatusFilter,
    setPriorityFilter,
    setCategoryFilter,
    resetFilters,
    counterModalOpen,
    counterFilter,
    counterSearch,
    setCounterModalOpen,
    setCounterFilter,
    setCounterSearch,
    openCounterModal,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
