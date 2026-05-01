import type { AnalysisData } from "./eval-utils"

// Helper to get pixel coordinates for a square
export function getSquarePosition(square: string) {
  const board = document.querySelector("cg-board")
  if (!board) return { x: 0, y: 0 }

  const boardRect = board.getBoundingClientRect()
  const squareSize = boardRect.width / 8

  const file = square.charCodeAt(0) - 97 // a-h -> 0-7
  const rank = parseInt(square[1]) - 1 // 1-8 -> 0-7

  // Check if board is flipped (orientation-black)
  const cgWrap = document.querySelector(".cg-wrap")
  const isBlackOrientation = cgWrap?.classList.contains("orientation-black")

  let x, y
  if (isBlackOrientation) {
    x = (7 - file) * squareSize + squareSize / 2
    y = rank * squareSize + squareSize / 2
  } else {
    x = file * squareSize + squareSize / 2
    y = (7 - rank) * squareSize + squareSize / 2
  }

  return { x, y }
}

export function drawBestMove(analysisData: AnalysisData | null, showArrows: boolean) {
  const board = document.querySelector("cg-board")
  if (!board) return

  // 1. Setup or find the overlay container
  let overlayContainer = document.getElementById("lichess-analysis-overlay")
  if (!overlayContainer) {
    overlayContainer = document.createElement("div")
    overlayContainer.id = "lichess-analysis-overlay"
    Object.assign(overlayContainer.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "99",
      overflow: "visible"
    })
    
    // Append to cg-container so it stays aligned with the board
    const container = document.querySelector("cg-container")
    if (container) {
      container.appendChild(overlayContainer)
    }
  }

  // 2. Clear previous drawings
  overlayContainer.innerHTML = ""
  const existingPocketOverlay = document.getElementById("lichess-pocket-overlay")
  if (existingPocketOverlay) existingPocketOverlay.remove()

  if (!analysisData?.best_move || !showArrows) return

  const bestMove = analysisData.best_move
  const boardRect = board.getBoundingClientRect()
  const squareSize = boardRect.width / 8

  // 3. Handle Drop Moves (Crazyhouse/Horde)
  if (analysisData.is_drop || bestMove.includes("@")) {
    const pieceType = bestMove[0]
    const toSquare = bestMove.substring(2, 4)
    const to = getSquarePosition(toSquare)

    // Draw square highlight on board
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "100%")
    svg.setAttribute("height", "100%")
    svg.style.overflow = "visible"
    overlayContainer.appendChild(svg)

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    rect.setAttribute("x", (to.x - squareSize / 2).toString())
    rect.setAttribute("y", (to.y - squareSize / 2).toString())
    rect.setAttribute("width", squareSize.toString())
    rect.setAttribute("height", squareSize.toString())
    rect.setAttribute("fill", "rgba(0, 123, 255, 0.2)")
    svg.appendChild(rect)
    return
  }

  // 4. Handle Regular Moves (Arrow drawing)
  const fromSquare = bestMove.substring(0, 2)
  const toSquare = bestMove.substring(2, 4)
  const from = getSquarePosition(fromSquare)
  const to = getSquarePosition(toSquare)

  const dx = to.x - from.x
  const dy = to.y - from.y
  const angle = Math.atan2(dy, dx)
  const length = Math.sqrt(dx * dx + dy * dy)

  const arrowColor = "rgba(0, 123, 255, 0.2)"
  const arrowWidth = squareSize * 0.25
  const arrowHeadLength = squareSize * 0.75
  const arrowHeadWidth = squareSize * 0.85

  const shorten = squareSize * 0.18
  const adjustedLength = length - (shorten * 2)
  const startX = from.x + Math.cos(angle) * shorten
  const startY = from.y + Math.sin(angle) * shorten

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("width", "100%")
  svg.setAttribute("height", "100%")
  svg.style.overflow = "visible"
  overlayContainer.appendChild(svg)

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  const bodyLength = adjustedLength - arrowHeadLength
  const perpAngle = angle + Math.PI / 2

  const bodyX1 = startX + Math.cos(perpAngle) * (arrowWidth / 2)
  const bodyY1 = startY + Math.sin(perpAngle) * (arrowWidth / 2)
  const bodyX2 = startX - Math.cos(perpAngle) * (arrowWidth / 2)
  const bodyY2 = startY - Math.sin(perpAngle) * (arrowWidth / 2)

  const bEX1 = bodyX1 + Math.cos(angle) * bodyLength
  const bEY1 = bodyY1 + Math.sin(angle) * bodyLength
  const bEX2 = bodyX2 + Math.cos(angle) * bodyLength
  const bEY2 = bodyY2 + Math.sin(angle) * bodyLength

  const hBX1 = startX + Math.cos(angle) * bodyLength + Math.cos(perpAngle) * (arrowHeadWidth / 2)
  const hBY1 = startY + Math.sin(angle) * bodyLength + Math.sin(perpAngle) * (arrowHeadWidth / 2)
  const hBX2 = startX + Math.cos(angle) * bodyLength - Math.cos(perpAngle) * (arrowHeadWidth / 2)
  const hBY2 = startY + Math.sin(angle) * bodyLength - Math.sin(perpAngle) * (arrowHeadWidth / 2)

  const tipX = startX + Math.cos(angle) * adjustedLength
  const tipY = startY + Math.sin(angle) * adjustedLength

  path.setAttribute("d", `M ${bodyX1} ${bodyY1} L ${bEX1} ${bEY1} L ${hBX1} ${hBY1} L ${tipX} ${tipY} L ${hBX2} ${hBY2} L ${bEX2} ${bEY2} L ${bodyX2} ${bodyY2} Z`)
  path.setAttribute("fill", arrowColor)
  svg.appendChild(path)
}
