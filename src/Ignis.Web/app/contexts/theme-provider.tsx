import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // Ensure browser APIs are available (not available during SSR)
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // Check localStorage or system preference
    const savedTheme =
      typeof window.localStorage !== "undefined"
        ? (window.localStorage.getItem("theme") as Theme | null)
        : null;

    const prefersDarkQuery = "(prefers-color-scheme: dark)";
    const systemPrefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia(prefersDarkQuery).matches;

    const systemTheme: Theme = systemPrefersDark ? "dark" : "light";

    const initialTheme = savedTheme ?? systemTheme;
    setThemeState(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  const setTheme = (newTheme: Theme) => {
    // Guard against environments without window/document (e.g., SSR)
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    setThemeState(newTheme);

    if (typeof window.localStorage !== "undefined") {
      window.localStorage.setItem("theme", newTheme);
    }
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
