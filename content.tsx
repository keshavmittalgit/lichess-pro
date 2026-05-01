import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
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

// Track game state and moves
let gameStarted = false
let playerColor: "white" | "black" | null = null 
let currentPly = -1 

// Helper function to detect player color from board orientation
function detectPlayerColor(): "white" | "black" | null {
  const cgWrap = document.querySelector(".cg-wrap")
  if (!cgWrap) return null

  const isBlackOrientation = cgWrap.classList.contains("orientation-black")
  return isBlackOrientation ? "black" : "white"
}

// Listen for messages from the Main World interceptor
window.addEventListener("message", (event) => {
  if (event.data?.type === "LICHESS_WS") {
    const data = event.data.data

    if (data.t === "move" || data.d?.ply > 0) {
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

      const currentTurnColor = data.d?.ply % 2 === 0 ? "white" : "black"
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
})

// Run early initialization
initTheme()

export default function Content() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [showArrows, setShowArrows] = useState(true)
  const [resizeCounter, setResizeCounter] = useState(0)

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.themeId) {
        const theme = THEMES.find(t => t.id === changes.themeId.newValue) || THEMES[0]
        applyTheme(theme)
      }
    }
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  // Load arrow visibility preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("lichess-show-arrows")
    if (saved !== null) {
      setShowArrows(saved === "true")
      console.log("📂 Loaded arrow state from localStorage:", saved === "true")
    } else {
      // Default to ON if no preference saved
      setShowArrows(true)
      localStorage.setItem("lichess-show-arrows", "true")
      console.log("📂 No saved preference, defaulting to ON")
    }
  }, [])

  // Handle window resize to update arrow positions dynamically
  useEffect(() => {
    const handleResize = () => {
      console.log("📐 Window resized, updating arrows...")
      setResizeCounter((prev) => prev + 1)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Toggle arrow visibility
  const toggleArrows = () => {
    console.log("🔄 Toggle clicked! Current state:", showArrows)
    const newValue = !showArrows
    setShowArrows(newValue)
    localStorage.setItem("lichess-show-arrows", String(newValue))
    console.log(
      `🎯 Arrows ${newValue ? "enabled" : "disabled"}, saved to localStorage`
    )
  }

  // Load saved analysis data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("lichess-analysis-data")
    if (saved) {
      try {
        const parsedData = JSON.parse(saved)
        setAnalysisData(parsedData)
        console.log("📂 Loaded analysis data from localStorage:", parsedData)
      } catch (error) {
        console.error("❌ Failed to parse saved analysis data:", error)
        localStorage.removeItem("lichess-analysis-data")
      }
    } else {
      console.log("📂 No saved analysis data found")
    }
  }, [])

  useEffect(() => {
    // Listen for BEST_MOVE messages from background
    const messageListener = (message: any) => {
      if (message.type === "BEST_MOVE") {
        console.log("🎯 Content received analysis data:", message.data)
        setAnalysisData(message.data)

        // Save to localStorage (replaces old data)
        localStorage.setItem(
          "lichess-analysis-data",
          JSON.stringify(message.data)
        )
        console.log("💾 Saved analysis data to localStorage")
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  // Watch move list and clear analysis data when no moves exist
  useEffect(() => {
    const checkMoveList = () => {
      const moveListContainer = document.querySelector("rm6")

      if (moveListContainer) {
        // Check if any <l4x> elements exist (moves)
        const hasMoves = moveListContainer.querySelector("l4x") !== null

        if (!hasMoves) {
          // No moves found - clear analysis data
          console.log("🗑️ No moves in move list, clearing analysis data")
          localStorage.removeItem("lichess-analysis-data")
          setAnalysisData(null)

          // Remove overlay container
          const overlay = document.getElementById("lichess-analysis-overlay")
          if (overlay) {
            overlay.innerHTML = ""
            console.log("🗑️ Cleared overlay")
          }

          // Clear pocket canvas overlay
          const pocketOverlay = document.getElementById(
            "lichess-pocket-overlay"
          )
          if (pocketOverlay) {
            const canvas = pocketOverlay as HTMLCanvasElement
            const ctx = canvas.getContext("2d")
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              console.log("🗑️ Cleared pocket overlay")
            }
          }
        }
      }
    }

    // Initial check
    checkMoveList()

    // Set up observer to watch for changes in move list
    const moveListContainer = document.querySelector("rm6")

    if (moveListContainer) {
      const observer = new MutationObserver(() => {
        checkMoveList()
      })

      observer.observe(moveListContainer, {
        childList: true,
        subtree: true
      })

      console.log("👀 Watching move list for changes...")

      return () => {
        observer.disconnect()
      }
    }
  }, [])

  // Add evaluation bar to the chessboard
  useEffect(() => {
    console.log("🎯 Eval bar effect running...")

    const createEvalBar = () => {
      const boardWrapper = document.querySelector("cg-board")
      if (!boardWrapper) {
        console.log("⚠️ cg-board not found yet")
        return false
      }

      console.log("✅ cg-board found!")

      // Check if bar already exists
      let evalBar = document.getElementById("eval-bar-container")

      if (evalBar) {
        console.log("ℹ️ Eval bar already exists")
        return true
      }

      console.log("🔨 Creating eval bar...")

      // Create the evaluation bar container
      evalBar = document.createElement("div")
      evalBar.id = "eval-bar-container"

      // Detect if mobile (screen width < 768px)
      const isMobile = window.innerWidth < 768
      const barWidth = isMobile ? "20px" : "6px"
      const barLeft = isMobile ? "-15px" : "-4px"

      console.log(
        `📱 Mobile: ${isMobile}, Width: ${barWidth}, Left: ${barLeft}`
      )

      // Check if playing as black (board is rotated)
      const cgWrap = document.querySelector(".cg-wrap")
      const isBlackOrientation = cgWrap?.classList.contains("orientation-black")
      const rotation = isBlackOrientation ? "rotate(180deg)" : "none"

      console.log(
        `🔄 Orientation: ${isBlackOrientation ? "black" : "white"}, Rotation: ${rotation}`
      )

      // Switch border radius from left to right when rotated
      const borderTopRadius = isBlackOrientation
        ? "border-top-right-radius"
        : "border-top-left-radius"
      const borderBottomRadius = isBlackOrientation
        ? "border-bottom-right-radius"
        : "border-bottom-left-radius"

      evalBar.style.cssText = `
        position: absolute !important;
        left: ${barLeft} !important;
        top: 0px !important;
        width: ${barWidth} !important;
        height: 100% !important;
        background-color: #000000 !important;
        ${borderTopRadius}: 2px !important;
        ${borderBottomRadius}: 2px !important;
        transform: ${rotation} !important;
        z-index: 99 !important;
        overflow: hidden !important;
        pointer-events: none !important;
      `

      // Create the white advantage bar
      const whiteBar = document.createElement("div")
      whiteBar.id = "eval-bar-white"
      whiteBar.style.cssText = `
        position: absolute !important;
        bottom: 0 !important;
        width: 100% !important;
        background-color: #FFFFFF !important;
        transition: height 0.3s ease !important;
        height: 50% !important;
      `

      evalBar.appendChild(whiteBar)
      boardWrapper.appendChild(evalBar)

      console.log("✅ Eval bar created and appended!")
      return true
    }

    // Try to create immediately
    if (!createEvalBar()) {
      // If board doesn't exist, wait for it
      console.log("⏳ Waiting for cg-board to appear...")
      const observer = new MutationObserver(() => {
        if (createEvalBar()) {
          observer.disconnect()
          console.log("✅ Observer disconnected")
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      // Cleanup
      return () => {
        observer.disconnect()
      }
    }

    // Calculate bar height based on evaluation score
    const whiteBar = document.getElementById("eval-bar-white")
    if (whiteBar) {
      let percentage = 50 // Default to 50% (equal position)

      if (analysisData) {
        const { evalBarPercent } = calculateEvaluation(analysisData)
        percentage = evalBarPercent
      }

      whiteBar.style.height = `${percentage}%`
    }

    // Add winning percentage display at top center
    const board = document.querySelector("cg-board")
    if (board && analysisData) {
      let winPercentDisplay = document.getElementById("win-percent-display")

      if (!winPercentDisplay) {
        winPercentDisplay = document.createElement("div")
        winPercentDisplay.id = "win-percent-display"
        winPercentDisplay.style.cssText = `
          position: absolute !important;
          top: -10px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 99 !important;
          color: white !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8) !important;
          white-space: nowrap !important;
          user-select: none !important;
          pointer-events: none !important;
        `
        board.appendChild(winPercentDisplay)
      }

      // Check for mate first
      let displayText = ""
      if (analysisData.score_mate !== null) {
        const mateIn = Math.abs(analysisData.score_mate)
        if (analysisData.score_mate > 0) {
          displayText = `W-M${mateIn}`
        } else {
          displayText = `B-M${mateIn}`
        }
      } else if (analysisData.score_cp !== null) {
        // Show actual evaluation score in pawns
        const centipawns = analysisData.score_cp
        const pawns = (centipawns / 100).toFixed(1) // Convert to pawns with 1 decimal

        // Determine who's winning and format display
        if (centipawns > 0) {
          displayText = `W+${pawns}`
        } else if (centipawns < 0) {
          displayText = `B+${Math.abs(parseFloat(pawns)).toFixed(1)}`
        } else {
          displayText = "0.0"
        }
      } else {
        displayText = "0.0"
      }

      // Add promotion piece indicator if it's a promotion move
      if (
        analysisData.best_move &&
        analysisData.best_move.length === 5 &&
        !analysisData.best_move.includes("@")
      ) {
        const promotionLetter = analysisData.best_move[4].toLowerCase()
        const pieceNames: { [key: string]: string } = {
          q: "Queen",
          r: "Rook",
          b: "Bishop",
          n: "Knight"
        }
        const pieceName =
          pieceNames[promotionLetter] || promotionLetter.toUpperCase()
        displayText += `   = ${pieceName}`
      }

      winPercentDisplay.textContent = displayText
    }
  }, [analysisData, resizeCounter])

  // Draw best move arrows and highlights
  useEffect(() => {
    drawBestMove(analysisData, showArrows)
  }, [analysisData, showArrows, resizeCounter])

  // Highlight promotion piece in the promotion menu using canvas
  useEffect(() => {
    return // DISABLED - Causes Queen to disappear

    if (!analysisData?.best_move || !showArrows) return

    const bestMove = analysisData.best_move

    // Check if the move is a promotion (5 characters, last char is q/r/b/n)
    if (bestMove.length === 5 && !bestMove.includes("@")) {
      const promotionPiece = bestMove[4].toLowerCase() // q, r, b, or n

      console.log(
        `🎯 Promotion move detected: ${bestMove}, promoting to ${promotionPiece}`
      )

      // Map promotion letter to piece class
      const pieceMap: { [key: string]: string } = {
        q: "queen",
        r: "rook",
        b: "bishop",
        n: "knight"
      }

      const pieceClass = pieceMap[promotionPiece]

      if (!pieceClass) return

      // Use MutationObserver to wait for promotion menu to appear
      const observer = new MutationObserver(() => {
        const promotionMenu = document.querySelector("#promotion-choice")

        if (promotionMenu) {
          console.log("✅ Promotion menu detected!")

          // Debug: Log all pieces in the menu
          const allPieces = promotionMenu.querySelectorAll("piece")
          console.log(`📋 Found ${allPieces.length} pieces in promotion menu:`)
          allPieces.forEach((p) => {
            const role = p.getAttribute("data-role") || p.className
            console.log(`  - ${role}`)
          })

          // Find the piece element in the promotion menu
          const pieceElement = promotionMenu.querySelector(
            `piece.${pieceClass}`
          )

          if (pieceElement) {
            console.log(`✅ Found ${pieceClass} piece element`)
            // Get the parent square
            const square = pieceElement.closest("square")

            if (square) {
              // Remove any existing promotion overlay first
              const existingOverlay = document.getElementById(
                "lichess-promotion-overlay"
              )
              if (existingOverlay) {
                existingOverlay.remove()
              }

              // Create simple div overlay for promotion (not canvas)
              const promotionOverlay = document.createElement("div")
              promotionOverlay.id = "lichess-promotion-overlay"
              promotionOverlay.style.cssText = `
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 123, 255, 0.2) !important;
                border-radius: 50% !important;
                pointer-events: none !important;
                z-index: 1 !important;
              `

              // Append to square
              const squareElement = square as HTMLElement
              squareElement.style.position = "relative"
              squareElement.appendChild(promotionOverlay)

              console.log(`✅ Highlighted ${pieceClass} in promotion menu`)

              // Stop observing once we've highlighted
              observer.disconnect()
            }
          }
        }
      })

      // Start observing for promotion menu
      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      // Cleanup: disconnect observer after 5 seconds if menu doesn't appear
      const timeout = setTimeout(() => {
        observer.disconnect()
      }, 5000)

      return () => {
        observer.disconnect()
        clearTimeout(timeout)
      }
    }
  }, [analysisData, showArrows])

  // Add toggle button to the board
  useEffect(() => {
    const board = document.querySelector("cg-board")
    if (!board) return

    // Check if toggle already exists
    let toggleContainer = document.getElementById("arrow-toggle-container")

    if (!toggleContainer) {
      // Create toggle switch container
      toggleContainer = document.createElement("div")
      toggleContainer.id = "arrow-toggle-container"

      // Detect screen size for responsive positioning
      const isMobile = window.innerWidth < 768

      // Mobile: bottom center, Desktop: bottom right
      const position = isMobile
        ? `
          bottom: -25px !important;
          left: 50% !important;
          transform: translateX(calc(-50% + 20px)) !important;
        `
        : `
          bottom: -20px !important;
          right: 0px !important;
        `

      toggleContainer.style.cssText = `
        position: absolute !important;
        ${position}
        z-index: 99 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      `

      // Create text label
      const label = document.createElement("span")
      const fontSize = isMobile ? "10px" : "12px"
      label.style.cssText = `
        color: white !important;
        font-size: ${fontSize} !important;
        font-weight: 500 !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) !important;
        white-space: nowrap !important;
        user-select: none !important;
      `
      label.textContent = "Best moves"
      toggleContainer.appendChild(label)

      // Create toggle switch
      const toggleSwitch = document.createElement("div")
      toggleSwitch.id = "arrow-toggle-switch"
      toggleSwitch.style.cssText = `
        width: 36px !important;
        height: 20px !important;
        background-color: ${showArrows ? "rgba(181, 136, 99, 0.9)" : "rgba(128, 128, 128, 0.6)"} !important;
        border-radius: 10px !important;
        position: relative !important;
        transition: background-color 0.3s ease !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        border: 2px solid rgba(255, 255, 255, 0.3) !important;
      `

      // Create toggle knob
      const toggleKnob = document.createElement("div")
      toggleKnob.id = "arrow-toggle-knob"
      toggleKnob.style.cssText = `
        width: 14px !important;
        height: 14px !important;
        background-color: white !important;
        border-radius: 50% !important;
        position: absolute !important;
        top: 1px !important;
        left: ${showArrows ? "18px" : "1px"} !important;
        transition: left 0.3s ease !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
      `

      toggleSwitch.appendChild(toggleKnob)
      toggleContainer.appendChild(toggleSwitch)

      toggleContainer.title = showArrows ? "Hide arrows" : "Show arrows"

      board.appendChild(toggleContainer)
    } else {
      // Update existing toggle
      const toggleSwitch = document.getElementById("arrow-toggle-switch")
      const toggleKnob = document.getElementById("arrow-toggle-knob")

      if (toggleSwitch) {
        toggleSwitch.style.backgroundColor = showArrows
          ? "rgba(181, 136, 99, 0.9)"
          : "rgba(128, 128, 128, 0.6)"
      }

      if (toggleKnob) {
        toggleKnob.style.left = showArrows ? "18px" : "1px"
      }

      toggleContainer.title = showArrows ? "Hide arrows" : "Show arrows"
    }

    // Always update the click handler with current function
    const handleClick = () => {
      toggleArrows()
    }

    toggleContainer.addEventListener("click", handleClick)

    // Cleanup: remove listener when effect re-runs
    return () => {
      toggleContainer?.removeEventListener("click", handleClick)
    }
  }, [showArrows, toggleArrows, resizeCounter])

  return null
}
