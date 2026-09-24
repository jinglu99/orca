const ICNS_MAGIC = 'icns'
const ICNS_HEADER_BYTES = 8
const CHUNK_HEADER_BYTES = 8
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Nominal pixel size of the icon types whose payload is a PNG. Others are raw or JPEG 2000. */
const PNG_CHUNK_SIZES: Readonly<Record<string, number>> = {
  icp4: 16,
  icp5: 32,
  icp6: 64,
  ic11: 32,
  ic12: 64,
  ic07: 128,
  ic13: 256,
  ic08: 256,
  ic14: 512,
  ic09: 512,
  ic10: 1024
}

export type IcnsPngEntry = { type: string; size: number; data: Buffer }

/**
 * The PNG images packed inside a macOS `.icns` container.
 *
 * Why parse it rather than hand the file to Electron: `nativeImage.createFromPath` returns an
 * empty image for `.icns`, so the file has to be opened here for the icon to exist at all. Modern
 * icon types store their payload as a plain PNG, which needs no decoding — only locating.
 */
export function extractIcnsPngEntries(contents: Buffer): IcnsPngEntry[] {
  if (contents.length < ICNS_HEADER_BYTES || contents.toString('ascii', 0, 4) !== ICNS_MAGIC) {
    return []
  }
  // Why the declared length is clamped: a truncated or padded file must not drive reads past the
  // buffer, and the buffer is the only length we can actually trust.
  const totalLength = Math.min(contents.readUInt32BE(4), contents.length)
  const entries: IcnsPngEntry[] = []
  let offset = ICNS_HEADER_BYTES
  while (offset + CHUNK_HEADER_BYTES <= totalLength) {
    const type = contents.toString('ascii', offset, offset + 4)
    const chunkLength = contents.readUInt32BE(offset + 4)
    // Why both bounds: a zero or negative-looking length would spin here, and an oversized one
    // would read another chunk's bytes as this one's image.
    if (chunkLength < CHUNK_HEADER_BYTES || offset + chunkLength > totalLength) {
      break
    }
    const data = contents.subarray(offset + CHUNK_HEADER_BYTES, offset + chunkLength)
    const declaredSize = PNG_CHUNK_SIZES[type]
    if (declaredSize !== undefined && data.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
      entries.push({ type, size: declaredSize, data })
    }
    offset += chunkLength
  }
  return entries
}

/**
 * The PNG to render an app icon from: the smallest one that still looks sharp when scaled down.
 *
 * Why not simply the largest: a 1024px icon is hundreds of kilobytes, and these travel to the
 * renderer as data URLs for every app in a menu.
 */
export function pickIcnsPngForDisplay(
  entries: readonly IcnsPngEntry[],
  minimumSize = 128
): Buffer | null {
  if (entries.length === 0) {
    return null
  }
  const ordered = [...entries].sort((left, right) => left.size - right.size)
  return (ordered.find((entry) => entry.size >= minimumSize) ?? ordered.at(-1))?.data ?? null
}
