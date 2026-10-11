import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/scripts/cloudflare-parity.test.mjs",
    ],
  },
});
