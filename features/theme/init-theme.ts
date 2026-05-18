import { THEMES, resolveTheme } from "../../constants/themes"
import { applyTheme } from "./theme-engine"

export const initTheme = async () => {
  const path = window.location.pathname
  const isBoardPage = (path.startsWith("/analysis") || 
                      path.startsWith("/tv") || 
                      path.startsWith("/training") ||
                      /^\/[a-zA-Z0-9]{8,12}(\/|$)/.test(path)) &&
                      !path.startsWith("/broadcast") &&
                      !path.startsWith("/player")

  const result = await chrome.storage.local.get(["themeId", "customBoardId", "customPieceId", "customBackgroundId"])
  const themeId = result.themeId || "default"
  const theme = resolveTheme(themeId, result.customBoardId, result.customPieceId, result.customBackgroundId)

  // Always apply/update theme state to prevent "ghost" themes from persisting during SPA navigation
  applyTheme(theme)

  const isAnalysisPage = path.startsWith("/analysis")

  if (!isBoardPage || theme.id === "default" || isAnalysisPage) {
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
      <div style="font-size: 24px; color: #fff; font-weight: bold; margin-bottom: 20px; letter-spacing: 1px;">Lichess Pro</div>
      <div class="spinner" style="width: 50px; height: 50px; margin: 0 auto;">
        <svg viewBox="-2 -2 54 54" style="width: 100%; height: 100%;">
          <g fill="none" stroke="#fff">
            <path stroke-width="3.779" d="m21.78 12.64c-1.284 8.436 8.943 12.7 14.54 17.61 3 2.632 4.412 4.442 5.684 7.93"></path>
            <path stroke-width="4.157" d="m43.19 36.32c2.817-1.203 6.659-5.482 5.441-7.623-2.251-3.957-8.883-14.69-11.89-19.73-0.4217-0.7079-0.2431-1.835 0.5931-3.3 1.358-2.38 1.956-5.628 1.956-5.628"></path>
            <path stroke-width="4.535" d="m37.45 2.178s-3.946 0.6463-6.237 2.234c-0.5998 0.4156-2.696 0.7984-3.896 0.6388-17.64-2.345-29.61 14.08-25.23 27.34 4.377 13.26 22.54 25.36 39.74 8.666"></path>
          </g>
        </svg>
      </div>
    </div>
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
