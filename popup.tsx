import { useEffect, useState } from "react"
import { THEMES, type Theme } from "~constants/themes"

import "./popup.css"

export default function Popup() {
  const [depth, setDepth] = useState(20) // 10-40 moves
  const [time, setTime] = useState(0.5) // 0.5-5 seconds
  const [activeThemeId, setActiveThemeId] = useState("default")
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<"engine" | "themes">("engine")

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      const result = await chrome.storage.local.get(["depth", "time", "themeId"])
      if (result.depth !== undefined) setDepth(result.depth)
      if (result.time !== undefined) setTime(result.time)
      if (result.themeId !== undefined) setActiveThemeId(result.themeId)
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

  // Save theme to storage
  const handleThemeSelect = (themeId: string) => {
    setActiveThemeId(themeId)
    chrome.storage.local.set({ themeId })
  }

  return (
    <div
      className="w-96 text-white overflow-hidden"
      style={{
        backgroundColor: "#171513",
        fontFamily: "'Noto Sans', sans-serif",
        minHeight: "450px"
      }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1
          className="text-2xl font-light tracking-tight mb-4"
          style={{ color: "#f0d9b5", letterSpacing: "-0.02em" }}>
          Lichess Pro
        </h1>

        {/* Tabs */}
        <div className="flex space-x-4 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab("engine")}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === "engine"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}>
            Engine
          </button>
          <button
            onClick={() => setActiveTab("themes")}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === "themes"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}>
            Themes
          </button>
        </div>
      </div>

      <div className="px-6 pb-6">
        {activeTab === "engine" ? (
          <div
            style={{
              backgroundColor: "rgba(240, 217, 181, 0.05)",
              border: "1px solid rgba(240, 217, 181, 0.15)",
              borderRadius: "12px",
              padding: "20px"
            }}>
            <div className="space-y-6">
              {/* Depth Slider */}
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <label
                    className="text-sm font-medium"
                    style={{ color: "#f0d9b5", opacity: 0.85 }}>
                    Search Depth
                  </label>
                  <span
                    className="text-base font-semibold tabular-nums"
                    style={{ color: "#f0d9b5" }}>
                    {depth}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="40"
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Time Slider */}
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <label
                    className="text-sm font-medium"
                    style={{ color: "#f0d9b5", opacity: 0.85 }}>
                    Analysis Time
                  </label>
                  <span
                    className="text-base font-semibold tabular-nums"
                    style={{ color: "#f0d9b5" }}>
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
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={`group relative rounded-lg overflow-hidden border-2 transition-all ${
                  activeThemeId === theme.id
                    ? "border-amber-400 ring-2 ring-amber-400 ring-opacity-50"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}>
                <img
                  src={theme.thumbnail}
                  alt={theme.name}
                  className="w-full h-24 object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-black bg-opacity-60 p-2 backdrop-blur-sm">
                  <span className="text-xs font-medium block truncate">
                    {theme.name}
                  </span>
                </div>
                {activeThemeId === theme.id && (
                  <div className="absolute top-2 right-2 bg-amber-400 rounded-full p-1 shadow-lg">
                    <svg
                      className="w-3 h-3 text-black"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #b58863;
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #f59e0b;
          cursor: pointer;
          border: none;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #171513;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `}</style>
    </div>
  )
}
