import { generateXFen, type LichessMsg } from "./xfen-generator"

export {}

console.log("Background script loaded")

let currentVariant = "chess"

// Create offscreen document if it doesn't exist
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
    const xfen = generateXFen(message.payload, currentVariant)
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
