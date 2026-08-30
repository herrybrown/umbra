"use client";

import { useEffect, useState } from "react";
import { UmbraLogo } from "./UmbraLogo";

type Theme = "dark" | "light";
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

const STORAGE_KEY = "umbra-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    if (root.classList.contains("theme-shifting")) return;

    const nextTheme: Theme =
      root.dataset.theme === "light" ? "dark" : "light";

    const applyTheme = () => {
      root.dataset.theme = nextTheme;
      root.style.colorScheme = nextTheme;
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // The active theme still applies when storage is unavailable.
      }
      setTheme(nextTheme);
    };

    root.classList.add("theme-shifting");
    window.setTimeout(() => root.classList.remove("theme-shifting"), 720);

    const transitionDocument = document as ViewTransitionDocument;
    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(applyTheme);
    } else {
      applyTheme();
    }
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span className="theme-toggle__glyph">
        <UmbraLogo size={21} />
      </span>
    </button>
  );
}
