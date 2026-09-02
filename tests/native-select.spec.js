import { test, expect } from "@playwright/test";
import { installContentScript, profileFor, runAutofill } from "./support/extension-fixture.js";

function selectFixtureHtml({ initialValue = "" } = {}) {
  return `<!doctype html>
    <html><head><title>ResumeFill select fixture</title></head>
    <body>
      <main>
        <h2>基本信息</h2>
        <div class="field">
          <label for="city-select">工作城市</label>
          <select id="city-select">
            <option value="">请选择</option>
            <option value="shanghai">上海</option>
            <option value="beijing">北京</option>
          </select>
        </div>
      </main>
      <script>
        const select = document.querySelector('#city-select');
        select.value = '${initialValue}';
      </script>
    </body></html>`;
}

async function trackSelectWrites(page) {
  await page.evaluate(() => {
    window.__selectWriteCount = 0;
    const select = document.querySelector("#city-select");
    select?.addEventListener("input", () => { window.__selectWriteCount += 1; });
    select?.addEventListener("change", () => { window.__selectWriteCount += 1; });
  });
}

test("matching native select option is selected and marked green", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("工作城市", "上海"),
    html: selectFixtureHtml()
  });

  const { response } = await runAutofill(page);

  expect(response.data.filled).toBe(1);
  expect(response.data.failed).toBe(0);
  expect(await page.locator("#city-select").inputValue()).toBe("shanghai");
  expect(await page.locator("#city-select").getAttribute("data-ojaf-mark")).toBe("filled");
});

test("unmatched native select option keeps its value and is marked orange", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("工作城市", "广州"),
    html: selectFixtureHtml()
  });
  await trackSelectWrites(page);

  const { response } = await runAutofill(page);

  expect(response.data.filled).toBe(0);
  expect(response.data.failed).toBe(1);
  expect(await page.locator("#city-select").inputValue()).toBe("");
  expect(await page.evaluate(() => window.__selectWriteCount)).toBe(0);
  expect(await page.locator("#city-select").getAttribute("data-ojaf-mark")).toBe("uncertain");
});
