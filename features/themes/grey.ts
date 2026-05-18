import type { Theme } from "../../types/theme"

export const GreyTheme: Theme = {
  id: "grey",
  name: "Chess.com Grey",
  board: {
    type: "color",
    lightSquare: "#d7d4d4",
    darkSquare: "#807b76"
  },
  pieces: {
    baseUrl: "local:assets/pieces/neo/",
    extension: "png",
    case: "lower"
  },
  coords: {
    light: "#807b76",
    dark: "#fff"
  }
}
