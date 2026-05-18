import type { Theme } from "../../types/theme"

export const ChessComBlueTheme: Theme = {
  id: "chess-com-blue",
  name: "Chess.com Blue",
  board: {
    type: "color",
    lightSquare: "#dee3e6",
    darkSquare: "#8ca2ad",
    highlight: "#7dacc9"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#8ca2ad",
    dark: "#fff"
  }
}
