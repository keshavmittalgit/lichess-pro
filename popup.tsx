import { useEffect, useState } from "react"

import { resolveTheme, THEMES, type Theme } from "~constants/themes"

import "./popup.css"

const BOARD_STYLES = THEMES.map((theme) => ({
  id: theme.id,
  name: theme.name.replace("Chess.com ", "").replace("Lichess ", ""),
  light: theme.board?.type === "color" ? theme.board.lightSquare : "#f0d9b5",
  dark: theme.board?.type === "color" ? theme.board.darkSquare : "#b58863"
}))

const PIECE_STYLES = [
  { id: "default", name: "Default" },
  { id: "neo", name: "Neo" },
  { id: "spice", name: "Spice" },
  { id: "white-custom", name: "Custom White" }
]

const BACKGROUND_STYLES = [
  { id: "default", name: "Default", color: "#161512" },
  { id: "dark", name: "Dark", color: "#0c0b0a" },
  { id: "slate", name: "Slate", color: "#1e1c1a" },
  { id: "ocean", name: "Ocean", color: "#0f172a" }
]

export default function Popup() {
  const [depth, setDepth] = useState(20) // 10-50 moves
  const [time, setTime] = useState(0.5) // 0.5-5 seconds
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<"engine" | "themes">("themes")
  const [customizerTab, setCustomizerTab] = useState<
    "boards" | "pieces" | "background" | "presets"
  >("boards")

  // Active theme states
  const [activeThemeId, setActiveThemeId] = useState("default")
  const [activeBoardId, setActiveBoardId] = useState("default")
  const [activePieceId, setActivePieceId] = useState("default")
  const [activeBackgroundId, setActiveBackgroundId] = useState("default")

  // Staged theme states (for live preview)
  const [stagedThemeId, setStagedThemeId] = useState("default")
  const [stagedBoardId, setStagedBoardId] = useState("default")
  const [stagedPieceId, setStagedPieceId] = useState("default")
  const [stagedBackgroundId, setStagedBackgroundId] = useState("default")

  // New engine settings
  const [showPlayerBestMove, setShowPlayerBestMove] = useState(true)
  const [showOpponentBestMove, setShowOpponentBestMove] = useState(true)
  const [showAnalysisBar, setShowAnalysisBar] = useState(true)

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      const result = await chrome.storage.local.get([
        "depth",
        "time",
        "themeId",
        "customBoardId",
        "customPieceId",
        "customBackgroundId",
        "showPlayerBestMove",
        "showOpponentBestMove",
        "showAnalysisBar"
      ])
      if (result.depth !== undefined) setDepth(result.depth)
      if (result.time !== undefined) setTime(result.time)

      const themeId = result.themeId || "default"
      setActiveThemeId(themeId)
      setStagedThemeId(themeId)

      const boardId = result.customBoardId || "default"
      setActiveBoardId(boardId)
      setStagedBoardId(boardId)

      const pieceId = result.customPieceId || "default"
      setActivePieceId(pieceId)
      setStagedPieceId(pieceId)

      const backgroundId = result.customBackgroundId || "default"
      setActiveBackgroundId(backgroundId)
      setStagedBackgroundId(backgroundId)

      if (result.showPlayerBestMove !== undefined)
        setShowPlayerBestMove(result.showPlayerBestMove)
      if (result.showOpponentBestMove !== undefined)
        setShowOpponentBestMove(result.showOpponentBestMove)
      if (result.showAnalysisBar !== undefined)
        setShowAnalysisBar(result.showAnalysisBar)
      setIsLoaded(true)
    }
    loadSettings()
  }, [])

  // Save depth to storage
  useEffect(() => {
    if (isLoaded) {
      chrome.storage.local.set({ depth })
    }
  }, [depth, isLoaded])

  // Save time to storage
  useEffect(() => {
    if (isLoaded) {
      chrome.storage.local.set({ time })
    }
  }, [time, isLoaded])

  // Save engine settings to storage
  useEffect(() => {
    if (isLoaded) {
      chrome.storage.local.set({
        showPlayerBestMove,
        showOpponentBestMove,
        showAnalysisBar
      })
    }
  }, [showPlayerBestMove, showOpponentBestMove, showAnalysisBar, isLoaded])

  // Revert staged to active on cancel
  const handleCancel = () => {
    setStagedThemeId(activeThemeId)
    setStagedBoardId(activeBoardId)
    setStagedPieceId(activePieceId)
    setStagedBackgroundId(activeBackgroundId)
  }

  // Save staged to active
  const handleSave = () => {
    chrome.storage.local.set({
      themeId: stagedThemeId,
      customBoardId: stagedBoardId,
      customPieceId: stagedPieceId,
      customBackgroundId: stagedBackgroundId
    })
    setActiveThemeId(stagedThemeId)
    setActiveBoardId(stagedBoardId)
    setActivePieceId(stagedPieceId)
    setActiveBackgroundId(stagedBackgroundId)
  }

  // Preset selection handler
  const handlePresetSelect = (presetId: string) => {
    setStagedThemeId(presetId)
    if (presetId === "default") {
      setStagedBoardId("default")
      setStagedPieceId("default")
    } else {
      const preset = THEMES.find((t) => t.id === presetId)
      if (preset) {
        setStagedBoardId(presetId)
        if (preset.pieces?.baseUrl.includes("neo")) {
          setStagedPieceId("neo")
        } else if (preset.pieces?.baseUrl.includes("spice")) {
          setStagedPieceId("spice")
        } else if (preset.pieces?.baseUrl.includes("white-custom")) {
          setStagedPieceId("white-custom")
        } else {
          setStagedPieceId("default")
        }
      }
    }
  }

  const isDirty =
    stagedThemeId !== activeThemeId ||
    stagedBoardId !== activeBoardId ||
    stagedPieceId !== activePieceId ||
    stagedBackgroundId !== activeBackgroundId

  // Find preview details
  const stagedBoard =
    BOARD_STYLES.find((b) => b.id === stagedBoardId) || BOARD_STYLES[0]

  // Coordinate colors for preview board
  const coordDark =
    stagedBoard.id === "pure-white" ? "#555555" : stagedBoard.dark
  const coordLight =
    stagedBoard.id === "pure-white" ? "#000000" : stagedBoard.light

  // Piece CDN or local URL resolver
  const getPreviewPieceUrl = (pieceCode: string) => {
    if (stagedPieceId === "default") {
      const color = pieceCode[0]
      const piece = pieceCode[1].toUpperCase()
      return `https://lichess1.org/assets/piece/cburnett/${color}${piece}.svg`
    }
    return `assets/pieces/${stagedPieceId}/${pieceCode}.png`
  }

  return (
    <div
      className="text-white overflow-hidden transition-all duration-300 w-[565px] p-2"
      style={{
        backgroundColor: "#1c1a17",
        fontFamily: "system-ui, -apple-system, sans-serif",
        minHeight: "400px"
      }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1
          className="text-lg font-black tracking-tight"
          style={{ color: "#dfc093", letterSpacing: "-0.01em" }}>
          Lichess Pro
        </h1>

        {/* Top-Level Tabs */}
        <div className="flex space-x-4 border-b border-zinc-800/80">
          <button
            onClick={() => setActiveTab("themes")}
            className={`pb-2 text-sm font-semibold transition-all relative ${
              activeTab === "themes"
                ? "text-white"
                : "text-white/40 hover:text-white/70"
            }`}>
            Board & Pieces
            {activeTab === "themes" && (
              <span
                style={{ backgroundColor: "#dfc093" }}
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("engine")}
            className={`pb-2 text-sm font-semibold transition-all relative ${
              activeTab === "engine"
                ? "text-white"
                : "text-white/40 hover:text-white/70"
            }`}>
            Engine Settings
            {activeTab === "engine" && (
              <span
                style={{ backgroundColor: "#dfc093" }}
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
              />
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="px-4 pt-2 pb-2">
        {activeTab === "engine" ? (
          <div className="w-full pt-2 px-1">
            <div className="space-y-5">
              {/* Depth Slider */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-semibold text-white/60">
                    Search Depth
                  </label>
                  <span
                    className="text-base font-bold tabular-nums"
                    style={{ color: "#dfc093" }}>
                    {depth}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider"
                  style={{ accentColor: "#dfc093" }}
                />
              </div>

              {/* Time Slider */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-sm font-semibold text-white/60">
                    Analysis Time
                  </label>
                  <span
                    className="text-base font-bold tabular-nums"
                    style={{ color: "#dfc093" }}>
                    {time.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.1"
                  value={time}
                  onChange={(e) => setTime(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider"
                  style={{ accentColor: "#dfc093" }}
                />
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-4 ">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white/60">
                    Player Best Move
                  </label>
                  <button
                    onClick={() => setShowPlayerBestMove(!showPlayerBestMove)}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                    style={{
                      backgroundColor: showPlayerBestMove
                        ? "#dfc093"
                        : "#3f3e3c"
                    }}>
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full transition-all duration-200 ${
                        showPlayerBestMove
                          ? "translate-x-5 bg-[#1c1a17]"
                          : "translate-x-0.5 bg-white"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white/60">
                    Opponent Best Move
                  </label>
                  <button
                    onClick={() =>
                      setShowOpponentBestMove(!showOpponentBestMove)
                    }
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                    style={{
                      backgroundColor: showOpponentBestMove
                        ? "#dfc093"
                        : "#3f3e3c"
                    }}>
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full transition-all duration-200 ${
                        showOpponentBestMove
                          ? "translate-x-5 bg-[#1c1a17]"
                          : "translate-x-0.5 bg-white"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white/60">
                    Analysis Bar & Score
                  </label>
                  <button
                    onClick={() => setShowAnalysisBar(!showAnalysisBar)}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                    style={{
                      backgroundColor: showAnalysisBar ? "#dfc093" : "#3f3e3c"
                    }}>
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full transition-all duration-200 ${
                        showAnalysisBar
                          ? "translate-x-5 bg-[#1c1a17]"
                          : "translate-x-0.5 bg-white"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Chess.com style "Board & Pieces" Customizer Tab */
          <div className="flex flex-col">
            {/* Inner Dashboard Layout */}
            <div className="flex space-x-4 items-center">
              {/* Left Column: Swatches and Settings */}
              <div className="w-[320px] flex flex-col">
                {/* Nested Tabs */}
                <div className="flex space-x-4 mb-3">
                  {(["boards", "pieces", "background", "presets"] as const).map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => setCustomizerTab(tab)}
                        className={`pb-2 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                          customizerTab === tab
                            ? "text-white"
                            : "text-white/40 hover:text-white/70"
                        }`}>
                        {tab}
                        {customizerTab === tab && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                        )}
                      </button>
                    )
                  )}
                </div>

                {/* Left Inner Content (with scrollbar) */}
                <div className="h-[195px] overflow-y-auto pr-1 custom-scrollbar">
                  {customizerTab === "boards" && (
                    <div className="grid grid-cols-5 gap-2.5">
                      {BOARD_STYLES.map((board) => (
                        <button
                          key={board.id}
                          onClick={() => {
                            setStagedBoardId(board.id)
                            setStagedThemeId("custom")
                          }}
                          className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                            stagedBoardId === board.id
                              ? "border-[#dfc093] scale-[0.96] shadow-lg ring-1 ring-[#dfc093]/40"
                              : "border-transparent hover:border-zinc-700"
                          }`}>
                          <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                            <div
                              style={{ backgroundColor: board.light }}
                              className="w-full h-full"
                            />
                            <div
                              style={{ backgroundColor: board.dark }}
                              className="w-full h-full"
                            />
                            <div
                              style={{ backgroundColor: board.dark }}
                              className="w-full h-full"
                            />
                            <div
                              style={{ backgroundColor: board.light }}
                              className="w-full h-full relative">
                              {stagedBoardId === board.id && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div
                                    style={{ backgroundColor: "#dfc093" }}
                                    className="text-[#1c1a17] rounded-full p-0.5 shadow-md flex items-center justify-center w-5 h-5">
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      strokeWidth="4.5">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {customizerTab === "pieces" && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {PIECE_STYLES.map((piece) => (
                        <button
                          key={piece.id}
                          onClick={() => {
                            setStagedPieceId(piece.id)
                            setStagedThemeId("custom")
                          }}
                          className={`relative flex items-center p-2 rounded-lg border-2 transition-all duration-200 cursor-pointer bg-[#262421]/60 ${
                            stagedPieceId === piece.id
                              ? "border-[#dfc093] bg-[#262421]/90 shadow-md"
                              : "border-zinc-800/80 hover:border-zinc-700 hover:bg-[#262421]/85"
                          }`}>
                          <img
                            src={
                              piece.id === "default"
                                ? "https://lichess1.org/assets/piece/cburnett/wN.svg"
                                : `assets/pieces/${piece.id}/wn.png`
                            }
                            alt={piece.name}
                            className="w-10 h-10 object-contain mr-2.5"
                          />
                          <span className="text-xs font-semibold text-zinc-300 truncate">
                            {piece.name}
                          </span>
                          {stagedPieceId === piece.id && (
                            <div
                              style={{ backgroundColor: "#dfc093" }}
                              className="absolute top-1.5 right-1.5 text-[#1c1a17] rounded-full p-0.5 shadow flex items-center justify-center w-4.5 h-4.5">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="4.5">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {customizerTab === "background" && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {BACKGROUND_STYLES.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => {
                            setStagedBackgroundId(bg.id)
                            setStagedThemeId("custom")
                          }}
                          className={`relative flex items-center p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer bg-[#262421]/60 ${
                            stagedBackgroundId === bg.id
                              ? "border-[#dfc093] bg-[#262421]/90 shadow-md"
                              : "border-zinc-800/80 hover:border-zinc-700 hover:bg-[#262421]/85"
                          }`}>
                          <div
                            style={{ backgroundColor: bg.color }}
                            className="w-5 h-5 rounded-full border border-zinc-700 mr-2.5 shadow-inner"
                          />
                          <span className="text-xs font-semibold text-zinc-300">
                            {bg.name}
                          </span>
                          {stagedBackgroundId === bg.id && (
                            <div
                              style={{ backgroundColor: "#dfc093" }}
                              className="absolute top-1.5 right-1.5 text-[#1c1a17] rounded-full p-0.5 shadow flex items-center justify-center w-4.5 h-4.5">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="4.5">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {customizerTab === "presets" && (
                    <div className="space-y-2">
                      {THEMES.map((preset) => {
                        const light = preset.board?.lightSquare || "#f0d9b5"
                        const dark = preset.board?.darkSquare || "#b58863"

                        let pieceName = "Default Pieces"
                        if (preset.pieces?.baseUrl.includes("neo"))
                          pieceName = "Neo Pieces"
                        else if (preset.pieces?.baseUrl.includes("spice"))
                          pieceName = "Spice Pieces"
                        else if (
                          preset.pieces?.baseUrl.includes("white-custom")
                        )
                          pieceName = "Custom Pieces"

                        return (
                          <button
                            key={preset.id}
                            onClick={() => handlePresetSelect(preset.id)}
                            className={`relative flex items-center p-2.5 rounded-lg border-2 transition-all duration-200 cursor-pointer w-full text-left bg-[#262421]/60 ${
                              stagedThemeId === preset.id
                                ? "border-[#dfc093] bg-[#262421]/90 shadow-md"
                                : "border-zinc-800/80 hover:border-zinc-700 hover:bg-[#262421]/85"
                            }`}>
                            {/* 2x2 board swatch */}
                            <div className="w-7 h-7 rounded overflow-hidden grid grid-cols-2 grid-rows-2 mr-3 border border-zinc-800 shadow">
                              <div
                                style={{ backgroundColor: light }}
                                className="w-full h-full"
                              />
                              <div
                                style={{ backgroundColor: dark }}
                                className="w-full h-full"
                              />
                              <div
                                style={{ backgroundColor: dark }}
                                className="w-full h-full"
                              />
                              <div
                                style={{ backgroundColor: light }}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="block text-xs font-bold text-zinc-100 truncate">
                                {preset.name}
                              </span>
                              <span className="block text-[10px] text-zinc-400 truncate">
                                {pieceName}
                              </span>
                            </div>
                            {stagedThemeId === preset.id && (
                              <div
                                style={{ backgroundColor: "#dfc093" }}
                                className="text-[#1c1a17] rounded-full p-0.5 shadow flex items-center justify-center w-4.5 h-4.5 ml-2">
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth="4.5">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom Actions Row under Left Column */}
                <div className="flex items-center space-x-3 mt-4">
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-[#32312f] hover:bg-[#3f3e3c] text-zinc-300 hover:text-white font-bold py-2 px-4 rounded-md border-none text-xs cursor-pointer transition-all duration-200 active:scale-[0.98]">
                    Cancel
                  </button>
                  <button
                    onClick={isDirty ? handleSave : undefined}
                    className={`flex-1 font-bold py-2 px-4 rounded-md border-none text-xs transition-all duration-200 ${
                      isDirty
                        ? "cursor-pointer active:scale-[0.98] shadow-md text-[#1c1a17] hover:bg-[#e8cca4] shadow-[#dfc093]/10"
                        : "text-zinc-500 cursor-default opacity-90"
                    }`}
                    style={{
                      backgroundColor: isDirty
                        ? "#dfc093"
                        : "rgba(223, 192, 147, 0.08)"
                    }}>
                    {isDirty ? "Save changes" : "Changes saved"}
                  </button>
                </div>
              </div>

              {/* Right Column: Live Board Preview */}
              <div className="w-48 flex flex-col items-center justify-center pt-2">
                <div className="relative w-48 h-48 rounded-lg overflow-hidden shadow-2xl border border-zinc-800/80 bg-zinc-950 grid grid-cols-3 grid-rows-3 select-none">
                  {/* Row 8 (col a, b, c) */}
                  <div
                    style={{ backgroundColor: stagedBoard.light }}
                    className="relative w-full h-full flex items-center justify-center">
                    <span
                      style={{ color: coordDark }}
                      className="absolute top-1 left-1.5 text-[10px] font-extrabold leading-none opacity-85">
                      8
                    </span>
                    <img
                      src={getPreviewPieceUrl("bb")}
                      className="w-[82%] h-[82%] object-contain select-none"
                      alt=""
                    />
                  </div>
                  <div
                    style={{ backgroundColor: stagedBoard.dark }}
                    className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={getPreviewPieceUrl("bq")}
                      className="w-[82%] h-[82%] object-contain select-none"
                      alt=""
                    />
                  </div>
                  <div
                    style={{ backgroundColor: stagedBoard.light }}
                    className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={getPreviewPieceUrl("bp")}
                      className="w-[82%] h-[82%] object-contain select-none"
                      alt=""
                    />
                  </div>

                  {/* Row 7 */}
                  <div
                    style={{ backgroundColor: stagedBoard.dark }}
                    className="relative w-full h-full flex items-center justify-center">
                    <span
                      style={{ color: coordLight }}
                      className="absolute top-1 left-1.5 text-[10px] font-extrabold leading-none opacity-85">
                      7
                    </span>
                  </div>
                  <div
                    style={{ backgroundColor: stagedBoard.light }}
                    className="relative w-full h-full"></div>
                  <div
                    style={{ backgroundColor: stagedBoard.dark }}
                    className="relative w-full h-full"></div>

                  {/* Row 6 */}
                  <div
                    style={{ backgroundColor: stagedBoard.light }}
                    className="relative w-full h-full flex items-center justify-center">
                    <span
                      style={{ color: coordDark }}
                      className="absolute top-1 left-1.5 text-[10px] font-extrabold leading-none opacity-85">
                      6
                    </span>
                    <img
                      src={getPreviewPieceUrl("wn")}
                      className="w-[82%] h-[82%] object-contain select-none"
                      alt=""
                    />
                  </div>
                  <div
                    style={{ backgroundColor: stagedBoard.dark }}
                    className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={getPreviewPieceUrl("wk")}
                      className="w-[82%] h-[82%] object-contain select-none"
                      alt=""
                    />
                  </div>
                  <div
                    style={{ backgroundColor: stagedBoard.light }}
                    className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={getPreviewPieceUrl("wr")}
                      className="w-[82%] h-[82%] object-contain select-none"
                      alt=""
                    />
                  </div>
                </div>

                {/* Visual Label */}
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2 select-none">
                  Preview
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Embedded styles for sliders and scrollbar */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: #dfc093;
          cursor: pointer;
          border: 2px solid #1c1a17;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          transition: transform 0.1s, background 0.1s;
        }
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          background: #f0d9b5;
        }

        .slider::-moz-range-thumb {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: #dfc093;
          cursor: pointer;
          border: 2px solid #1c1a17;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          transition: transform 0.1s, background 0.1s;
        }
        .slider::-moz-range-thumb:hover {
          transform: scale(1.15);
          background: #f0d9b5;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3a3834;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4a4843;
        }
      `}</style>
    </div>
  )
}
