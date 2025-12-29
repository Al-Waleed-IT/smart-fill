import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: 'copy-extension-files',
      closeBundle() {
        // Ensure dist directory exists
        if (!existsSync('dist')) {
          mkdirSync('dist', { recursive: true })
        }
        if (!existsSync('dist/icons')) {
          mkdirSync('dist/icons', { recursive: true })
        }

        // Copy manifest.json
        copyFileSync('manifest.json', 'dist/manifest.json')

        // Copy icons
        const iconSizes = ['16', '48', '128']
        iconSizes.forEach(size => {
          const svgPath = `public/icons/icon${size}.svg`
          if (existsSync(svgPath)) {
            copyFileSync(svgPath, `dist/icons/icon${size}.svg`)
          }
        })
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        settings: resolve(__dirname, 'settings.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})
