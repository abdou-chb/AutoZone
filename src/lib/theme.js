import { useSyncExternalStore } from "react";

export const THEME_KEY = "autozone:theme";
const COLORS = { light: "#ffffff", dark: "#121619" };
const listeners = new Set();

export function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme, remember) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLORS[theme]);

  if (!remember) {
    return;
  }

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

export function setTheme(theme, origin, { remember = true, animate = true } = {}) {
  if (theme === getTheme()) {
    return;
  }

  const notify = () => listeners.forEach((listener) => listener());
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!document.startViewTransition || reduce || !animate) {
    apply(theme, remember);
    notify();
    return;
  }

  const root = document.documentElement;
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? 0;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  root.style.setProperty("--reveal-x", `${x}px`);
  root.style.setProperty("--reveal-y", `${y}px`);
  root.style.setProperty("--reveal-r", `${radius}px`);

  document.startViewTransition(() => {
    apply(theme, remember);
    notify();
  });
}

function subscribe(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme);
}
