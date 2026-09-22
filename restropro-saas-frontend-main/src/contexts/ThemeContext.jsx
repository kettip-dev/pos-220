import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "black";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    document.documentElement.classList.remove("light", "black", "dark");
    if (theme !== "light") {
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "light" ? "black" : "light";
    document.documentElement.classList.remove("light", "black", "dark");
    if (next !== "light") {
      document.documentElement.classList.add("dark");
    }
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  return useContext(ThemeContext);
}
