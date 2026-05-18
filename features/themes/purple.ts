import type { Theme } from "../../types/theme"

export const PurpleTheme: Theme = {
  id: "purple",
  name: "Chess.com Purple",
  board: {
    type: "color",
    lightSquare: "#f0f1f0",
    darkSquare: "#8476ba"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#8476ba",
    dark: "#fff"
  }
}
