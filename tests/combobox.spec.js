import { test, expect } from "@playwright/test";
import {
  comboboxFixtureHtml as fixtureHtml,
  installContentScript,
  profileFor,
  runAutofill
} from "./support/extension-fixture.js";

test("container combobox must be orange when no option is confirmed", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("工作城市", "上海"),
    html: fixtureHtml({ options: ["北京"] })
  });

  const { response, debug } = await runAutofill(page);

  expect(response.ok).toBe(true);
  expect(response.data.filled).toBe(0);
  expect(response.data.failed).toBe(1);
  expect(await page.locator("[role=combobox]").getAttribute("data-ojaf-mark")).toBe("uncertain");
  expect(debug.data.results).toHaveLength(1);
  expect(debug.data.results[0].ok).toBe(false);
});

test("container combobox must click the matching option and process one field", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("工作城市", "上海"),
    html: fixtureHtml()
  });

  const { response, debug } = await runAutofill(page);

  expect(response.data.filled).toBe(1);
  expect(response.data.failed).toBe(0);
  expect(debug.data.scan.fieldCount).toBe(1);
  expect(debug.data.results).toHaveLength(1);
  expect(await page.locator("#city-input").inputValue()).toBe("上海");
  expect(await page.locator("[role=combobox]").getAttribute("data-ojaf-mark")).toBe("filled");
});

test("input combobox reads its own value after selecting an option", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("工作城市", "上海"),
    html: fixtureHtml({ ownRole: true, markValue: false })
  });

  const { response } = await runAutofill(page);

  expect(response.data.filled).toBe(1);
  expect(response.data.failed).toBe(0);
  expect(await page.locator("#city-input").inputValue()).toBe("上海");
  expect(await page.locator("#city-input").getAttribute("data-ojaf-mark")).toBe("filled");
});

test("matching combobox text without a confirmed option cannot bypass filling", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("工作城市", "上海"),
    html: fixtureHtml({ initialValue: "上海", options: ["北京"], markValue: false })
  });

  const { response } = await runAutofill(page);

  expect(response.data.filled).toBe(0);
  expect(response.data.failed).toBe(1);
  expect(await page.locator("[role=combobox]").getAttribute("data-ojaf-mark")).toBe("uncertain");
});

test("date combobox still requires a confirmed option", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("出生日期", "2024-01-02"),
    html: fixtureHtml({ label: "出生日期", options: ["2024-01-01"] })
  });

  const { response } = await runAutofill(page);

  expect(response.data.filled).toBe(0);
  expect(response.data.failed).toBe(1);
  expect(await page.locator("[role=combobox]").getAttribute("data-ojaf-mark")).toBe("uncertain");
});

test("aria-label text alone is not a confirmed combobox selection", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("工作城市", "上海"),
    html: fixtureHtml({ ariaLabel: "上海", options: ["北京"], markValue: false })
  });

  const { response } = await runAutofill(page);

  expect(response.data.filled).toBe(0);
  expect(response.data.failed).toBe(1);
  expect(await page.locator("[role=combobox]").getAttribute("data-ojaf-mark")).toBe("uncertain");
});
