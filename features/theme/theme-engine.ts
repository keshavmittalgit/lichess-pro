import { THEMES, type Theme } from "../../constants/themes"

export function applyTheme(theme: Theme) {
  if (theme.id === "default") {
    const styleEls = document.querySelectorAll("#lichess-pro-theme")
    styleEls.forEach(el => el.remove())
    return
  }


  const pieces = ["pawn", "knight", "bishop", "rook", "queen", "king"]
  const colors = ["white", "black"]
  
  let pieceCSS = ""
  if (theme.pieces.baseUrl) {
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
  }

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
        background-image: conic-gradient(${dark} 90deg, ${light} 90deg 180deg, ${dark} 180deg 270deg, ${light} 270deg) !important; 
        background-size: 25% 25% !important; 
        background-repeat: repeat !important; 
      }
      cg-board square:not(.last-move):not(.selected):not(.check):not(.move-dest):not(.premove-dest) { background: none !important; }
    `
  }

  const coordLight = theme.coords?.light || "#fff"
  const coordDark = theme.coords?.dark || "#769656"

  const css = `
    ${pieceCSS}
    ${boardCSS}
    .cg-wrap coords { opacity: 1 !important; z-index: 10 !important; pointer-events: none !important; }
    .cg-wrap coords coord { font-weight: bold !important; }
    .cg-wrap coords .coord-light { color: ${coordLight} !important; }
    .cg-wrap coords .coord-dark { color: ${coordDark} !important; }
    
    /* Move ranks (1-8) to the right side */
    .cg-wrap coords.ranks { 
      left: auto !important; 
      right: 2px !important; 
    }
    
    cg-board { background-color: transparent !important; }
    .cg-wrap, .cg-container { background-image: none !important; }
    .cg-wrap::before, .cg-wrap::after, cg-board::before, cg-board::after { display: none !important; }
  `

  const styleEls = document.querySelectorAll("#lichess-pro-theme")
  let styleEl = styleEls.length > 0 ? styleEls[0] : null
  
  // Remove any duplicates if they somehow exist
  for (let i = 1; i < styleEls.length; i++) {
    styleEls[i].remove()
  }

  if (!styleEl) {
    styleEl = document.createElement("style")
    styleEl.id = "lichess-pro-theme"
    ;(document.head || document.documentElement).appendChild(styleEl)
  }
  styleEl.textContent = css
}
