import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 组件库构建：给其他应用（例如 session-viewer）当普通 ESM 包引用。
// React 保持外部化，由宿主提供；其余依赖打进产物，宿主不必再装一遍。
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/components/index.js',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
      output: { assetFileNames: 'index[extname]' },
    },
  },
})
