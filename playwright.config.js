import { defineConfig } from "@playwright/test";

const executablePath = process.env.RESUMEFILL_CHROME_PATH || undefined;

export default defineConfig({
  testDir: "./tests",
  outputDir: process.env.RESUMEFILL_TEST_OUTPUT || "test-results",
  fullyParallel: false,
  timeout: 15_000,
  reporter: "line",
  use: {
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {}
  }
});
