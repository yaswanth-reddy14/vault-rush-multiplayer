import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 180000,
  workers: 1,
  use: {
    actionTimeout: 10000,
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} ${process.env.E2E_PRODUCTION === "1" ? "start" : "run dev"}`,
    env: {
      PORT: "3000",
      PUBLIC_ORIGIN: "http://localhost:3000",
      ROOM_TTL_MS: "1800000",
      NODE_ENV:
        process.env.E2E_PRODUCTION === "1" ? "production" : "development",
    },
    url: "http://localhost:3000/health",
    reuseExistingServer: process.env.E2E_PRODUCTION !== "1" && !process.env.CI,
    timeout: 60000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
