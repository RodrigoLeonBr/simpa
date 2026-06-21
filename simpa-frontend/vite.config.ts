/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'playwright.config.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/**',
        'src/types/auth.ts',
        'src/contexts/**',
        'src/hooks/useFilters.tsx',
        'src/hooks/useDashboard.ts',
        'src/hooks/usePaginatedCatalog.ts',
        'src/components/ProtectedRoute.tsx',
        'src/components/Logo.tsx',
        'src/components/layout/**',
        'src/components/painel/**',
        'src/pages/Painel/**',
        'src/pages/Situacao/**',
        'src/pages/Indicadores/**',
        'src/pages/Metas/**',
        'src/pages/Relatorios/**',
        'src/pages/Importacao/**',
        'src/pages/Cadastros/**',
        'src/pages/Administracao/**',
        'src/components/cadastros/**',
        'src/components/shared/**',
        'src/api/client.ts',
        'src/api/cadastros.ts',
        'src/api/importacao.ts',
        'src/api/admin.ts',
        'src/config/cadastroEntities.ts',
        'src/utils/cadastroView.ts',
        'src/utils/adminView.ts',
        'src/utils/enrichmentView.ts',
        'src/utils/estabelecimentosView.ts',
        'src/hooks/useImportBadge.ts',
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
