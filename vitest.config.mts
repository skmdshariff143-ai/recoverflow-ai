import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.{test,spec}.ts', 'tests/unit/**/*.{test,spec}.ts', 'tests/integration/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    environment: 'node',
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@recoverflow/core': path.resolve(import.meta.dirname, './packages/core/src/index.ts'),
      '@recoverflow/agents': path.resolve(import.meta.dirname, './packages/agents/src/index.ts'),
      '@recoverflow/jobs': path.resolve(import.meta.dirname, './packages/jobs/src/index.ts'),
      '@recoverflow/pixel': path.resolve(import.meta.dirname, './packages/pixel/src/index.ts'),
    },
  },
});
