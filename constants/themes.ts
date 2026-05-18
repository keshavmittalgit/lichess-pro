import { DefaultTheme } from "~features/themes/default"
import { GreenBoardTheme } from "~features/themes/green-board"
import { PureWhiteTheme } from "~features/themes/pure-white"
import { ChessComBlueTheme } from "~features/themes/chess-com-blue"
import { PurpleTheme } from "~features/themes/purple"
import { GreyTheme } from "~features/themes/grey"
import { SkyBlueTheme } from "~features/themes/sky-blue"
import { PinkTheme } from "~features/themes/pink"
import { BlushTheme } from "~features/themes/blush"
import { ClassicBlueTheme } from "~features/themes/classic-blue"
import { SilverTheme } from "~features/themes/silver"
import type { Theme } from "~types/theme"

export type { Theme }

export const THEMES: Theme[] = [
  DefaultTheme,
  GreenBoardTheme,
  PureWhiteTheme,
  ChessComBlueTheme,
  PurpleTheme,
  GreyTheme,
  SkyBlueTheme,
  PinkTheme,
  BlushTheme,
  ClassicBlueTheme,
  SilverTheme
]

export function resolveTheme(
  themeId: string,
  customBoardId?: string,
  customPieceId?: string,
  customBackgroundId?: string
): Theme {
  if (themeId === "custom") {
    const boardId = customBoardId || "default"
    const pieceId = customPieceId || "default"
    const backgroundId = customBackgroundId || "default"

    const baseBoardTheme = THEMES.find((t) => t.id === boardId) || THEMES[0]
    
    let piecesConfig = undefined
    if (pieceId === "neo") {
      piecesConfig = { baseUrl: "local:assets/pieces/neo/", extension: "png", case: "lower" as const }
    } else if (pieceId === "spice") {
      piecesConfig = { baseUrl: "local:assets/pieces/spice/", extension: "png", case: "lower" as const }
    } else if (pieceId === "white-custom") {
      piecesConfig = { baseUrl: "local:assets/pieces/white-custom/", extension: "png", case: "lower" as const }
    }

    let bgValue = undefined
    if (backgroundId === "dark") {
      bgValue = "#0c0b0a"
    } else if (backgroundId === "slate") {
      bgValue = "#1e1c1a"
    } else if (backgroundId === "ocean") {
      bgValue = "#0f172a"
    }

    return {
      id: "custom",
      name: "Custom Theme",
      board: baseBoardTheme.board,
      pieces: piecesConfig,
      coords: baseBoardTheme.coords,
      background: bgValue
    }
  }

  return THEMES.find((t) => t.id === themeId) || THEMES[0]
}

