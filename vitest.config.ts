import { rmSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

rmSync('coverage', { recursive: true, force: true });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['html', 'text', 'lcov'],
      exclude: ['package.json', 'src/drivers', 'dist', 'node_modules', '**/*.d.ts']
    },
    typecheck: {
      tsconfig: './tsconfig.test.json'
    },
    logHeapUsage: true
  }
});
