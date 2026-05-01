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
    baseUrl: "https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/",
    extension: "svg",
    case: "upper"
  },
  coords: {
    light: "#000000",
    dark: "#555555"
  }
}
