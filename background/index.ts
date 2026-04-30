import { getCrazyhouseFen, type LichessMsg } from "./xfen-generator"

export {}

console.log("Background script loaded")

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LICHESS_MOVE" && message.payload != 0) {
    console.log("♟️ Background received move:", message.payload)

    const xfen = getCrazyhouseFen(message.payload)
    console.log(`📋 Generated X-FEN for move ${message.payload.v}:`, xfen)

    // Get settings from storage before sending analysis request
    chrome.storage.local.get(["depth", "time"], (result) => {
      const depth = result.depth !== undefined ? result.depth : 30
      const time = result.time !== undefined ? result.time : 3.0

      console.log(`⚙️ Using settings - Depth: ${depth}, Time: ${time}s`)

      // Send X-FEN to AWS Lambda for analysis
      fetch(
        "https://tf4h7vfx2htnigjizra65cpdze0zzzxn.lambda-url.us-east-1.on.aws/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fen: xfen,
            time: time,
            depth: depth
          })
        }
      )
        .then((response) => response.json())
        .then((data) => {
          console.log("✅ Server response:", data)
          console.log(`🎯 Best move from server: ${data.best_move}`)

          // Send analysis data to content script
          chrome.tabs.query({ url: "https://lichess.org/*" }, (tabs) => {
            tabs.forEach((tab) => {
              if (tab.id) {
                chrome.tabs.sendMessage(
                  tab.id,
                  {
                    type: "BEST_MOVE",
                    data: data
                  },
                  (response) => {
                    // Check for errors (e.g., content script not loaded)
                    if (chrome.runtime.lastError) {
                      console.warn(
                        "⚠️ Could not send to content script:",
                        chrome.runtime.lastError.message
                      )
                    } else {
                      console.log("✅ Analysis data sent to content script")
                    }
                  }
                )
              }
            })
          })
        })
        .catch((error) => {
          console.error("❌ Error communicating with server:", error)
        })
    })
  }
})
