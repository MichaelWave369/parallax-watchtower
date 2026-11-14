import { test, expect } from "@playwright/test";

const local = "http://127.0.0.1:4173";

test("boots a visible dashboard and keeps it visible when every external source is unavailable", async ({ page }) => {
  // Reproduce the failure conditions users actually encounter: offline basemap
  // and blocked source APIs, with the production GitHub Pages base path.
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(local)) return route.continue();
    return route.abort("failed");
  });
  await page.goto("/parallax-watchtower/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /WATCHTOWER LIVE/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Controls/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lite", exact: true })).toBeVisible();
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible();
  // Vector map is an optional lazy-loaded dependency. Even if WebGL and
  // OpenFreeMap fail, WATCHTOWER must automatically recover to Lite Atlas.
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible({ timeout: 24000 });
  await expect(page.getByRole("heading", { name: /WATCHTOWER LIVE/i })).toBeVisible();
});

test("switching between Lite Atlas and Globe never removes the dashboard shell", async ({ page }) => {
  await page.route("**/*", route =>
    route.request().url().startsWith(local) ? route.continue() : route.abort("failed")
  );
  await page.goto("/parallax-watchtower/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /WATCHTOWER LIVE/i })).toBeVisible();
  await page.getByRole("button", { name: "Globe", exact: true }).click();
  await expect(page.locator('canvas[aria-label*="Interactive orthographic globe"]')).toBeVisible();
  await page.getByRole("button", { name: "Lite", exact: true }).click();
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: /WATCHTOWER LIVE/i })).toBeVisible();
});

test("Explore opens 50 curated external resources without breaking Live signals", async ({ page }) => {
  await page.route("**/*", route =>
    route.request().url().startsWith(local) ? route.continue() : route.abort("failed")
  );
  await page.goto("/parallax-watchtower/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Explore · 50 sources/ }).click();
  await expect(page.getByRole("heading", { name: /Explore the Knowledge Atlas/i })).toBeVisible();
  await expect(page.locator(".explore-card")).toHaveCount(50);
  await page.getByLabel("Search the catalog").fill("submarine");
  await expect(page.locator(".explore-card")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Open Submarine Cable Map in a new tab/i })).toHaveAttribute("rel", /noopener noreferrer/);
  await page.getByLabel("Search the catalog").fill("");
  await page.getByRole("button", { name: "Space & Sky" }).click();
  await expect(page.locator(".explore-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Live signals", exact: true }).click();
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible();
});

test("Incident Room documents ground stop with receipts, uncertainty and discovery trails", async ({ page }) => {
  await page.route("**/*", route =>
    route.request().url().startsWith(local) ? route.continue() : route.abort("failed")
  );
  await page.goto("/parallax-watchtower/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Incident Room", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FAA nationwide ground stop" })).toBeVisible();
  await expect(page.locator(".incident-event")).toHaveCount(5);
  await expect(page.getByText("Preliminary account", {exact:true})).toBeVisible();
  await page.getByRole("button", {name:"Evidence sources",exact:true}).click();
  await expect(page.locator(".incident-source")).toHaveCount(2);
  await expect(page.getByRole("link", {name:/Read source statement/i}).first()).toHaveAttribute("rel", /noopener noreferrer/);
  await page.getByRole("button", {name:"Read evidence method"}).click();
  await expect(page.getByText("Receipts over conclusions")).toBeVisible();
  await expect(page.getByText(/not evidence about this specific outage/i)).toBeVisible();
  await page.getByRole("button", {name:"Live signals",exact:true}).click();
  await expect(page.locator('canvas[aria-label*="Lite Atlas"]')).toBeVisible();
});
