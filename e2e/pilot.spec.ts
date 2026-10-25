import { test, expect, type Page } from "@playwright/test";
async function join(page: Page, code: string, name: string) {
  await page.goto(`/?room=${code}`);
  await page.getByLabel("AGENT NAME").fill(name);
  await page.getByRole("button", { name: "Join crew", exact: true }).click();
  await expect(page.getByText("The usual suspects")).toBeVisible();
}
test("three real clients play six rounds, recover, transfer host and rematch", async ({
  browser,
}) => {
  const ca = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    cb = await browser.newContext(),
    cc = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await ca.newPage(),
    b = await cb.newPage(),
    c = await cc.newPage();
  const errors: string[] = [];
  for (const p of [a, b, c]) p.on("pageerror", (e) => errors.push(e.message));
  await a.goto("/");
  await a.screenshot({ path: "artifacts/desktop-landing.png", fullPage: true });
  await a.getByRole("button", { name: "Create a crew" }).click();
  await a.getByLabel("AGENT NAME").fill("Ada");
  await a.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(a.locator(".room-code")).toBeVisible();
  const code = (await a.locator(".room-code").innerText()).trim();
  await join(b, code, "Bea");
  await join(c, code, "Cy");
  for (const p of [a, b, c])
    await expect(p.locator(".roster .player")).toHaveCount(3);
  expect(
    await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await a.getByRole("button", { name: "Start the heist" }).click();
  for (let round = 1; round <= 6; round++) {
    for (const p of [a, b, c])
      await expect(
        p.getByRole("heading", { name: "Which vault is yours?" }),
      ).toBeVisible({ timeout: 20000 });
    if (round === 1) {
      expect(
        await c.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await c.screenshot({
        path: "artifacts/mobile-gameplay.png",
        fullPage: true,
      });
      await a.screenshot({
        path: "artifacts/desktop-gameplay.png",
        fullPage: true,
      });
    }
    for (const p of [a, b, c]) {
      await p.getByRole("button", { name: "Select vault 1 GHOST" }).click();
      await expect(
        p.getByRole("button", { name: "Lock my choice" }),
      ).toBeEnabled();
    }
    if (round === 2) {
      // Let unlocked picks settle at the authoritative deadline with other pages in the background.
      await a.bringToFront();
      await expect(
        a.getByRole("heading", { name: "The truth comes out." }),
      ).toBeVisible({ timeout: 25000 });
    } else {
      await a.getByRole("button", { name: "Lock my choice" }).click();
      await b.getByRole("button", { name: "Lock my choice" }).click();
      await c.getByRole("button", { name: "Lock my choice" }).click();
    }
    for (const p of [a, b, c])
      await expect(
        p.getByRole("heading", { name: "The truth comes out." }),
      ).toBeVisible();
    const scores = await a.locator(".score-row strong").allTextContents();
    expect(await b.locator(".score-row strong").allTextContents()).toEqual(
      scores,
    );
    expect(await c.locator(".score-row strong").allTextContents()).toEqual(
      scores,
    );
    if (round === 1) {
      await b.reload();
      await expect(
        b.getByRole("heading", { name: "The truth comes out." }),
      ).toBeVisible();
      await expect(b.getByRole("dialog")).toHaveCount(0);
      expect(await b.locator(".score-row strong").allTextContents()).toEqual(
        scores,
      );
    }
    console.log(`Round ${round}: all three clients agree on scores.`);
  }
  for (const p of [a, b, c])
    await expect(p.getByRole("heading", { name: "Crime pays." })).toBeVisible({
      timeout: 15000,
    });
  expect(
    await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await c.screenshot({ path: "artifacts/mobile-results.png", fullPage: true });
  await a.getByRole("button", { name: "Leave room" }).click();
  await expect(b.getByRole("button", { name: "Run it back" })).toBeEnabled();
  await b.getByRole("button", { name: "Run it back" }).click();
  for (const p of [b, c])
    await expect(p.getByText("The usual suspects")).toBeVisible();
  expect(errors).toEqual([]);
  await ca.close();
  await cb.close();
  await cc.close();
});
test("390px layout, keyboard onboarding and join errors", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Enable sound" }).click();
  await page.getByRole("button", { name: "Mute sound" }).click();
  await expect(
    page.getByRole("heading", { name: "BIG VAULTS. BIGGER BETRAYALS." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/mobile-landing.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(
    page.getByRole("heading", { name: "Get in. Get rich." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await joinError();
  async function joinError() {
    await page.getByRole("button", { name: "Join with code" }).click();
    await page.getByLabel("AGENT NAME").fill("Mobile");
    await page.getByLabel("ROOM CODE").fill("AAAAAA");
    await page.getByRole("button", { name: "Join crew", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Room not found");
  }
  await context.close();
});

test("a replacement tab preserves the shared recovery token for its next refresh", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  await first.goto("/");
  await first.getByRole("button", { name: "Create a crew" }).click();
  await first.getByLabel("AGENT NAME").fill("TabAgent");
  await first.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(first.locator(".room-code")).toBeVisible();
  const code = await first.locator(".room-code").innerText();
  const second = await context.newPage();
  await second.goto(`/?room=${code}`);
  await expect(second.getByText("The usual suspects")).toBeVisible();
  await expect(first.getByRole("alert")).toContainText("another tab");
  await second.reload();
  await expect(second.getByText("The usual suspects")).toBeVisible();
  await expect(second.locator(".roster .player")).toHaveCount(1);
  await expect(second.getByRole("dialog")).toHaveCount(0);
  await context.close();
});

test("production serves compiled SPA routes, health and Socket.IO on the same origin", async ({
  request,
}) => {
  test.skip(
    process.env.E2E_PRODUCTION !== "1",
    "Checks compiled production service only.",
  );
  const health = await request.get("/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true });
  expect(health.headers()["cache-control"]).toBe("no-store");
  for (const route of ["/", "/?room=ABC234", "/heist/ABC234"]) {
    const response = await request.get(route, {
      headers: { Accept: "text/html" },
    });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("/assets/index-");
    expect(response.headers()["content-security-policy"]).toContain(
      "script-src 'self';",
    );
  }
  expect((await request.get("/assets/does-not-exist.js")).status()).toBe(404);
  expect(
    (
      await request.get("/unknown-api", {
        headers: { Accept: "application/json" },
      })
    ).status(),
  ).toBe(404);
  const handshake = "/socket.io/?EIO=4&transport=polling";
  const allowed = await request.get(handshake, {
    headers: { Origin: "http://localhost:3000" },
  });
  expect(allowed.status()).toBe(200);
  expect(await allowed.text()).toContain('"upgrades":["websocket"]');
  expect(
    (
      await request.get(handshake, {
        headers: { Origin: "https://evil.example.com" },
      })
    ).status(),
  ).toBe(403);
});
