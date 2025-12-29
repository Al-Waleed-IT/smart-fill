import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')

async function build() {
  console.log('Building Smart Fill extension...\n')

  // Ensure dist directory exists
  mkdirSync(distDir, { recursive: true })
  mkdirSync(join(distDir, 'icons'), { recursive: true })
  mkdirSync(join(distDir, 'assets'), { recursive: true })

  // Build Vue apps
  console.log('1. Building Vue applications...')
  try {
    execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' })
  } catch (error) {
    console.error('Vite build failed:', error.message)
    process.exit(1)
  }

  // Copy background.js
  console.log('\n2. Copying background script...')
  const backgroundScript = readFileSync(join(rootDir, 'src/background/index.js'), 'utf-8')
  writeFileSync(join(distDir, 'background.js'), backgroundScript)

  // Copy content.js
  console.log('3. Copying content script...')
  const contentScript = readFileSync(join(rootDir, 'src/content/index.js'), 'utf-8')
  writeFileSync(join(distDir, 'content.js'), contentScript)

  // Copy content.css
  console.log('4. Copying content styles...')
  const contentCss = readFileSync(join(rootDir, 'src/content/content.css'), 'utf-8')
  writeFileSync(join(distDir, 'content.css'), contentCss)

  // Copy manifest.json
  console.log('5. Copying manifest...')
  copyFileSync(join(rootDir, 'manifest.json'), join(distDir, 'manifest.json'))

  // Copy icons
  console.log('6. Copying icons...')
  const iconSizes = ['16', '48', '128']
  for (const size of iconSizes) {
    const pngPath = join(rootDir, `public/icons/icon${size}.png`)
    if (existsSync(pngPath)) {
      copyFileSync(pngPath, join(distDir, `icons/icon${size}.png`))
    }
  }

  console.log('\n✅ Build complete!')
  console.log(`📁 Extension files are in: ${distDir}`)
  console.log('\nTo install:')
  console.log('1. Open Chrome and go to chrome://extensions')
  console.log('2. Enable "Developer mode"')
  console.log('3. Click "Load unpacked" and select the dist folder')
}

build().catch(console.error)
