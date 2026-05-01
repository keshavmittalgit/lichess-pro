import { DefaultTheme } from "~features/themes/default"
import { GreenBoardTheme } from "~features/themes/green-board"
import { PureWhiteTheme } from "~features/themes/pure-white"
import type { Theme } from "~types/theme"

export type { Theme }

export const THEMES: Theme[] = [
  DefaultTheme,
  GreenBoardTheme,
  PureWhiteTheme
]

// Forced HMR update for THEMES array
