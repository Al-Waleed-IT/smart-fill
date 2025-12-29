// Generate PNG icons
// Run: npm run icons

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { deflateSync } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')

// Ensure icons directory exists
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true })
}

// Create simple PNG image data
function createSimplePng(size) {
  const pixels = []
  const cornerRadius = size * 0.2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Check if point is inside rounded rectangle
      const halfSize = size / 2
      const dx = Math.abs(x - halfSize)
      const dy = Math.abs(y - halfSize)
      let inside = true

      if (dx > halfSize - cornerRadius && dy > halfSize - cornerRadius) {
        const cornerDist = Math.sqrt(
          Math.pow(dx - (halfSize - cornerRadius), 2) +
          Math.pow(dy - (halfSize - cornerRadius), 2)
        )
        inside = cornerDist <= cornerRadius
      }

      if (inside) {
        // Gradient from blue (#3b82f6) to purple (#8b5cf6)
        const gradientPos = (x + y) / (size * 2)
        const r = Math.round(59 + (139 - 59) * gradientPos)
        const g = Math.round(130 + (92 - 130) * gradientPos)
        const b = 246
        pixels.push(r, g, b, 255)
      } else {
        pixels.push(0, 0, 0, 0) // Transparent
      }
    }
  }

  // Add white lines to represent form fields
  const linePositions = [0.35, 0.5, 0.65]
  const lineWidths = [0.5, 0.4, 0.3]

  for (let i = 0; i < linePositions.length; i++) {
    const y = Math.round(size * linePositions[i])
    const startX = Math.round(size * 0.25)
    const endX = Math.round(size * (0.25 + lineWidths[i]))
    const lineHeight = Math.max(1, Math.round(size * 0.06))

    for (let ly = y; ly < y + lineHeight && ly < size; ly++) {
      for (let lx = startX; lx < endX && lx < size; lx++) {
        const idx = (ly * size + lx) * 4
        if (pixels[idx + 3] > 0) {
          pixels[idx] = 255
          pixels[idx + 1] = 255
          pixels[idx + 2] = 255
          pixels[idx + 3] = 255
        }
      }
    }
  }

  return Buffer.from(pixels)
}

// CRC32 calculation
function crc32(data) {
  let crc = 0xffffffff
  const table = new Uint32Array(256)

  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }

  return crc ^ 0xffffffff
}

// Create PNG chunk
function createPngChunk(type, data) {
  const typeBytes = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const combined = Buffer.concat([typeBytes, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(combined) >>> 0)

  return Buffer.concat([length, combined, crc])
}

// Encode PNG
function encodePng(width, height, rgbaData) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8)   // bit depth
  ihdr.writeUInt8(6, 9)   // color type (RGBA)
  ihdr.writeUInt8(0, 10)  // compression
  ihdr.writeUInt8(0, 11)  // filter
  ihdr.writeUInt8(0, 12)  // interlace

  // Raw image data with filter bytes
  const rawData = []
  for (let y = 0; y < height; y++) {
    rawData.push(0) // No filter
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      rawData.push(rgbaData[idx], rgbaData[idx + 1], rgbaData[idx + 2], rgbaData[idx + 3])
    }
  }

  // IDAT chunk (compressed image data)
  const compressed = deflateSync(Buffer.from(rawData))

  // IEND chunk
  const iend = Buffer.alloc(0)

  return Buffer.concat([
    signature,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', compressed),
    createPngChunk('IEND', iend)
  ])
}

// Generate icons
const sizes = [16, 48, 128]

console.log('Generating PNG icons...')

for (const size of sizes) {
  const rgbaData = createSimplePng(size)
  const png = encodePng(size, size, rgbaData)
  const path = join(iconsDir, `icon${size}.png`)
  writeFileSync(path, png)
  console.log(`Created: icon${size}.png`)
}

console.log('Done!')
