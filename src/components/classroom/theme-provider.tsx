"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ClassroomTheme = "dark" | "light";
const STORAGE_KEY = "classroom:theme";
const ThemeContext = createContext<{
  theme: ClassroomTheme;
  toggleTheme: () => void;
} | null>(null);

export function ClassroomThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ClassroomTheme>("dark");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // Vẫn đổi giao diện được khi trình duyệt không cho lưu tùy chọn.
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Lựa chọn vẫn có hiệu lực cho lần mở lớp hiện tại.
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        className={`classroom-theme min-h-screen bg-classroom-background text-classroom-foreground${theme === "dark" ? " dark" : ""}`}
        data-classroom-theme={theme}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function ClassroomThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ClassroomThemeToggle cần ClassroomThemeProvider");
  const { theme, toggleTheme } = context;
  const label = theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-classroom-border bg-classroom-surface px-2.5 text-sm font-semibold text-classroom-secondary transition-colors hover:bg-classroom-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{theme === "dark" ? "Sáng" : "Tối"}</span>
    </button>
  );
}
