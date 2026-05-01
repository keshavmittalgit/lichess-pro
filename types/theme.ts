export interface Theme {
  id: string
  name: string
  board: {
    type: "color" | "image"
    value?: string
    lightSquare?: string
    darkSquare?: string
  }
  pieces: {
    baseUrl: string
    extension: string
    case: "upper" | "lower"
  }
  coords?: {
    light?: string
    dark?: string
  }
}
