import { expect, test, type Page } from "@playwright/test";
import { FIXTURES, solidPng } from "./fixtures";

const SHOTS = process.env.E2E_SCREENSHOT_DIR;
const satellite = solidPng(52, 74, 62);
const mangrove = solidPng(19, 163, 107, 200);

async function mockBackend(page: Page, configured = true) {
  // External basemap/geocoder hosts are replaced so tests run offline.
  await page.route(/tiles\.maps\.eox\.at|openfreemap\.org|server\.arcgisonline/, (r) =>
    r.request().url().endsWith(".pbf") ? r.fulfill({ status: 404 }) : r.fulfill({ body: satellite, contentType: "image/png" }),
  );
  await page.route("**/mock-ee-tiles/**", (r) => r.fulfill({ body: mangrove, contentType: "image/png" }));
  await page.route("**/api/health", (r) =>
    r.fulfill({
      json: configured
        ? { engine: "gee", configured: true, reason: null, soilCarbon: false, limits: { maxAreaHa: 250000, maxVertices: 20000, analysesPerHour: 30 } }
        : { engine: "gee", configured: false, reason: "GEE_SERVICE_ACCOUNT_KEY is not set", soilCarbon: false, limits: { maxAreaHa: 250000, maxVertices: 20000, analysesPerHour: 30 } },
    }),
  );
  await page.route("**/api/layers/**", (r) =>
    r.fulfill({ json: { tiles: [`${new URL(r.request().url()).origin}/mock-ee-tiles/{z}/{x}/{y}.png`], minzoom: 0, maxzoom: 18, attribution: "test" } }),
  );
  await page.route("**/api/analyze/*", async (r) => {
    const m = r.request().url().split("/").pop()!;
    await new Promise((res) => setTimeout(res, 300));
    r.fulfill({ json: FIXTURES[m] });
  });
}

test("loads the atlas with the default layer and URL state", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  await expect(page.getByText("Analyse any coastline")).toBeVisible();
  await expect(page).toHaveURL(/layers=cgmd-extent~2023/);
  await page.getByRole("tab", { name: /Map layers/ }).click();
  await expect(page.getByText("Mangrove extent (annual, 1984–2023)")).toBeVisible();
  await page.getByLabel("Mangrove extent (annual, 1984–2023) year").fill("10");
  await expect(page).toHaveURL(/cgmd-extent~1994/);
  await page.getByRole("checkbox", { name: "Canopy height 2015 (12 m)" }).check();
  await expect(page).toHaveURL(/tandemx-height/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/01-layers.png` });
});

test("draws a polygon and renders every analysis card", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  // Wait until MapLibre has finished loading its style before drawing.
  await page.waitForFunction(() => document.querySelector(".maplibregl-canvas") && !document.querySelector(".maplibregl-map:not(.maplibregl-loaded)") , null, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "✎ Polygon" }).click();
  await page.waitForTimeout(300);
  const map = page.locator("main canvas").first();
  const box = (await map.boundingBox())!;
  const pts = [
    [0.35, 0.35],
    [0.65, 0.33],
    [0.68, 0.62],
    [0.4, 0.66],
  ];
  // Move then click with pauses, as a person would; terra-draw tracks pointer movement between clicks.
  for (const [x, y] of [...pts, pts[0]]) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 4 });
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    await page.waitForTimeout(250);
  }

  await expect(page.getByRole("heading", { name: "Mangrove extent" })).toBeVisible();
  await expect(page.getByText("Dataset agreement")).toBeVisible();
  await expect(page.getByText("Gain 1996–2020")).toBeVisible();
  await expect(page.getByText("Latest clear month")).toBeVisible();
  await expect(page.getByText("Screening carbon stock")).toBeVisible();
  await expect(page.getByText("Tidal flats", { exact: true })).toBeVisible();
  // carbon fraction switch recomputes on the client
  await page.getByLabel("Carbon fraction").selectOption("0.451");
  await expect(page.getByText(/AGB × 0.451/)).toBeVisible();
  // table view
  await page.locator("#extent").getByRole("button", { name: "Table" }).click();
  await expect(page.locator("#extent table")).toBeVisible();
  await page.locator("#extent").getByRole("button", { name: "Chart" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  expect((await download).suggestedFilename()).toBe("drawn-area-mangrove-atlas.csv");
  if (SHOTS) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/02-analysis.png` });
    await page.locator("aside .overflow-y-auto").evaluate((el) => el.scrollTo(0, 900));
    await page.screenshot({ path: `${SHOTS}/03-analysis-lower.png` });
    await page.locator("aside .overflow-y-auto").evaluate((el) => el.scrollTo(0, 99999));
    await page.screenshot({ path: `${SHOTS}/03b-analysis-bottom.png` });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator("aside .overflow-y-auto").evaluate((el) => el.scrollTo(0, 0));
    await page.screenshot({ path: `${SHOTS}/05-dark.png` });
  }
});

test("uploads a GeoJSON boundary", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  const geo = JSON.stringify({ type: "Polygon", coordinates: [[[88.75, 21.95], [88.88, 21.95], [88.88, 22.05], [88.75, 22.05], [88.75, 21.95]]] });
  await page.locator('input[type="file"]').setInputFiles({ name: "sundarbans-site.geojson", mimeType: "application/json", buffer: Buffer.from(geo) });
  await expect(page.getByLabel("Area name")).toHaveValue("sundarbans-site");
  await expect(page.getByRole("heading", { name: "Height, biomass & carbon" })).toBeVisible();
});

test("explains when Earth Engine is not configured", async ({ page }) => {
  await mockBackend(page, false);
  await page.goto("/");
  await expect(page.getByText("Earth Engine is not connected on this deployment.")).toBeVisible();
  await expect(page.getByRole("button", { name: "✎ Polygon" })).toBeDisabled();
});

test("methods page lists datasets and licences", async ({ page }) => {
  await page.goto("/methods");
  await expect(page.getByRole("heading", { name: "Methods & data", level: 1 })).toBeVisible();
  await expect(page.locator("#cgmd")).toContainText("CC BY 4.0");
  await expect(page.locator("#tandemx-height")).toContainText("GLOBAL_MANGROVE_HT_TANDEMX");
});

test("mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await mockBackend(page);
  await page.goto("/");
  await expect(page.getByText("Analyse any coastline")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/04-mobile.png` });
});
