import { generateXFen, type LichessMsg } from "./xfen-generator"

export {}

console.log("Background script loaded")

let currentVariant = "chess"
let currentCastling = "KQkq"

function updateCastlingState(uci: string) {
  if (!uci || uci.length < 4) return
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  
  // 1. Handle Pieces Moving (Loss of rights)
  if (from === "e1") currentCastling = currentCastling.replace(/[KQ]/g, "")
  if (from === "e8") currentCastling = currentCastling.replace(/[kq]/g, "")
  if (from === "a1") currentCastling = currentCastling.replace("Q", "")
  if (from === "h1") currentCastling = currentCastling.replace("K", "")
  if (from === "a8") currentCastling = currentCastling.replace("q", "")
  if (from === "h8") currentCastling = currentCastling.replace("k", "")

  // 2. Handle Captures (Loss of rights if a Rook is captured)
  if (to === "a1") currentCastling = currentCastling.replace("Q", "")
  if (to === "h1") currentCastling = currentCastling.replace("K", "")
  if (to === "a8") currentCastling = currentCastling.replace("q", "")
  if (to === "h8") currentCastling = currentCastling.replace("k", "")

  if (currentCastling === "") currentCastling = "-"
}

async function setupOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
  })

  if (existingContexts.length > 0) {
    return
  }

  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("tabs/offscreen.html"),
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "To run Stockfish WebAssembly in a Worker."
    })
    console.log("✨ Offscreen document created")
  } catch (err) {
    console.error("❌ Failed to create offscreen document:", err)
  }
}

// Setup on startup
setupOffscreen()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LICHESS_MOVE" && message.payload != 0) {
    if (message.payload.d?.uci) {
      updateCastlingState(message.payload.d.uci)
    }

    const xfen = generateXFen(message.payload, currentVariant, currentCastling)
    
    chrome.storage.local.get(["depth", "time"], (result) => {
      const depth = result.depth !== undefined ? result.depth : 30
      const time = result.time !== undefined ? result.time : 3.0
      setupOffscreen().then(() => {
        chrome.runtime.sendMessage({
          type: "ANALYZE_POSITION",
          fen: xfen,
          depth: depth,
          time: time
        }).catch(() => {})
        sendResponse({ status: "success" })
      })
    })
    return true
  }

  if (message.type === "RESET_ENGINE") {
    currentCastling = "KQkq" // Reset rights for new game
    setupOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: "RESET_ENGINE" }).catch(() => {})
      sendResponse({ status: "success" })
    })
    return true
  }

  if (message.type === "SET_VARIANT") {
    currentVariant = message.variant
    setupOffscreen().then(() => {
      chrome.runtime.sendMessage({
        type: "SET_VARIANT",
        variant: message.variant
      }).catch(() => {})
      sendResponse({ status: "success" })
    })
    return true
  }

  if (message.type === "STOCKFISH_OUTPUT") {
    chrome.tabs.query({ url: "https://lichess.org/*" }, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: "BEST_MOVE",
            data: message.data
          }).catch(() => {})
        }
      })
    })
  }
})
