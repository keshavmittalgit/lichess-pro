export interface LichessMsg {
  t: string
  d: {
    fen: string
    ply: number
    uci: string // Required for En Passant calculation
    san: string // Required to identify if it's a pawn
    crazyhouse?: {
      pockets: Array<Record<string, number>>
    }
  }
}

// Map to ensure "knight" becomes "n", "Pawn" becomes "p", etc.
const PIECE_MAP: Record<string, string> = {
  p: "p",
  n: "n",
  b: "b",
  r: "r",
  q: "q",
  pawn: "p",
  knight: "n",
  bishop: "b",
  rook: "r",
  queen: "q"
}

// Helper: Calculate En Passant Target Square (e.g., "f6" or "-")
function getEnPassantTarget(uci: string, san: string): string {
  if (!uci || !san) return "-"

  // 1. Check if it is a Pawn move
  // SAN for pieces starts with Uppercase (N, B, R, Q, K). Pawns start with file (a-h) or are just the destination
  const isPieceMove = ["N", "B", "R", "Q", "K"].includes(san[0])
  if (isPieceMove) return "-"

  // 2. Parse Source and Destination from UCI (e.g. "f7f5")
  if (uci.length < 4) return "-"

  const srcFile = uci[0]
  const srcRank = parseInt(uci[1])
  const dstFile = uci[2]
  const dstRank = parseInt(uci[3])

  // 3. Check for Double Push (same file, distance of 2 ranks)
  if (srcFile === dstFile && Math.abs(dstRank - srcRank) === 2) {
    // Determine the en passant target square (the square the pawn "jumped over")
    // White pawns: move from rank 2 to 4, target is rank 3
    // Black pawns: move from rank 7 to 5, target is rank 6

    if (srcRank === 2 && dstRank === 4) {
      // White pawn double push (e.g., e2e4 -> target e3)
      return `${srcFile}3`
    } else if (srcRank === 7 && dstRank === 5) {
      // Black pawn double push (e.g., f7f5 -> target f6)
      return `${srcFile}6`
    }
  }

  return "-"
}

export function getCrazyhouseFen(msg: LichessMsg): string {
  const data = msg.d
  let fen = data.fen

  // 1. Build the Pocket String [NNpp...]
  let pocketString = ""

  if (data.crazyhouse && data.crazyhouse.pockets) {
    const whitePocketObj = data.crazyhouse.pockets[0]
    const blackPocketObj = data.crazyhouse.pockets[1]

    const processPocket = (
      pocketObj: Record<string, number>,
      isWhite: boolean
    ) => {
      let str = ""
      for (const rawPieceName in pocketObj) {
        const lowerName = rawPieceName.toLowerCase()
        const fenChar = PIECE_MAP[lowerName] // "knight" -> "n"

        if (fenChar) {
          const count = pocketObj[rawPieceName]
          const finalChar = isWhite ? fenChar.toUpperCase() : fenChar
          str += finalChar.repeat(count)
        }
      }
      return str
    }

    pocketString += processPocket(whitePocketObj, true)
    pocketString += processPocket(blackPocketObj, false)
  }

  const finalPocket = `[${pocketString}]`

  // 2. Determine Turn (White or Black)
  const turnColor = data.ply % 2 === 0 ? "w" : "b"

  // 3. Calculate Full Move Number (THE FIX)
  // Ply 0 or 1 = Move 1
  // Ply 2 or 3 = Move 2
  const fullMoveNumber = Math.floor(data.ply / 2) + 1

  // 4. Assemble the Final X-FEN
  if (fen.includes(" ")) {
    // If Lichess sent a full FEN, we inject the pocket into the first part
    const parts = fen.split(" ")
    parts[0] = parts[0] + finalPocket
    // We can also update the move number if needed, but usually we just use what Lichess sent
    return parts.join(" ")
  } else {
    // Construct the standard FEN format

    // Calculate En Passant Target
    const enPassantTarget = getEnPassantTarget(data.uci, data.san)

    // Format: [Board+Pocket] [Turn] [Castling] [EnPassant] [HalfMove] [FullMove]
    return `${fen}${finalPocket} ${turnColor} KQkq ${enPassantTarget} 0 ${fullMoveNumber}`
  }
}
