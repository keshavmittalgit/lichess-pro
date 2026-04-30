import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

export const config: PlasmoCSConfig = {
  matches: ["https://lichess.org/*"],
  all_frames: true
}

console.log("Content script is working")

// Track game state and moves
let gameStarted = false
let playerColor: "white" | "black" | null = null // Track which side the player is playing
let currentPly = -1 // Track current ply to detect when moves are made

// Helper function to detect player color from board orientation
function detectPlayerColor(): "white" | "black" | null {
  const cgWrap = document.querySelector(".cg-wrap")
  if (!cgWrap) return null

  const isBlackOrientation = cgWrap.classList.contains("orientation-black")
  return isBlackOrientation ? "black" : "white"
}

// Listen for messages from the Main World interceptor
window.addEventListener("message", (event) => {
  // Log every message for debugging
  console.log(
    "📥 Content script received window message:",
    event.data?.type,
    event.data
  )

  if (event.data?.type === "LICHESS_WS") {
    const data = event.data.data

    // Check if this is a move (indicating game has started)
    if (data.t === "move" || data.d?.ply > 0) {
      if (!gameStarted) {
        console.log("🎮 Game started! First move detected")
        gameStarted = true

        // Detect player color at game start
        playerColor = detectPlayerColor()
        console.log(`🎨 Player is playing as: ${playerColor?.toUpperCase()}`)
      }

      // Check if a move was actually made (ply changed)
      const newPly = data.d?.ply
      if (newPly !== undefined && newPly !== currentPly) {
        console.log(`🔄 Move made! Ply changed from ${currentPly} to ${newPly}`)
        currentPly = newPly

        // Clear overlays when a move is made
        const overlay = document.getElementById("lichess-analysis-overlay")
        if (overlay) {
          overlay.innerHTML = ""
          console.log("🗑️ Cleared overlay due to move")
        }

        // Clear pocket overlay
        const pocketOverlay = document.getElementById("lichess-pocket-overlay")
        if (pocketOverlay) {
          pocketOverlay.remove()
          console.log("🗑️ Cleared pocket overlay due to move")
        }
      }

      // Determine whose turn it is based on ply number
      // Even ply (0, 2, 4...) = White's turn
      // Odd ply (1, 3, 5...) = Black's turn
      const currentTurnColor = data.d?.ply % 2 === 0 ? "white" : "black"
      console.log(`🔄 Move ${data.d?.ply}: ${currentTurnColor}'s turn`)

      // Only send analysis request if it's the player's turn
      const isPlayerTurn = playerColor === currentTurnColor

      if (isPlayerTurn) {
        console.log(
          "✅ Player's turn - sending move to background for analysis:",
          data
        )
        chrome.runtime.sendMessage({
          type: "LICHESS_MOVE",
          payload: data
        })
      } else {
        console.log("⏭️ Opponent's turn - skipping analysis request")
      }
    }

    // Check if game has ended
    if (data.t === "endData" || data.t === "end" || data.d?.status) {
      console.log("🏁 Game ended!")

      // Clear saved analysis data from localStorage
      localStorage.removeItem("lichess-analysis-data")
      console.log("🗑️ Cleared analysis data from localStorage")

      // Reset for next game
      gameStarted = false
      playerColor = null
      currentPly = -1
    }
  }
})

interface AnalysisData {
  best_move: string
  is_drop: boolean
  score_cp: number | null
  score_mate: number | null
  legal_drops?: any[]
  debug?: {
    depth: number
    time: number
  }
}

// Helper function to calculate evaluation bar percentage and score text
function calculateEvaluation(data: AnalysisData): {
  evalBarPercent: number
  scoreText: string
} {
  // Handle mate scores
  if (data.score_mate !== null) {
    const mateIn = data.score_mate
    // Positive mate = white winning (100%), negative mate = black winning (0%)
    const evalBarPercent = mateIn > 0 ? 100 : 0
    const scoreText = `M${Math.abs(mateIn)}`
    return { evalBarPercent, scoreText }
  }

  // Handle centipawn scores
  if (data.score_cp !== null) {
    const centipawns = data.score_cp
    const pawns = centipawns / 100 // Convert centipawns to pawns

    // Use sigmoid formula for smooth evaluation bar
    // Formula: 50 + 50 * (2 / (1 + e^(-0.002 * cp)) - 1)
    // This gives: 0% when black is winning big, 50% when equal, 100% when white is winning big
    // Coefficient 0.002 provides more gradual growth - only reaches 100% for forced mates
    const evalBarPercent =
      50 + 50 * (2 / (1 + Math.exp(-0.002 * centipawns)) - 1)

    // Clamp between 0 and 100
    const clampedPercent = Math.max(0, Math.min(100, evalBarPercent))

    // Format score text with + for positive (white advantage)
    const scoreText = pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2)

    return { evalBarPercent: clampedPercent, scoreText }
  }

  // Default to equal position
  return { evalBarPercent: 50, scoreText: "0.00" }
}

export default function Content() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [showArrows, setShowArrows] = useState(true) // Default to ON
  const [resizeCounter, setResizeCounter] = useState(0) // Track window resizes

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

  // Highlight best move using SVG overlay (bypass Lichess DOM detection)
  useEffect(() => {
    const board = document.querySelector("cg-board")
    if (!board) return

    // Create or get overlay container (sits OUTSIDE cg-board, not inside it)
    let overlayContainer = document.getElementById("lichess-analysis-overlay")

    if (!overlayContainer) {
      overlayContainer = document.createElement("div")
      overlayContainer.id = "lichess-analysis-overlay"
      overlayContainer.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none !important;
        z-index: 99 !important;
        overflow: visible !important;
      `

      // Append to board's parent, not to board itself
      const boardParent = board.parentElement
      if (boardParent) {
        boardParent.style.position = "relative"
        boardParent.appendChild(overlayContainer)
        console.log("✅ Created overlay container outside cg-board")
      }
    }

    // If arrows are disabled or no move data, clear and return
    if (!analysisData?.best_move || !showArrows) {
      overlayContainer.innerHTML = ""
      return
    }

    const bestMove = analysisData.best_move
    console.log("🎯 Drawing best move on overlay:", bestMove)

    // Get board dimensions
    const boardRect = board.getBoundingClientRect()
    const parentRect = overlayContainer.parentElement?.getBoundingClientRect()
    if (!parentRect) return

    const squareSize = boardRect.width / 8
    const offsetX = boardRect.left - parentRect.left
    const offsetY = boardRect.top - parentRect.top

    console.log(
      `📐 Board: ${boardRect.width}px, Square: ${squareSize}px, Offset: (${offsetX}, ${offsetY})`
    )

    // Check if playing as black (board is flipped)
    const cgWrap = document.querySelector(".cg-wrap")
    const isBlackOrientation = cgWrap?.classList.contains("orientation-black")

    // Convert chess notation to coordinates (center of square)
    const getSquarePosition = (square: string) => {
      const file = square.charCodeAt(0) - "a".charCodeAt(0) // 0-7 (a-h)
      const rank = parseInt(square[1]) - 1 // 0-7 (1-8)

      // If black orientation, flip the coordinates
      const x = isBlackOrientation ? (7 - file) * squareSize : file * squareSize
      const y = isBlackOrientation ? rank * squareSize : (7 - rank) * squareSize

      // Return center of square with offset
      return {
        x: offsetX + x + squareSize / 2,
        y: offsetY + y + squareSize / 2
      }
    }

    // Create SVG element
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "100%")
    svg.setAttribute("height", "100%")
    svg.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      pointer-events: none !important;
      overflow: visible !important;
    `

    // Check if it's a drop move (contains @)
    if (bestMove.includes("@")) {
      // Extract piece type and target square
      const pieceType = bestMove.substring(0, bestMove.indexOf("@"))
      const toSquare = bestMove.substring(
        bestMove.indexOf("@") + 1,
        bestMove.indexOf("@") + 3
      )

      console.log(`🎯 Drop move detected: ${pieceType} @ ${toSquare}`)

      // Draw highlight rectangle on target square
      const pos = getSquarePosition(toSquare)
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      )
      rect.setAttribute("x", String(pos.x - squareSize / 2))
      rect.setAttribute("y", String(pos.y - squareSize / 2))
      rect.setAttribute("width", String(squareSize))
      rect.setAttribute("height", String(squareSize))
      rect.setAttribute("fill", "rgba(0, 123, 255, 0.2)")
      rect.setAttribute("stroke", "rgba(0, 123, 255, 0.2)")
      rect.setAttribute("stroke-width", "0")
      svg.appendChild(rect)

      // Add actual chess piece SVG in the center of the square
      const pieceSize = squareSize * 0.95 // Piece takes up 95% of square (same size as board pieces)
      const pieceOffset = squareSize * 0.025 // Center the piece (2.5% padding on each side)

      // Create foreignObject to embed the chess piece SVG
      const foreignObject = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "foreignObject"
      )
      foreignObject.setAttribute(
        "x",
        String(pos.x - squareSize / 2 + pieceOffset)
      )
      foreignObject.setAttribute(
        "y",
        String(pos.y - squareSize / 2 + pieceOffset)
      )
      foreignObject.setAttribute("width", String(pieceSize))
      foreignObject.setAttribute("height", String(pieceSize))

      // Map piece letter to SVG (black stroke with opacity for faded appearance)
      const pieceSVGMap: { [key: string]: string } = {
        P: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path fill="none" stroke="#000" stroke-linecap="round" stroke-width="1.5" d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/></svg>`,
        N: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/><path fill="#000" d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z"/></g></svg>`,
        B: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><g stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path stroke-linejoin="miter" d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5"/></g></svg>`,
        R: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path stroke-linecap="butt" d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5"/><path d="m34 14-3 3H14l-3-3"/><path stroke-linecap="butt" stroke-linejoin="miter" d="M31 17v12.5H14V17"/><path d="m31 29.5 1.5 2.5h-20l1.5-2.5"/><path fill="none" stroke-linejoin="miter" d="M11 14h23"/></g></svg>`,
        Q: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path stroke-linecap="butt" d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z"/><path stroke-linecap="butt" d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><path fill="none" d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0"/></g></svg>`
      }

      const pieceSVG = pieceSVGMap[pieceType.toUpperCase()] || pieceSVGMap["P"]

      // Create a div to hold the SVG
      const div = document.createElement("div")
      div.innerHTML = pieceSVG
      div.style.width = "100%"
      div.style.height = "100%"
      div.style.opacity = "0.5" // Opacity for faded appearance

      foreignObject.appendChild(div)
      svg.appendChild(foreignObject)

      console.log(
        `✅ Drew drop highlight on overlay: ${toSquare} with ${pieceType.toUpperCase()} piece`
      )

      // Highlight the piece in the pocket using canvas overlay
      const pocket = document.querySelector(".pocket-bottom")

      if (pocket) {
        // Map piece letter to piece role
        const pieceRoleMap: { [key: string]: string } = {
          P: "pawn",
          N: "knight",
          B: "bishop",
          R: "rook",
          Q: "queen"
        }

        const pieceRole = pieceRoleMap[pieceType.toUpperCase()]

        if (pieceRole) {
          // Find the piece element in the pocket
          const pieceElement = pocket.querySelector(
            `piece[data-role="${pieceRole}"]`
          )

          if (pieceElement) {
            // Get the parent container of the piece
            const pocketContainer = pieceElement.closest(".pocket-c1")
            if (pocketContainer) {
              const containerDiv = pocketContainer.querySelector(".pocket-c2")
              if (containerDiv) {
                // Remove any existing pocket overlay first
                const existingOverlay = document.getElementById(
                  "lichess-pocket-overlay"
                )
                if (existingOverlay) {
                  existingOverlay.remove()
                }

                // Create new canvas overlay for this specific piece
                const pocketOverlay = document.createElement("canvas")
                pocketOverlay.id = "lichess-pocket-overlay"
                pocketOverlay.style.cssText = `
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  pointer-events: none !important;
                  z-index: 99 !important;
                `

                // Make sure the container is positioned
                const container = containerDiv as HTMLElement
                container.style.position = "relative"
                container.appendChild(pocketOverlay)

                // Set canvas size to match container
                const canvas = pocketOverlay as HTMLCanvasElement
                const containerRect = containerDiv.getBoundingClientRect()
                canvas.width = containerRect.width
                canvas.height = containerRect.height

                // Draw highlight on canvas
                const ctx = canvas.getContext("2d")
                if (ctx) {
                  ctx.fillStyle = "rgba(0, 123, 255, 0.2)"
                  ctx.fillRect(0, 0, canvas.width, canvas.height)
                  console.log(`✅ Drew ${pieceRole} highlight on pocket canvas`)
                }
              }
            }
          } else {
            console.log(`⚠️ Piece ${pieceRole} not found in pocket`)
          }
        }
      }
    } else {
      // Not a drop move - remove pocket overlay if it exists
      const existingOverlay = document.getElementById("lichess-pocket-overlay")
      if (existingOverlay) {
        existingOverlay.remove()
        console.log("🗑️ Removed pocket overlay (not a drop move)")
      }

      // Regular move - draw arrow
      const fromSquare = bestMove.substring(0, 2)
      const toSquare = bestMove.substring(2, 4)

      const from = getSquarePosition(fromSquare)
      const to = getSquarePosition(toSquare)

      // Calculate arrow angle and length
      const dx = to.x - from.x
      const dy = to.y - from.y
      const angle = Math.atan2(dy, dx)
      const length = Math.sqrt(dx * dx + dy * dy)

      // Arrow styling
      const arrowColor = "rgba(0, 123, 255, 0.2)"
      const arrowWidth = squareSize * 0.25
      const arrowHeadLength = squareSize * 0.75
      const arrowHeadWidth = squareSize * 0.85

      // Shorten the arrow so it doesn't cover the pieces completely
      const shortenStart = squareSize * 0.18
      const shortenEnd = squareSize * 0.18
      const adjustedLength = length - shortenStart - shortenEnd

      const startX = from.x + Math.cos(angle) * shortenStart
      const startY = from.y + Math.sin(angle) * shortenStart

      // Create arrow path
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      )

      // Calculate arrow body and head
      const bodyLength = adjustedLength - arrowHeadLength
      const perpAngle = angle + Math.PI / 2

      // Arrow body rectangle
      const bodyX1 = startX + Math.cos(perpAngle) * (arrowWidth / 2)
      const bodyY1 = startY + Math.sin(perpAngle) * (arrowWidth / 2)
      const bodyX2 = startX - Math.cos(perpAngle) * (arrowWidth / 2)
      const bodyY2 = startY - Math.sin(perpAngle) * (arrowWidth / 2)

      const bodyEndX1 = bodyX1 + Math.cos(angle) * bodyLength
      const bodyEndY1 = bodyY1 + Math.sin(angle) * bodyLength
      const bodyEndX2 = bodyX2 + Math.cos(angle) * bodyLength
      const bodyEndY2 = bodyY2 + Math.sin(angle) * bodyLength

      // Arrow head triangle
      const headBaseX1 =
        startX +
        Math.cos(angle) * bodyLength +
        Math.cos(perpAngle) * (arrowHeadWidth / 2)
      const headBaseY1 =
        startY +
        Math.sin(angle) * bodyLength +
        Math.sin(perpAngle) * (arrowHeadWidth / 2)
      const headBaseX2 =
        startX +
        Math.cos(angle) * bodyLength -
        Math.cos(perpAngle) * (arrowHeadWidth / 2)
      const headBaseY2 =
        startY +
        Math.sin(angle) * bodyLength -
        Math.sin(perpAngle) * (arrowHeadWidth / 2)

      const tipX = startX + Math.cos(angle) * adjustedLength
      const tipY = startY + Math.sin(angle) * adjustedLength

      // Build path: body rectangle + triangular head
      const pathData = `
        M ${bodyX1} ${bodyY1}
        L ${bodyEndX1} ${bodyEndY1}
        L ${headBaseX1} ${headBaseY1}
        L ${tipX} ${tipY}
        L ${headBaseX2} ${headBaseY2}
        L ${bodyEndX2} ${bodyEndY2}
        L ${bodyX2} ${bodyY2}
        Z
      `

      path.setAttribute("d", pathData)
      path.setAttribute("fill", arrowColor)
      path.setAttribute("stroke", "none")

      svg.appendChild(path)

      console.log(`✅ Drew arrow on overlay: ${fromSquare} → ${toSquare}`)
    }

    overlayContainer.appendChild(svg)
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
