import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // Each test file mocks Prisma itself; never let a test reach a real database.
    env: {
      DB_PRISMA_URL: "postgres://test-only-never-connects/none",
    },
  },
});
