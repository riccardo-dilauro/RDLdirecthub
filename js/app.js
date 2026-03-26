function setActiveNavLink() {
  const path = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isActive = href === path;

    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

const THEME_KEY = "alanly-theme";

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }
  } catch {
    // Ignore storage access issues and fall back to system preference.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  const body = document.body;

  body.setAttribute("data-theme", isDark ? "dark" : "light");

  const toggleButton = document.querySelector("[data-theme-toggle]");
  if (!toggleButton) {
    return;
  }

  toggleButton.setAttribute("aria-pressed", String(isDark));
  toggleButton.dataset.theme = isDark ? "dark" : "light";
  toggleButton.setAttribute("aria-label", isDark ? "Attiva tema chiaro" : "Attiva tema scuro");
  toggleButton.setAttribute("title", isDark ? "Tema scuro attivo" : "Tema chiaro attivo");
}

function initThemeToggle() {
  const toggleButton = document.querySelector("[data-theme-toggle]");
  if (!toggleButton) {
    return;
  }

  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);

  toggleButton.addEventListener("click", () => {
    const nextTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";

    applyTheme(nextTheme);

    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // Ignore storage access issues.
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setActiveNavLink();
  initThemeToggle();
});
