import { test, expect } from "@playwright/test";
import { installContentScript, profileFor, runAutofill } from "./support/extension-fixture.js";

function antSelectedFixtureHtml() {
  return `<!doctype html>
    <html><head><title>ResumeFill Ant Design fixture</title></head>
    <body>
      <main>
        <h2>基本信息</h2>
        <div class="field">
          <label for="ant-city">工作城市</label>
          <div id="ant-city" role="combobox" class="ant-select ant-select-single">
            <div class="ant-select-selector">
              <span class="ant-select-selection-item">上海</span>
            </div>
          </div>
        </div>
      </main>
      <script>
        window.__antOpenCount = 0;
        document.querySelector('#ant-city').addEventListener('click', () => {
          window.__antOpenCount += 1;
        });
      </script>
    </body></html>`;
}

test("Ant Design selected tag is trusted without reopening the combobox", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("工作城市", "上海"),
    html: antSelectedFixtureHtml()
  });

  const { response } = await runAutofill(page);

  expect(response.data.filled).toBe(1);
  expect(response.data.failed).toBe(0);
  expect(await page.evaluate(() => window.__antOpenCount)).toBe(0);
  expect(await page.locator("#ant-city").getAttribute("data-ojaf-mark")).toBe("filled");
});
