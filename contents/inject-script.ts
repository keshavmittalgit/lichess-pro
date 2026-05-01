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

  // --- SPA Navigation Interception ---
  const handleUrlChange = () => {
    window.postMessage({ type: "LICHESS_NAV" }, "*")
  }

  const originalPushState = history.pushState
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args)
    handleUrlChange()
    return result
  }

  const originalReplaceState = history.replaceState
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args)
    handleUrlChange()
    return result
  }

  window.addEventListener("popstate", handleUrlChange)

  console.log("Main world interceptor and navigation watcher active")
})()
