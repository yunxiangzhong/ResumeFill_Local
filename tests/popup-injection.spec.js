import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const popupHtmlPath = path.join(projectRoot, "src", "popup.html");
const popupScriptPath = path.join(projectRoot, "src", "popup.js");

async function installPopup(page, mode) {
  await page.setContent(await fs.readFile(popupHtmlPath, "utf8"));
  await page.evaluate((currentMode) => {
    const state = {
      mode: currentMode,
      injections: 0,
      messages: [],
      startAttempts: 0
    };
    globalThis.__popupState = state;
    globalThis.chrome = {
      runtime: {
        lastError: null,
        openOptionsPage() {}
      },
      tabs: {
        query(_query, callback) {
          callback([{ id: 17 }]);
        },
        sendMessage(_tabId, message, callback) {
          state.messages.push(message.type);
          const isRuntimeState = message.type === "OJAF_GET_RUNTIME_STATE";
          const shouldFail = currentMode === "noReceiver" ||
            (currentMode === "startInject" && (isRuntimeState || state.startAttempts === 0));
          if (message.type === "OJAF_START_AUTOFILL") {
            state.startAttempts += 1;
          }
          if (shouldFail) {
            globalThis.chrome.runtime.lastError = {
              message: "Could not establish connection. Receiving end does not exist."
            };
            callback(undefined);
            globalThis.chrome.runtime.lastError = null;
            return;
          }
          callback({
            ok: true,
            data: message.type === "OJAF_START_AUTOFILL"
              ? { ok: true, filled: 1, failed: 0, skipped: 0, pending: 0 }
              : { autofillInProgress: false, autofillSummary: null }
          });
        }
      },
      scripting: {
        executeScript(_details, callback) {
          state.injections += 1;
          callback();
        }
      }
    };
  }, mode);
  await page.addScriptTag({ path: popupScriptPath });
}

async function waitForInitialState(page) {
  await expect.poll(() => page.evaluate(() => window.__popupState.messages.length)).toBeGreaterThan(0);
}

test("opening popup with an active content script does not inject again", async ({ page }) => {
  await installPopup(page, "success");
  await waitForInitialState(page);

  expect(await page.evaluate(() => window.__popupState.messages)).toEqual(["OJAF_GET_RUNTIME_STATE"]);
  expect(await page.evaluate(() => window.__popupState.injections)).toBe(0);
});

test("a missing receiver during runtime-state lookup does not inject", async ({ page }) => {
  await installPopup(page, "noReceiver");
  await waitForInitialState(page);

  expect(await page.evaluate(() => window.__popupState.messages)).toEqual(["OJAF_GET_RUNTIME_STATE"]);
  expect(await page.evaluate(() => window.__popupState.injections)).toBe(0);
});

test("starting autofill injects once and retries the page message", async ({ page }) => {
  await installPopup(page, "startInject");
  await waitForInitialState(page);
  await page.locator("#startAutofillBtn").click();

  await expect.poll(() => page.evaluate(() => window.__popupState.injections)).toBe(1);
  expect(await page.evaluate(() => window.__popupState.startAttempts)).toBe(2);
  expect(await page.evaluate(() => window.__popupState.messages)).toEqual([
    "OJAF_GET_RUNTIME_STATE",
    "OJAF_START_AUTOFILL",
    "OJAF_START_AUTOFILL",
    "OJAF_GET_RUNTIME_STATE"
  ]);
});
