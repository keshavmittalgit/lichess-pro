import type { Theme } from "../../types/theme"

export const ClassicBlueTheme: Theme = {
  id: "classic-blue",
  name: "Chess.com Classic Blue",
  board: {
    type: "color",
    lightSquare: "#eae9d2",
    darkSquare: "#4b7399"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#4b7399",
    dark: "#fff"
  }
}
