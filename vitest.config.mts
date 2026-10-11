import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mirror tsconfig paths ("@/*" -> "./src/*") so route files imported by
    // tests resolve their own @/lib helpers at runtime.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/scripts/cloudflare-parity.test.mjs",
    ],
  },
});
