import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Test runner config. resolve.alias MUST mirror the tsconfig `@/*` path alias
// (→ ./src) or `@/`-imports fail to resolve inside tests.
export default defineConfig({
  plugins: [react()],
  // Use React 19's automatic JSX runtime so tests need no explicit React import.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
