import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const contentScriptPath = path.join(projectRoot, "src", "content.js");

export function profileFor(label, value) {
  return {
    sections: {
      basic: {
        title: "基本信息",
        values: { [label]: value }
      }
    }
  };
}

export function comboboxFixtureHtml({
  label = "工作城市",
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
    <html><head><title>ResumeFill fixture</title></head>
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

export async function installContentScript(page, { profile, html }) {
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
          if (message?.type === "OJAF_GET_SETTINGS") {
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
        resolve({ ok: false, error: "content listener unavailable" });
        return;
      }
      listener(message, {}, resolve);
    });
  }, { profile });
  await page.addScriptTag({ path: contentScriptPath });
}

export async function sendContentMessage(page, message) {
  return page.evaluate((currentMessage) => globalThis.__resumeFillSend(currentMessage), message);
}

export async function runAutofill(page) {
  const response = await sendContentMessage(page, { type: "OJAF_START_AUTOFILL" });
  const debug = await sendContentMessage(page, { type: "OJAF_GET_DEBUG_SNAPSHOT" });
  return { response, debug };
}
