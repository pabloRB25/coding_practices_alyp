import { test as base, expect } from "@playwright/test";

/**
 * Fixtures — qa-standard: v1
 * Extiende el test de Playwright con el oráculo de logs: acumula errores de
 * consola y pageerrors durante el flujo y falla al final si hubo alguno.
 * Los flujos importan `test`/`expect` desde acá, nunca de @playwright/test.
 */
type OraculoLogs = { erroresConsola: string[] };

export const test = base.extend<OraculoLogs>({
  erroresConsola: async ({ page }, use) => {
    const errores: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errores.push(msg.text());
    });
    page.on("pageerror", (err) => errores.push(`pageerror: ${err.message}`));
    await use(errores);
    // Oráculo logs: consola limpia al cerrar el flujo. Ruido conocido de
    // terceros se filtra acá (lista corta y justificada, no un cajón de sastre).
    const ignorables = [/favicon/i];
    const reales = errores.filter((e) => !ignorables.some((rx) => rx.test(e)));
    expect(reales, `Oráculo de logs: consola con errores:\n${reales.join("\n")}`).toEqual([]);
  },
});

export { expect };
