import type { Theme } from "../../types/theme"

export const SilverTheme: Theme = {
  id: "silver",
  name: "Chess.com Silver",
  board: {
    type: "color",
    lightSquare: "#d8d9d8",
    darkSquare: "#a8a9a8"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#a8a9a8",
    dark: "#fff"
  }
}
