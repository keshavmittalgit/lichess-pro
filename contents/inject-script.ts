import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://lichess.org/*"],
  world: "MAIN",
  run_at: "document_start",
  all_frames: true
}

console.log("Interceptor script is working")

// Immediately execute the interception logic
;(function () {
  const OriginalWebSocket = window.WebSocket

  // Guard to prevent double-wrapping
  if (OriginalWebSocket.name === "WebSocketProxy") return

  // Wrapper function using the pattern suggested by user
  // @ts-ignore
  window.WebSocket = function (...args) {
    // @ts-ignore
    const socket = new OriginalWebSocket(...args)

    // Listen for incoming messages
    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data)
        // Log everything for debug in Main World console
        console.log("📨 WS:", data)

        // Forward data to Isolated World content script
        window.postMessage(
          {
            type: "LICHESS_WS",
            data: data
          },
          "*"
        )
      } catch (e) {
        // Ignore non-JSON or other errors
      }
    })

    return socket
  }

  // Maintain the prototype chain
  window.WebSocket.prototype = OriginalWebSocket.prototype
  // @ts-ignore (set name for the guard)
  Object.defineProperty(window.WebSocket, "name", { value: "WebSocketProxy" })

  console.log("Main world interceptor active (via Plasmo)")

  // Let's also log to verify this script is running in the page's window
  console.log("Window Origin:", window.location.origin)
})()
