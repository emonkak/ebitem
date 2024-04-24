import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      name: 'chrome',
    },
    coverage: {
      provider: 'istanbul',
    },
  },
});
