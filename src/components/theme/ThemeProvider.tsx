"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "vibely-theme";
const subscribers = new Set<() => void>();

function getThemeSnapshot(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch (error) {
    console.error("Не удалось прочитать сохранённую тему.", error);
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function subscribeToTheme(callback: () => void) {
  subscribers.add(callback);

  function handleStorageChange(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      callback();
    }
  }

  window.addEventListener("storage", handleStorageChange);

  return () => {
    subscribers.delete(callback);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function saveTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch (error) {
    console.error("Не удалось сохранить выбранную тему.", error);
  }
  subscribers.forEach((callback) => callback());
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.themeChanging = "true";
  root.dataset.theme = theme;
  window.setTimeout(() => {
    delete root.dataset.themeChanging;
  }, 120);
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}

export function ThemeToggle({ inline = false }: { inline?: boolean }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      aria-label={
        theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"
      }
      className={`theme-toggle${inline ? " theme-toggle--inline" : ""}`}
      onClick={toggleTheme}
      type="button"
    >
      {theme === "light" ? (
        <Moon aria-hidden="true" />
      ) : (
        <Sun aria-hidden="true" />
      )}
    </button>
  );
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    if (document.documentElement.dataset.theme !== theme) {
      applyTheme(theme);
    }
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  }

  const contextValue = { theme, toggleTheme };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
