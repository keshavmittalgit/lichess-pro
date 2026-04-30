import { useEffect, useState } from "react"

import "./popup.css"

export default function Popup() {
  const [depth, setDepth] = useState(20) // 10-40 moves
  const [time, setTime] = useState(.5) // 0.5-5 seconds
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      const result = await chrome.storage.local.get(["depth", "time"])
      if (result.depth !== undefined) setDepth(result.depth)
      if (result.time !== undefined) setTime(result.time)
      setIsLoaded(true)
    }
    loadSettings()
  }, [])

  // Save depth to storage whenever it changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      chrome.storage.local.set({ depth })
    }
  }, [depth, isLoaded])

  // Save time to storage whenever it changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      chrome.storage.local.set({ time })
    }
  }, [time, isLoaded])

  return (
    <div
      className="w-96 text-white"
      style={{
        backgroundColor: "#171513",
        fontFamily: "'Noto Sans', sans-serif",
        padding: "28px 24px"
      }}>
      {/* Header */}
      <div className="mb-5">
        <h1
          className="text-2xl font-light tracking-tight "
          style={{ color: "#f0d9b5", letterSpacing: "-0.02em" }}>
          Fairy Stockfish
        </h1>
      </div>

      {/* Settings */}
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
            <div
              className="flex justify-between text-xs mt-2"
              style={{ color: "#f0d9b5", opacity: 0.5 }}>
              <span>10</span>
              <span>40</span>
            </div>
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
            <div
              className="flex justify-between text-xs mt-2"
              style={{ color: "#f0d9b5", opacity: 0.5 }}>
              <span>0.5s</span>
              <span>5s</span>
            </div>
          </div>
        </div>
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
      `}</style>
    </div>
  )
}
