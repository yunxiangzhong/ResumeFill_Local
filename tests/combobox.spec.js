import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentScriptPath = path.join(projectRoot, "src", "content.js");

function profileFor(label, value) {
  return {
    sections: {
      basic: {
        title: "基本信息",
        values: { [label]: value }
      }
    }
  };
}

function fixtureHtml({
  label = "工作城市",
  value = "",
  initialValue = "",
  options = ["上海", "北京"],
  ownRole = false,
  ariaLabel = "",
  markValue = true
} = {}) {
  const optionMarkup = options
    .map((option) => `<button type="button" role="option" data-value="${option}">${option}</button>`)
    .join("");
  const inputAttributes = [
    `id="city-input"`,
    `value="${initialValue}"`,
    `placeholder="请选择${label}"`,
    ownRole ? `role="combobox"` : "",
    ariaLabel ? `aria-label="${ariaLabel}"` : ""
  ].filter(Boolean).join(" ");
  const control = ownRole
    ? `<input ${inputAttributes}>`
    : `<div id="city-combobox" role="combobox" aria-controls="city-options">
        <input ${inputAttributes}>
      </div>`;

  return `<!doctype html>
    <html><head><title>ResumeFill combobox fixture</title></head>
    <body>
      <main>
        <h2>基本信息</h2>
        <div class="field">
          <label for="city-input">${label}</label>
          ${control}
          <div id="city-options" role="listbox" hidden>${optionMarkup}</div>
        </div>
      </main>
      <script>
        const input = document.querySelector('#city-input');
        const combobox = document.querySelector('[role="combobox"]');
        const list = document.querySelector('#city-options');
        combobox.addEventListener('click', () => list.hidden = false);
        input.addEventListener('input', () => list.hidden = false);
        list.addEventListener('click', (event) => {
          const option = event.target.closest('[role="option"]');
          if (!option) return;
          input.value = option.dataset.value || option.textContent.trim();
          ${markValue ? "combobox.dataset.value = input.value;" : ""}
          input.dispatchEvent(new Event('input', { bubbles: true }));
          list.hidden = true;
        });
      </script>
    </body></html>`;
}

async function installContentScript(page, { profile, html }) {
  await page.setContent(html);
  await page.evaluate(({ profile }) => {
    const listeners = new Set();
    globalThis.chrome = {
      storage: {
        onChanged: {
          addListener() {},
          removeListener() {}
        }
      },
      runtime: {
        lastError: null,
        onMessage: {
          addListener(listener) {
            listeners.add(listener);
          },
          removeListener(listener) {
            listeners.delete(listener);
          }
        },
        sendMessage(message, callback) {
          if (message?.type === 'OJAF_GET_SETTINGS') {
            callback({ ok: true, data: { profileV2: profile } });
            return;
          }
          callback({ ok: true, data: {} });
        }
      }
    };
    globalThis.__resumeFillSend = (message) => new Promise((resolve) => {
      const listener = Array.from(listeners).at(-1);
      if (!listener) {
        resolve({ ok: false, error: 'content listener unavailable' });
        return;
      }
      listener(message, {}, resolve);
    });
  }, { profile });
  await page.addScriptTag({ path: contentScriptPath });
}

async function runAutofill(page) {
  const response = await page.evaluate(() => globalThis.__resumeFillSend({
    type: "OJAF_START_AUTOFILL"
  }));
  const debug = await page.evaluate(() => globalThis.__resumeFillSend({
    type: "OJAF_GET_DEBUG_SNAPSHOT"
  }));
  return { response, debug };
}

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
    html: fixtureHtml({ ownRole: true })
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
