import type { Theme } from "../../types/theme"

export const BlushTheme: Theme = {
  id: "blush",
  name: "Chess.com Blush",
  board: {
    type: "color",
    lightSquare: "#fefffe",
    darkSquare: "#fbd9e1"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#fbd9e1",
    dark: "#fff"
  }
}
