export interface Theme {
  id: string
  name: string
  board?: {
    type: "color" | "image"
    value?: string
    lightSquare?: string
    darkSquare?: string
    highlight?: string
  }
  pieces?: {
    baseUrl: string
    whiteBaseUrl?: string
    blackBaseUrl?: string
    extension: string
    case: "upper" | "lower"
  }
  coords?: {
    light?: string
    dark?: string
  }
  thumbnail?: string
  background?: string
}
