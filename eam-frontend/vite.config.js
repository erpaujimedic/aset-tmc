import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('echarts') || id.includes('zrender')) return 'echarts';
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'leaflet';
            if (id.includes('html2pdf.js') || id.includes('html2canvas') || id.includes('jspdf')) return 'html2pdf';
            return 'vendor';
          }
        }
      }
    }
  },
  css: {
    lightningcss: {
      errorRecovery: true
    }
  }
})
