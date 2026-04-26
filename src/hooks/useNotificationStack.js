import { useContext } from "react";

import { NotificationStackContext } from "../context/NotificationStackContext";

export function useNotificationStack() {
  const ctx = useContext(NotificationStackContext);
  if (!ctx) {
    throw new Error("useNotificationStack debe usarse dentro de <NotificationStackProvider>");
  }
  return ctx;
}
