import type { Theme } from "../../types/theme"

export const GreenBoardTheme: Theme = {
  id: "chess-com",
  name: "Chess.com Green",
  board: {
    type: "color",
    lightSquare: "#eeeed2",
    darkSquare: "#769656"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#769656",
    dark: "#fff"
  }
}
