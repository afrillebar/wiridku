"use client";

import { useEffect, useState } from "react";

const KEY = "wiridku-admin-theme";
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
}

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
  const [theme, setTheme] = useState<Theme>("kertas");
  useEffect(() => setTheme(readTheme()), []);

  return (
    <label className="theme-switch">
      Tema
      <select
        aria-label="Tema panel"
        value={theme}
        onChange={(e) => {
          const next = e.target.value === "malam" ? "malam" : "kertas";
          setTheme(next);
          applyAdminTheme(next);
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
