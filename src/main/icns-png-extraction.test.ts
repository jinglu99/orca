import { describe, expect, it } from 'vitest'
import { extractIcnsPngEntries, pickIcnsPngForDisplay } from './icns-png-extraction'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function pngPayload(marker: number, extraBytes = 4): Buffer {
  return Buffer.concat([PNG_MAGIC, Buffer.alloc(extraBytes, marker)])
}

function chunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.write(type, 0, 4, 'ascii')
  header.writeUInt32BE(data.length + 8, 4)
  return Buffer.concat([header, data])
}

function icns(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([header, body])
}

describe('extractIcnsPngEntries', () => {
  it('finds each PNG-backed icon with its nominal size', () => {
    const file = icns(chunk('ic07', pngPayload(1)), chunk('ic08', pngPayload(2)))

    expect(extractIcnsPngEntries(file).map((entry) => [entry.type, entry.size])).toEqual([
      ['ic07', 128],
      ['ic08', 256]
    ])
  })

  it('skips chunks whose payload is not a PNG', () => {
    // Why: older icon types hold raw ARGB or JPEG 2000, which would render as garbage.
    const file = icns(chunk('is32', Buffer.alloc(16, 7)), chunk('ic08', pngPayload(2)))

    expect(extractIcnsPngEntries(file).map((entry) => entry.type)).toEqual(['ic08'])
  })

  it('ignores a file that is not an icns container', () => {
    expect(extractIcnsPngEntries(Buffer.from('not an icon at all'))).toEqual([])
  })

  it('ignores an empty buffer', () => {
    expect(extractIcnsPngEntries(Buffer.alloc(0))).toEqual([])
  })

  it('stops at a chunk that claims more bytes than the file holds', () => {
    // Why this matters: a truncated download would otherwise read past the buffer or hand back
    // one chunk's header as another chunk's image.
    const good = chunk('ic07', pngPayload(1))
    const lying = Buffer.alloc(8)
    lying.write('ic08', 0, 4, 'ascii')
    lying.writeUInt32BE(9999, 4)
    const file = icns(good, lying)

    expect(extractIcnsPngEntries(file).map((entry) => entry.type)).toEqual(['ic07'])
  })

  it('stops on a chunk length too small to be legal instead of spinning', () => {
    const lying = Buffer.alloc(8)
    lying.write('ic07', 0, 4, 'ascii')
    lying.writeUInt32BE(0, 4)

    expect(extractIcnsPngEntries(icns(lying))).toEqual([])
  })
})

describe('pickIcnsPngForDisplay', () => {
  const entries = [
    { type: 'icp4', size: 16, data: pngPayload(1) },
    { type: 'ic07', size: 128, data: pngPayload(2) },
    { type: 'ic10', size: 1024, data: pngPayload(3) }
  ]

  it('takes the smallest icon that is still large enough', () => {
    expect(pickIcnsPngForDisplay(entries)).toEqual(entries[1].data)
  })

  it('falls back to the largest when nothing reaches the minimum', () => {
    expect(pickIcnsPngForDisplay([entries[0]])).toEqual(entries[0].data)
  })

  it('returns null with nothing to choose from', () => {
    expect(pickIcnsPngForDisplay([])).toBeNull()
  })
})
