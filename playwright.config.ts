import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    viewport: { width: 1360, height: 860 },
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm start -p 3100", url: "http://localhost:3100/api/health", reuseExistingServer: true, timeout: 120_000 },
});
