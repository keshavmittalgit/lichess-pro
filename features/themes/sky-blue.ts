import type { Theme } from "../../types/theme"

export const SkyBlueTheme: Theme = {
  id: "sky-blue",
  name: "Chess.com Sky Blue",
  board: {
    type: "color",
    lightSquare: "#f2f6fa",
    darkSquare: "#5596f2"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#5596f2",
    dark: "#fff"
  }
}
