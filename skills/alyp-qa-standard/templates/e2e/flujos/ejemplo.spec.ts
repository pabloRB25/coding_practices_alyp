/**
 * Spec de referencia — qa-standard: v1
 * Convención: 1 spec por YAML del catálogo, archivo `<id>.spec.ts` (id literal,
 * con puntos). El título del describe = id; el tag @P0/@P1/@P2 = criticidad
 * (el config filtra por tag vía QA_CRITICIDAD).
 *
 * Mapeo YAML → código:
 * - precondiciones → beforeAll/seed (los datos ya existen; el spec NO crea datos a mano)
 * - pasos          → acciones Playwright, un comentario por paso con el texto del YAML
 * - aserciones.ui  → expects sobre la página
 * - aserciones.db  → oráculo DB (esperarFila/contarFilas); los cálculos de negocio
 *                    se expresan acá en código (toBeCloseTo, etc.), el YAML solo
 *                    declara la expectativa en lenguaje de negocio
 * - aserciones.logs→ automático vía fixture `erroresConsola` (importá test de soporte/fixtures)
 */
import { test, expect } from "../soporte/fixtures";
import { esperarFila } from "../soporte/oraculo-db";

test.describe("dominio.entidad.accion @P0", () => {
  test("flujo completo con oráculos UI + DB + logs", async ({ page, erroresConsola }) => {
    void erroresConsola; // activa el oráculo de logs (falla al final si la consola no queda limpia)

    // paso: "Ir a la pantalla de inicio de sesión"
    await page.goto("/login");

    // paso: "Ingresar credenciales del actor" (password por env var, ver seeds/personas.yaml)
    await page.getByTestId("login-email").fill("qa-admin@proyecto.test");
    await page.getByTestId("login-password").fill(process.env.QA_PASSWORD_ADMIN!);
    await page.getByTestId("login-submit").click();

    // aserción ui: "Se redirige al panel principal"
    await page.waitForURL("/"); // hard navigation: esperar URL, no asumir SPA
    // El criterio de "sesión activa" es propio de cada app: definí uno concreto
    // (un elemento del panel, o la ausencia del form de login) — no este genérico.
    await expect(page.getByRole("main")).toBeVisible();

    // aserción db: "fila persistida con los valores esperados"
    const fila = await esperarFila<{ estado: string; total: number }>("tabla", {
      id: "qa-registro-1",
    });
    expect(fila.estado).toBe("esperado");
    expect(fila.total).toBeGreaterThan(0);
  });
});
