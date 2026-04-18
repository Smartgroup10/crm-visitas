import { useEffect, useState } from "react";

export function useLocalStorage(key, initialValue, options = {}) {
  const { parser } = options;

  const [value, setValue] = useState(() => {
    if (typeof localStorage === "undefined") return initialValue;
    const saved = localStorage.getItem(key);
    if (!saved) return initialValue;
    try {
      const parsed = JSON.parse(saved);
      return parser ? parser(parsed, initialValue) : parsed;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // noop: storage full or unavailable
    }
  }, [key, value]);

  return [value, setValue];
}
