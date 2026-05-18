import type { Theme } from "../../types/theme"

export const PinkTheme: Theme = {
  id: "pink",
  name: "Chess.com Pink",
  board: {
    type: "color",
    lightSquare: "#f5f0f1",
    darkSquare: "#ec94a4"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#ec94a4",
    dark: "#fff"
  }
}
