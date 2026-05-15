import type { Theme } from "../../types/theme"

export const PureWhiteTheme: Theme = {
  id: "pure-white",
  name: "Pure White",
  board: {
    type: "color",
    lightSquare: "#ffffff",
    darkSquare: "#e8edf0"
  },
  pieces: {
    baseUrl: "local:assets/pieces/spice/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#000000",
    dark: "#555555"
  }
}
