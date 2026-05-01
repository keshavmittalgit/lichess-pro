import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState, useCallback } from "react"
import { THEMES, type Theme } from "~constants/themes"
import "./content.css"
import { initTheme } from "~features/theme/init-theme"
import { applyTheme } from "~features/theme/theme-engine"
import { calculateEvaluation, type AnalysisData } from "~features/analysis/eval-utils"
import { drawBestMove } from "~features/analysis/arrow-engine"

export const config: PlasmoCSConfig = {
  matches: ["https://lichess.org/*"],
  run_at: "document_start"
}

// --- Global State ---
let gameStarted = false
let playerColor: "white" | "black" | null = null 
let currentPly = -1 

// --- Helper Functions ---
function detectPlayerColor(): "white" | "black" | null {
  const cgWrap = document.querySelector(".cg-wrap")
  if (!cgWrap) return null
  return cgWrap.classList.contains("orientation-black") ? "black" : "white"
}

// Handle WebSocket and Navigation messages
window.addEventListener("message", (event) => {
  // Handle WebSocket
  if (event.data?.type === "LICHESS_WS") {
    const data = event.data.data

    if (data.t === "move" || (data.d?.ply !== undefined && data.d?.ply > 0)) {
      if (!gameStarted) {
        gameStarted = true
        playerColor = detectPlayerColor()
      }

      const newPly = data.d?.ply
      if (newPly !== undefined && newPly !== currentPly) {
        currentPly = newPly
        const overlay = document.getElementById("lichess-analysis-overlay")
        if (overlay) overlay.innerHTML = ""
        const pocketOverlay = document.getElementById("lichess-pocket-overlay")
        if (pocketOverlay) pocketOverlay.remove()
      }

      const currentTurnColor = (data.d?.ply ?? 0) % 2 === 0 ? "white" : "black"
      if (playerColor === currentTurnColor) {
        chrome.runtime.sendMessage({ type: "LICHESS_MOVE", payload: data })
      }
    }

    if (data.t === "endData" || data.t === "end" || data.d?.status) {
      localStorage.removeItem("lichess-analysis-data")
      gameStarted = false
      playerColor = null
      currentPly = -1
    }
  }

  // Handle SPA Navigation from Interceptor
  if (event.data?.type === "LICHESS_NAV") {
    console.log("📍 SPA Navigation detected, re-initializing...")
    initTheme()
    // Reset internal state for new game
    gameStarted = false
    playerColor = null
    currentPly = -1
    // Dispatch event for React to clear state
    window.dispatchEvent(new CustomEvent("lichess-nav-reset"))
  }
})

// Early theme initialization
initTheme()

export default function Content() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [showArrows, setShowArrows] = useState(true)
  const [resizeCounter, setResizeCounter] = useState(0)

  // 1. Initial Load & Preferences
  useEffect(() => {
    const savedArrows = localStorage.getItem("lichess-show-arrows")
    if (savedArrows !== null) setShowArrows(savedArrows === "true")
    
    const savedData = localStorage.getItem("lichess-analysis-data")
    if (savedData) {
      try { setAnalysisData(JSON.parse(savedData)) } 
      catch { localStorage.removeItem("lichess-analysis-data") }
    }

    const messageListener = (message: any) => {
      if (message.type === "BEST_MOVE") {
        setAnalysisData(message.data)
        localStorage.setItem("lichess-analysis-data", JSON.stringify(message.data))
      }
    }

    const handleNavReset = () => {
      setAnalysisData(null)
      localStorage.removeItem("lichess-analysis-data")
      // Clear existing UI elements
      const els = ["eval-bar-container", "win-percent-display", "lichess-analysis-overlay", "arrow-toggle-container"]
      els.forEach(id => document.getElementById(id)?.remove())
    }

    chrome.runtime.onMessage.addListener(messageListener)
    window.addEventListener("lichess-nav-reset", handleNavReset)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
      window.removeEventListener("lichess-nav-reset", handleNavReset)
    }
  }, [])

  // 2. Listeners: Resize & Storage
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.themeId) {
        const theme = THEMES.find(t => t.id === changes.themeId.newValue) || THEMES[0]
        applyTheme(theme)
        setResizeCounter(c => c + 1) // Force UI update
      }
    }
    const handleResize = () => setResizeCounter(c => c + 1)

    chrome.storage.onChanged.addListener(handleStorageChange)
    window.addEventListener("resize", handleResize)
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // 3. Move List Watcher
  useEffect(() => {
    const checkMoveList = () => {
      const moveList = document.querySelector("rm6")
      if (moveList && !moveList.querySelector("l4x")) {
        localStorage.removeItem("lichess-analysis-data")
        setAnalysisData(null)
        const overlay = document.getElementById("lichess-analysis-overlay")
        if (overlay) overlay.innerHTML = ""
      }
    }
    const moveList = document.querySelector("rm6")
    if (moveList) {
      const observer = new MutationObserver(checkMoveList)
      observer.observe(moveList, { childList: true, subtree: true })
      return () => observer.disconnect()
    }
  }, [])

  // 4. Update Main Display
  useEffect(() => {
    const board = document.querySelector("cg-board")
    if (!board) return

    // --- Eval Bar ---
    let evalBar = document.getElementById("eval-bar-container")
    if (!evalBar) {
      evalBar = document.createElement("div")
      evalBar.id = "eval-bar-container"
      const isMobile = window.innerWidth < 768
      const cgWrap = document.querySelector(".cg-wrap")
      const isBlack = cgWrap?.classList.contains("orientation-black")
      
      evalBar.style.cssText = `
        position: absolute !important;
        left: ${isMobile ? "-15px" : "-4px"} !important;
        top: 0 !important; width: ${isMobile ? "20px" : "6px"} !important; height: 100% !important;
        background: #000 !important; z-index: 99 !important; pointer-events: none !important;
        ${isBlack ? "border-top-right-radius: 2px; border-bottom-right-radius: 2px;" : "border-top-left-radius: 2px; border-bottom-left-radius: 2px;"}
        transform: ${isBlack ? "rotate(180deg)" : "none"} !important;
      `
      const whiteBar = document.createElement("div")
      whiteBar.id = "eval-bar-white"
      whiteBar.style.cssText = "position:absolute; bottom:0; width:100%; background:#fff; transition:height 0.3s ease; height:50%;"
      evalBar.appendChild(whiteBar)
      board.appendChild(evalBar)
    }

    const whiteBar = document.getElementById("eval-bar-white")
    if (whiteBar) {
      const { evalBarPercent } = analysisData ? calculateEvaluation(analysisData) : { evalBarPercent: 50 }
      whiteBar.style.height = `${evalBarPercent}%`
    }

    // --- Win Percent Display ---
    let winDisplay = document.getElementById("win-percent-display")
    if (!winDisplay) {
      winDisplay = document.createElement("div")
      winDisplay.id = "win-percent-display"
      winDisplay.style.cssText = "position:absolute; top:-12px; left:50%; transform:translateX(-50%); z-index:99; color:white; font-size:12px; font-weight:600; text-shadow:0 1px 3px #000; pointer-events:none; white-space:nowrap;"
      board.appendChild(winDisplay)
    }

    if (analysisData) {
      let text = ""
      if (analysisData.score_mate !== null) {
        text = `${analysisData.score_mate > 0 ? "W" : "B"}-M${Math.abs(analysisData.score_mate)}`
      } else if (analysisData.score_cp !== null) {
        const cp = analysisData.score_cp
        text = cp > 0 ? `W+${(cp/100).toFixed(1)}` : `B+${Math.abs(cp/100).toFixed(1)}`
      }
      if (analysisData.best_move?.length === 5 && !analysisData.best_move.includes("@")) {
        text += `  ➔ ${analysisData.best_move[4].toUpperCase()}`
      }
      winDisplay.textContent = text
    } else {
      winDisplay.textContent = ""
    }

    // --- Arrows ---
    drawBestMove(analysisData, showArrows)

  }, [analysisData, showArrows, resizeCounter])

  // 5. Promotion Highlighting
  useEffect(() => {
    if (!analysisData?.best_move || !showArrows) return
    const bestMove = analysisData.best_move
    if (bestMove.length !== 5 || bestMove.includes("@")) return

    const role = { q: "queen", r: "rook", b: "bishop", n: "knight" }[bestMove[4].toLowerCase()]
    if (!role) return

    const observer = new MutationObserver(() => {
      const target = document.getElementById("promotion-choice")?.querySelector(`piece.${role}`)
      if (target) target.closest("square")?.classList.add("promotion-highlight")
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [analysisData, showArrows])

  // 6. Toggle Button
  const toggleArrows = useCallback(() => {
    setShowArrows(prev => {
      const next = !prev
      localStorage.setItem("lichess-show-arrows", String(next))
      return next
    })
  }, [])

  useEffect(() => {
    const board = document.querySelector("cg-board")
    if (!board) return

    let container = document.getElementById("arrow-toggle-container")
    if (!container) {
      container = document.createElement("div")
      container.id = "arrow-toggle-container"
      const isMobile = window.innerWidth < 768
      container.style.cssText = `
        position: absolute !important;
        ${isMobile ? "bottom:-25px; left:50%; transform:translateX(calc(-50% + 20px));" : "bottom:-20px; right:0;"}
        z-index: 99; cursor: pointer; display: flex; align-items: center; gap: 8px;
      `
      container.innerHTML = `
        <span style="color:white; font-size:${isMobile ? "10px" : "12px"}; font-weight:500; text-shadow:0 1px 2px #000; user-select:none;">Best moves</span>
        <div id="arrow-toggle-switch" style="width:36px; height:20px; border-radius:10px; position:relative; transition:background 0.3s; box-shadow:0 2px 6px #0004; border:2px solid #ffffff4d;">
          <div id="arrow-toggle-knob" style="width:14px; height:14px; background:#fff; border-radius:50%; position:absolute; top:1px; transition:left 0.3s; box-shadow:0 2px 4px #0004;"></div>
        </div>
      `
      board.appendChild(container)
    }

    const sw = document.getElementById("arrow-toggle-switch")
    const knob = document.getElementById("arrow-toggle-knob")
    if (sw) sw.style.background = showArrows ? "rgba(181, 136, 99, 0.9)" : "rgba(128, 128, 128, 0.6)"
    if (knob) knob.style.left = showArrows ? "18px" : "1px"
    
    const click = (e: MouseEvent) => { e.stopPropagation(); toggleArrows(); }
    container.addEventListener("click", click)
    return () => container?.removeEventListener("click", click)
  }, [showArrows, toggleArrows])

  return null
}
