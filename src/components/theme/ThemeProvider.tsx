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
  return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
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
  window.localStorage.setItem(STORAGE_KEY, theme);
  subscribers.forEach((callback) => callback());
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    saveTheme(theme === "light" ? "dark" : "light");
  }

  const contextValue = { theme, toggleTheme };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
      <button
        aria-label={
          theme === "light"
            ? "Включить тёмную тему"
            : "Включить светлую тему"
        }
        className="theme-toggle"
        onClick={toggleTheme}
        type="button"
      >
        {theme === "light" ? (
          <Moon aria-hidden="true" />
        ) : (
          <Sun aria-hidden="true" />
        )}
      </button>
    </ThemeContext.Provider>
  );
}
