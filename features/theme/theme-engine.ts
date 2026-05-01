import { THEMES, type Theme } from "../../constants/themes"

export function applyTheme(theme: Theme) {
  if (theme.id === "default") {
    const styleEl = document.getElementById("lichess-pro-theme")
    if (styleEl) styleEl.remove()
    return
  }

  const pieces = ["pawn", "knight", "bishop", "rook", "queen", "king"]
  const colors = ["white", "black"]
  
  let pieceCSS = ""
  pieces.forEach(piece => {
    colors.forEach(color => {
      const colorChar = color === "white" ? "w" : "b"
      let pieceChar = piece[0]
      if (piece === "knight") pieceChar = "n"
      let finalPieceKey = theme.pieces.case === "upper" ? `${colorChar}${pieceChar.toUpperCase()}` : `${colorChar}${pieceChar.toLowerCase()}`
      const pieceUrl = `${theme.pieces.baseUrl}${finalPieceKey}.${theme.pieces.extension}`
      
      pieceCSS += `
        .cg-wrap piece.${piece}.${color}, cg-board piece.${piece}.${color}, #promotion-choice piece.${piece}.${color} {
          background-image: url("${pieceUrl}") !important;
        }
      `
    })
  })

  let boardCSS = ""
  if (theme.board.type === "image") {
    boardCSS = `
      cg-board { 
        background-image: url("${theme.board.value}") !important; 
        background-size: 100% 100% !important;
        background-repeat: no-repeat !important;
      }
      cg-board square { background: none !important; }
    `
  } else {
    const light = theme.board.lightSquare || "#f0d9b5", dark = theme.board.darkSquare || "#b58863"
    boardCSS = `
      cg-board { 
        background-color: ${dark} !important;
        background-image: conic-gradient(${light} 90deg, ${dark} 90deg 180deg, ${light} 180deg 270deg, ${dark} 270deg) !important; 
        background-size: 25% 25% !important; 
        background-repeat: repeat !important; 
      }
      cg-board square:not(.last-move):not(.selected):not(.check):not(.move-dest):not(.premove-dest) { background: none !important; }
    `
  }

  const css = `
    ${pieceCSS}
    ${boardCSS}
    .cg-wrap coords { opacity: 1 !important; z-index: 10 !important; pointer-events: none !important; }
    .cg-wrap coords coord { font-weight: bold !important; }
    .cg-wrap coords .coord-light { color: #fff !important; }
    .cg-wrap coords .coord-dark { color: #769656 !important; }
    
    /* Move ranks (1-8) to the right side */
    .cg-wrap coords.ranks { 
      left: auto !important; 
      right: 2px !important; 
    }
    
    cg-board { background-color: transparent !important; }
    .cg-wrap, .cg-container { background-image: none !important; }
    .cg-wrap::before, .cg-wrap::after, cg-board::before, cg-board::after { display: none !important; }
  `

  let styleEl = document.getElementById("lichess-pro-theme")
  if (!styleEl) {
    styleEl = document.createElement("style")
    styleEl.id = "lichess-pro-theme"
    ;(document.head || document.documentElement).appendChild(styleEl)
  }
  styleEl.textContent = css
}
