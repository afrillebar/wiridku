"use client";

import { useEffect, useSyncExternalStore } from "react";

const KEY = "wiridku-admin-theme";
const EVENT = "wiridku-admin-theme";
const THEMES = [
  { id: "kertas", label: "Kertas" },
  { id: "malam", label: "Malam" },
] as const;

type Theme = (typeof THEMES)[number]["id"];

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "malam" ? "malam" : "kertas";
  } catch {
    return "kertas";
  }
}

export function applyAdminTheme(theme: Theme) {
  if (theme === "malam") document.body.dataset.adminTheme = "malam";
  else delete document.body.dataset.adminTheme;
  try {
    if (theme === "malam") localStorage.setItem(KEY, theme);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function ThemeBoot() {
  useEffect(() => {
    applyAdminTheme(readTheme());
    return () => {
      delete document.body.dataset.adminTheme;
    };
  }, []);
  return null;
}

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "kertas" as Theme);

  return (
    <label className="theme-switch">
      Tema
      <select
        aria-label="Tema panel"
        value={theme}
        onChange={(e) => {
          applyAdminTheme(e.target.value === "malam" ? "malam" : "kertas");
        }}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
