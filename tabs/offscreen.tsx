import { useEffect, useRef } from "react"

export default function OffscreenPage() {
  const engineRef = useRef<any>(null)
  const turnRef = useRef("w")
  const currentAnalysisRef = useRef({
    best_move: "",
    is_drop: false,
    score_cp: null as number | null,
    score_mate: null as number | null
  })

  useEffect(() => {
    console.log("🚀 Starting Fairy Stockfish Engine...")

    const loadStockfish = () => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = chrome.runtime.getURL("assets/stockfish.js")
        script.onload = () => {
          console.log("✅ Stockfish script loaded")
          resolve(null)
        }
        script.onerror = () => reject(new Error("Failed to load stockfish.js"))
        document.head.appendChild(script)
      })
    }

    const initEngine = async () => {
      try {
        await loadStockfish()
        await new Promise((resolve) => setTimeout(resolve, 100))

        if (typeof (window as any).Stockfish === "undefined") {
          throw new Error("Stockfish not available on window object")
        }

        console.log("✅ Creating engine instance...")

        // @ts-ignore
        const engine = await (window as any).Stockfish({
          locateFile: (file: string) => {
            if (file.endsWith(".wasm")) {
              return chrome.runtime.getURL("assets/stockfish.wasm")
            }
            if (file.endsWith(".worker.js") || file.includes("worker")) {
              return chrome.runtime.getURL("assets/stockfish.worker.js")
            }
            return chrome.runtime.getURL("assets/" + file)
          }
        })

        engineRef.current = engine
        console.log("✅ Engine instance created")

        engine.addMessageListener((line: string) => {
          // Parse info strings for evaluation
          if (line.startsWith("info depth")) {
            const cpMatch = line.match(/score cp (-?\d+)/)
            const mateMatch = line.match(/score mate (-?\d+)/)

            const isBlackTurn = turnRef.current === "b"

            if (cpMatch) {
              const cp = parseInt(cpMatch[1], 10)
              currentAnalysisRef.current.score_cp = isBlackTurn ? -cp : cp
              currentAnalysisRef.current.score_mate = null
            }

            if (mateMatch) {
              const mate = parseInt(mateMatch[1], 10)
              currentAnalysisRef.current.score_mate = isBlackTurn ? -mate : mate
              currentAnalysisRef.current.score_cp = null
            }
          } 
          // Parse bestmove
          else if (line.startsWith("bestmove")) {
            const parts = line.split(" ")
            if (parts.length >= 2) {
              const move = parts[1]
              if (move !== "(none)") {
                currentAnalysisRef.current.best_move = move
                currentAnalysisRef.current.is_drop = move.includes("@")

                console.log("📬 Sending STOCKFISH_OUTPUT:", currentAnalysisRef.current)
                chrome.runtime.sendMessage({
                  type: "STOCKFISH_OUTPUT",
                  data: { ...currentAnalysisRef.current }
                })
              }
            }
          }
        })

        engine.postMessage("uci")
        await new Promise((resolve) => setTimeout(resolve, 500))
        engine.postMessage("isready")

      } catch (error) {
        console.error("❌ Error initializing engine:", error)
      }
    }

    initEngine()
  }, [])

  useEffect(() => {
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === "ANALYZE_POSITION") {
        if (!engineRef.current) {
          console.warn("Engine not ready yet, ignoring FEN:", message.fen)
          sendResponse({ status: "not_ready" })
          return
        }

        const searchDepth = message.depth || 30
        const searchTimeMs = Math.round((message.time || 3.0) * 1000)

        // Extract active color (w/b) from FEN, e.g. "rnbqk... w KQkq..."
        const fenParts = message.fen.split(" ")
        turnRef.current = fenParts.length > 1 ? fenParts[1] : "w"

        console.log(`🔍 Analyzing FEN (depth ${searchDepth}, time ${searchTimeMs}ms, turn ${turnRef.current}):`, message.fen)
        
        currentAnalysisRef.current = {
          best_move: "",
          is_drop: false,
          score_cp: null,
          score_mate: null
        }

        engineRef.current.postMessage("stop")
        engineRef.current.postMessage(`position fen ${message.fen}`)
        engineRef.current.postMessage(`go depth ${searchDepth} movetime ${searchTimeMs}`)
        sendResponse({ status: "started" })
      }

      if (message.type === "SET_VARIANT") {
        if (!engineRef.current) {
          sendResponse({ status: "not_ready" })
          return
        }

        const variantMap: Record<string, string> = {
          "Crazyhouse": "crazyhouse",
          "Chess960": "chess960",
          "King of the Hill": "kingofthehill",
          "Three-check": "3check",
          "Antichess": "antichess",
          "Atomic": "atomic",
          "Horde": "horde",
          "Racing Kings": "racingkings"
        }

        const uciVariant = variantMap[message.variant] || "chess"
        console.log(`⚙️ Setting engine variant to: ${uciVariant} (from ${message.variant})`)
        
        engineRef.current.postMessage("stop")
        engineRef.current.postMessage(`setoption name UCI_Variant value ${uciVariant}`)
        engineRef.current.postMessage("isready")
        sendResponse({ status: "success" })
      }

      if (message.type === "RESET_ENGINE") {
        if (!engineRef.current) {
          sendResponse({ status: "not_ready" })
          return
        }
        engineRef.current.postMessage("stop")
        engineRef.current.postMessage("ucinewgame")
        engineRef.current.postMessage("isready")
        sendResponse({ status: "success" })
      }
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      messageListener(message, sender, sendResponse)
      // Since all our handlers are currently synchronous in how they post to the engine,
      // we don't need to return true, but we must ensure we don't leave the channel hanging.
      return false 
    })
  }, [])

  return null
}
