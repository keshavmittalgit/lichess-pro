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

// --- Helper Functions ---
function detectPlayerColor(): "white" | "black" | null {
  const cgWrap = document.querySelector(".cg-wrap")
  if (!cgWrap) return null
  return cgWrap.classList.contains("orientation-black") ? "black" : "white"
}

function detectGameVariant(): string | null {
  const setupElement = document.querySelector(".round__side .setup")
  if (!setupElement) {
    console.log("🔍 Variant element not found yet...")
    return null
  }
  
  const text = setupElement.textContent || ""
  console.log("🔍 Raw setup text:", text)
  
  const parts = text.split("•").map(p => p.trim())
  console.log("🔍 Split parts:", parts)
  
  // The variant name is almost always the first part (e.g., "Crazyhouse • 1+0 • Rated")
  const variant = parts[0]
  console.log("🔍 Detected variant:", variant)

  if (variant) {
    chrome.runtime.sendMessage({ type: "SET_VARIANT", variant })
  }
  
  return variant
}

// Handle WebSocket and Navigation messages
function setupMessageListeners(
  setPlayerColor: (c: any) => void, 
  setCurrentPly: (p: any) => void,
  setAnalysisData: (d: any) => void
) {
  let lastPly = -1
  const listener = (event: MessageEvent) => {
    // Handle WebSocket
    if (event.data?.type === "LICHESS_WS") {
      const data = event.data.data

      if (data.t === "move" || (data.d?.ply !== undefined && data.d?.ply > 0)) {
        const newPly = data.d?.ply
        if (newPly !== undefined && newPly !== lastPly) {
          lastPly = newPly
          
          if (!gameStarted) {
            gameStarted = true
            const color = detectPlayerColor()
            setPlayerColor(color)
            detectGameVariant()
          }

          // IMMEDIATELY clear old analysis when a move happens
          setAnalysisData(null)
          setCurrentPly(newPly)
          
          const overlay = document.getElementById("lichess-analysis-overlay")
          if (overlay) overlay.innerHTML = ""
          const pocketOverlay = document.getElementById("lichess-pocket-overlay")
          if (pocketOverlay) pocketOverlay.remove()

          // Only send to engine if it's a new ply
          chrome.runtime.sendMessage({ type: "LICHESS_MOVE", payload: data })
        }
      }

      if (data.t === "endData" || data.t === "end" || data.d?.status) {
        localStorage.removeItem("lichess-analysis-data")
        gameStarted = false
        setPlayerColor(null)
        setCurrentPly(-1)
        chrome.runtime.sendMessage({ type: "RESET_ENGINE" })
      }
    }

    // Handle SPA Navigation from Interceptor
    if (event.data?.type === "LICHESS_NAV") {
      console.log("📍 SPA Navigation detected, re-initializing...")
      initTheme()
      gameStarted = false
      setPlayerColor(null)
      setCurrentPly(-1)
      chrome.runtime.sendMessage({ type: "RESET_ENGINE" })
      window.dispatchEvent(new CustomEvent("lichess-nav-reset"))
      setTimeout(() => detectGameVariant(), 500)
    }
  }

  window.addEventListener("message", listener)
  return () => window.removeEventListener("message", listener)
}

// Early theme initialization
initTheme()

export default function Content() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [showArrows, setShowArrows] = useState(true)
  const [showPlayerBestMove, setShowPlayerBestMove] = useState(true)
  const [showOpponentBestMove, setShowOpponentBestMove] = useState(true)
  const [showAnalysisBar, setShowAnalysisBar] = useState(true)
  const [resizeCounter, setResizeCounter] = useState(0)
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null)
  const [currentPly, setCurrentPly] = useState(-1)
  const [boardExists, setBoardExists] = useState(false)

  // 1. Initial Load & Preferences
  useEffect(() => {
    const savedArrows = localStorage.getItem("lichess-show-arrows")
    if (savedArrows !== null) setShowArrows(savedArrows === "true")
    
    const savedData = localStorage.getItem("lichess-analysis-data")
    if (savedData) {
      try { setAnalysisData(JSON.parse(savedData)) } 
      catch { localStorage.removeItem("lichess-analysis-data") }
    }

    // Load initial settings from chrome storage
    chrome.storage.local.get([
      "showPlayerBestMove", 
      "showOpponentBestMove", 
      "showAnalysisBar"
    ], (result) => {
      if (result.showPlayerBestMove !== undefined) setShowPlayerBestMove(result.showPlayerBestMove)
      if (result.showOpponentBestMove !== undefined) setShowOpponentBestMove(result.showOpponentBestMove)
      if (result.showAnalysisBar !== undefined) setShowAnalysisBar(result.showAnalysisBar)
    })

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

    // Initial detection
    setPlayerColor(detectPlayerColor())

    const cleanupMessages = setupMessageListeners(setPlayerColor, setCurrentPly, setAnalysisData)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
      window.removeEventListener("lichess-nav-reset", handleNavReset)
      cleanupMessages()
    }
  }, [])

  // Board Presence Watcher
  useEffect(() => {
    const checkBoard = () => {
      const board = document.querySelector("cg-board")
      setBoardExists(!!board)
    }
    const interval = setInterval(checkBoard, 500)
    checkBoard()
    return () => clearInterval(interval)
  }, [])

  // 2. Listeners: Resize & Storage
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.themeId) {
        const theme = THEMES.find(t => t.id === changes.themeId.newValue) || THEMES[0]
        applyTheme(theme)
        setResizeCounter(c => c + 1) // Force UI update
      }
      if (changes.showPlayerBestMove) setShowPlayerBestMove(changes.showPlayerBestMove.newValue)
      if (changes.showOpponentBestMove) setShowOpponentBestMove(changes.showOpponentBestMove.newValue)
      if (changes.showAnalysisBar) {
        setShowAnalysisBar(changes.showAnalysisBar.newValue)
        if (!changes.showAnalysisBar.newValue) {
          document.getElementById("eval-bar-container")?.remove()
          document.getElementById("win-percent-display")?.remove()
        }
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
    if (!showAnalysisBar) {
      evalBar?.remove()
    } else {
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
      if (whiteBar && analysisData) {
        const { evalBarPercent } = calculateEvaluation(analysisData)
        whiteBar.style.height = `${evalBarPercent}%`
      }
    }

    // --- Win Percent Display ---
    let winDisplay = document.getElementById("win-percent-display")
    if (!showAnalysisBar) {
      winDisplay?.remove()
    } else {
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
    }

    // --- Arrows ---
    const currentTurnColor = (currentPly >= 0 ? currentPly : 0) % 2 === 0 ? "white" : "black"
    const isPlayerTurn = playerColor === currentTurnColor
    
    const shouldShowArrows = showArrows && (
      (isPlayerTurn && showPlayerBestMove) || 
      (!isPlayerTurn && showOpponentBestMove)
    )

    drawBestMove(analysisData, shouldShowArrows)

  }, [analysisData, showArrows, showPlayerBestMove, showOpponentBestMove, showAnalysisBar, resizeCounter, playerColor, currentPly, boardExists])

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

    const targetNode = document.body || document.documentElement
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true })
    }
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
