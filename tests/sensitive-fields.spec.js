import { test, expect } from "@playwright/test";
import { installContentScript, profileFor, runAutofill } from "./support/extension-fixture.js";

function singleFieldHtml({ label, type = "text", attributes = "" }) {
  return `<!doctype html>
    <html><head><title>ResumeFill sensitive fixture</title></head>
    <body>
      <main>
        <h2>基本信息</h2>
        <div class="field">
          <label for="target">${label}</label>
          <input id="target" type="${type}" ${attributes}>
        </div>
      </main>
    </body></html>`;
}

async function assertNoWrite(page) {
  await page.evaluate(() => {
    window.__resumeFillWriteCount = 0;
    const target = document.querySelector("#target");
    target?.addEventListener("input", () => { window.__resumeFillWriteCount += 1; });
    target?.addEventListener("change", () => { window.__resumeFillWriteCount += 1; });
  });
  const result = await runAutofill(page);
  expect(await page.evaluate(() => window.__resumeFillWriteCount)).toBe(0);
  return result;
}

test("password controls are never scanned or filled", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("密码", "secret"),
    html: singleFieldHtml({ label: "密码", type: "password" })
  });

  const { response, debug } = await assertNoWrite(page);

  expect(response.data.reason).toBe("no candidates");
  expect(debug.data.scan.fields).toHaveLength(0);
  expect(await page.locator("#target").inputValue()).toBe("");
});

test("one-time-code autocomplete controls are blocked", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("验证码", "123456"),
    html: singleFieldHtml({ label: "验证码", attributes: "autocomplete=\"one-time-code\"" })
  });

  const { response, debug } = await assertNoWrite(page);
  const field = debug.data.scan.fields[0];

  expect(response.data.reason).toBe("no candidates");
  expect(field.sensitive).toBe(true);
  expect(field.canFill).toBe(false);
  expect(await page.locator("#target").inputValue()).toBe("");
});

test("短信验证码 text inputs are blocked by their label", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("短信验证码", "123456"),
    html: singleFieldHtml({ label: "短信验证码" })
  });

  const { response, debug } = await assertNoWrite(page);
  const field = debug.data.scan.fields[0];

  expect(response.data.reason).toBe("no candidates");
  expect(field.sensitive).toBe(true);
  expect(field.canFill).toBe(false);
  expect(await page.locator("#target").inputValue()).toBe("");
});

test("file controls are never scanned or filled", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("附件", "resume.pdf"),
    html: singleFieldHtml({ label: "附件", type: "file" })
  });

  const { response, debug } = await assertNoWrite(page);

  expect(response.data.reason).toBe("no candidates");
  expect(debug.data.scan.fields).toHaveLength(0);
  expect(await page.locator("#target").getAttribute("data-ojaf-mark")).toBeNull();
});

test("GPA controls are excluded from automatic matching and filling", async ({ page }) => {
  await installContentScript(page, {
    profile: profileFor("GPA", "3.9"),
    html: singleFieldHtml({ label: "GPA" })
  });

  const { response, debug } = await assertNoWrite(page);
  const field = debug.data.scan.fields[0];

  expect(response.data.reason).toBe("no candidates");
  expect(field.gpaDisabled).toBe(true);
  expect(field.canFill).toBe(false);
  expect(await page.locator("#target").inputValue()).toBe("");
});
