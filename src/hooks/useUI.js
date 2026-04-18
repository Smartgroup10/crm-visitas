import { useContext } from "react";

import { UIContext } from "../context/UIContext";

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUI debe usarse dentro de <UIProvider>");
  }
  return ctx;
}
