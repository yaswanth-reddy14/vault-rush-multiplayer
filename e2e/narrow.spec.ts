import { test, expect } from "@playwright/test";

test("320px landing, join form and lobby have no horizontal overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 740 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const fits = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  await page.goto("/");
  await fits();
  await page.getByRole("button", { name: "Create a crew" }).click();
  await page.getByLabel("AGENT NAME").fill("Agent1234567890123");
  await fits();
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(page.getByText("The usual suspects")).toBeVisible();
  await fits();
  await page.screenshot({ path: "artifacts/narrow-lobby.png", fullPage: true });
  await context.close();
});
