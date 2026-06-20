/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/**',
        'src/types/auth.ts',
        'src/contexts/**',
        'src/hooks/useFilters.tsx',
        'src/components/ProtectedRoute.tsx',
        'src/components/Logo.tsx',
        'src/components/layout/**',
        'src/api/client.ts',
        'src/config/navigation.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
