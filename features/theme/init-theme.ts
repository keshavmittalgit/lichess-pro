import { THEMES } from "../../constants/themes"
import { applyTheme } from "./theme-engine"

export const initTheme = async () => {
  const path = window.location.pathname
  const isBoardPage = (path.startsWith("/analysis") || 
                      path.startsWith("/tv") || 
                      path.startsWith("/training") ||
                      /^\/[a-zA-Z0-9]{8,12}(\/|$)/.test(path)) &&
                      !path.startsWith("/broadcast") &&
                      !path.startsWith("/player")

  const result = await chrome.storage.local.get(["themeId"])
  const themeId = result.themeId || "default"
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0]

  // If we don't need a theme or loading screen, reveal immediately and exit
  if (!isBoardPage || theme.id === "default") {
    // If we're on default theme, ensure any previous custom theme is removed
    if (theme.id === "default") {
      applyTheme(theme)
    }
    document.documentElement.classList.add("theme-loaded")
    return
  }


  // Prevent multiple loaders
  if (document.getElementById("lichess-pro-loader")) return

  // 1. Create and show loading splash screen
  const loadingOverlay = document.createElement("div")
  loadingOverlay.id = "lichess-pro-loader"
  Object.assign(loadingOverlay.style, {
    position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
    backgroundColor: "#161512", display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center", zIndex: "999999",
    transition: "opacity 0.4s ease-out, visibility 0.4s",
    fontFamily: "system-ui, -apple-system, sans-serif"
  })

  loadingOverlay.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 24px; color: #fff; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px;">Lichess Pro</div>
      <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #769656; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto;"></div>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `
  document.documentElement.appendChild(loadingOverlay)

  // 2. Apply theme and reveal
  applyTheme(theme)
  
  // Wait a bit to ensure theme is applied before revealing
  setTimeout(() => {
    document.documentElement.classList.add("theme-loaded")
    loadingOverlay.style.opacity = "0"
    loadingOverlay.style.visibility = "hidden"
    setTimeout(() => loadingOverlay.remove(), 400)
  }, 300)
}
