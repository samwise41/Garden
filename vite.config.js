import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CHANGE THIS LINE BELOW:
  base: 'https://github.com/samwise41/Garden', 
})
