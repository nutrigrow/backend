import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.js'],
    exclude: ['src/tests/smoke.test.js'],
    clearMocks: true,
    restoreMocks: true,
  },
});
