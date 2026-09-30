import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 390, height: 844 },
  },
  workers: 1,
});
