import { test, expect } from "@playwright/test";
import nextEnv from "@next/env";
Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV ?? "test" });
nextEnv.loadEnvConfig(process.cwd());

test("teacher and student golden path", async ({ page }) => {
  const password = process.env.E2E_TEST_USER_PASSWORD!;
  async function login(email: string) {
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole("button", { name: /iniciar sesión|entrar|login/i }).click();
    await expect(page).not.toHaveURL(/login/);
  }

  await login("teacher.a@test.local");

  await page.context().clearCookies();
  await login("student.a@test.local");
  await page.goto("/student/modules/module-a/activities/activity-a");
  await expect(page.getByText("Activity A")).toBeVisible();
  await page.getByLabel(/qué piensas/i).fill("La evidencia muestra mi razonamiento.");
  await page.getByRole("button", { name: /guardar respuesta/i }).click();
  await expect(page.getByText(/respuesta guardada|guardado/i)).toBeVisible();
  await page.getByLabel("Título").fill("M6.2 text evidence");
  await page.getByRole("textbox", { name: "Texto" }).fill("Evidence created through the student UI.");
  await page.getByRole("button", { name: /guardar borrador/i }).click();
  await page.getByRole("button", { name: /enviar evidencia/i }).click();
  await expect(page.getByText(/enviada · text/i)).toBeVisible();
  await page.getByRole("button", { name: /marcar como completada/i }).click();
  await expect(page.getByText(/completada/i)).toBeVisible();

  await page.context().clearCookies();
  await login("teacher.a@test.local");
  await page.goto("/evidence");
  await expect(page.locator("body")).toContainText(/evidencia|inbox/i);
  const evidenceLink = page.getByRole("link", { name: /M6\.2 text evidence/i });
  await expect(evidenceLink).toBeVisible();
  await evidenceLink.click();
  await expect(page.getByRole("heading", { name: /evaluación/i })).toBeVisible({ timeout: 20_000 });
  await page.locator("[data-criterion]").fill("4");
  await page.getByRole("button", { name: /guardar evaluación/i }).click();
  await expect(page.getByRole("status")).toContainText(/evaluación guardada/i);
});
