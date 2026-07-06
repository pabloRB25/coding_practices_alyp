import { defineConfig, devices } from "@playwright/test";

// qa-standard: v1 — QA_BASE_URL la define el ambiente activo (ver qa/qa.config.yaml)
const criticidad = process.env.QA_CRITICIDAD ?? "P0|P1";

export default defineConfig({
  testDir: "./flujos",
  outputDir: "../evidencias/playwright",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  // Los flujos suelen compartir el tenant QA (config de empresa, datos del
  // período): un worker evita interferencia entre specs. Subí solo si TODOS
  // los flujos son independientes de verdad.
  workers: 1,
  fullyParallel: false,
  grep: new RegExp(`@(${criticidad})`),
  reporter: [
    ["list"],
    ["json", { outputFile: "../evidencias/playwright-run.json" }],
  ],
  use: {
    baseURL: process.env.QA_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-CR",
    timezoneId: "America/Costa_Rica",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Compatibilidad (P2, corrida nocturna): activar con QA_COMPAT=1
    ...(process.env.QA_COMPAT
      ? [
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
          { name: "movil", use: { ...devices["Pixel 7"] } },
        ]
      : []),
  ],
});
