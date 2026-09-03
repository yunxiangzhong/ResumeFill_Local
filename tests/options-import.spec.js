import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

test("settings page previews a local Markdown resume and creates a new profile", async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(() => {
    const emptyProfile = { schemaVersion: 2, updatedAt: "", sections: {}, customSections: [] };
    globalThis.__resumeFillMock = {
      revision: 0,
      profiles: [{ id: "profile-1", name: "当前简历", valueCount: 0 }],
      activeProfileId: "profile-1",
      profileV2: emptyProfile
    };
    globalThis.chrome = {
      storage: { onChanged: { addListener() {}, removeListener() {} } },
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          const state = globalThis.__resumeFillMock;
          if (message.type === "OJAF_CREATE_PROFILE") {
            state.revision += 1;
            const id = `profile-${state.revision + 1}`;
            state.profiles.push({ id, name: message.payload.name, valueCount: 3 });
            state.activeProfileId = id;
            state.profileV2 = message.payload.profileV2;
          } else if (message.type === "OJAF_SAVE_SETTINGS") {
            state.revision += 1;
            state.profileV2 = message.payload.profileV2;
          }
          callback({
            ok: true,
            data: {
              profileV2: state.profileV2,
              profiles: state.profiles,
              activeProfileId: state.activeProfileId,
              revision: state.revision
            }
          });
        }
      }
    };
  });
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
      const targetPath = path.resolve(projectRoot, `.${requestPath}`);
      if (!targetPath.startsWith(projectRoot)) {
        response.writeHead(403).end();
        return;
      }
      const content = await readFile(targetPath);
      const contentType = targetPath.endsWith(".html") ? "text/html" : targetPath.endsWith(".js") || targetPath.endsWith(".mjs") ? "text/javascript" : "text/css";
      response.writeHead(200, { "content-type": `${contentType}; charset=utf-8` }).end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    await page.goto(`http://127.0.0.1:${port}/src/options.html`);
    await expect(page.evaluate(() => typeof globalThis.mammoth?.convertToHtml)).resolves.toBe("function");
    await page.locator("#parseResume").click();
    await page.locator("#resumeFileInput").setInputFiles({
      name: "钟运翔-导入.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(`# 钟运翔

19914770930 | yunxiangzhong801@gmail.com

## 教育经历
### 湖南大学
物联网工程 · 本科
2023 – 2027

## 项目经历
### 脉盔
队长 ｜ 2026.07
    项目简介：智能头盔端到端 IoT 闭环。`)
    });
    await page.locator("#resumeFileInput").dispatchEvent("change");

    if (pageErrors.length || consoleErrors.length) throw new Error(`options page errors: ${[...pageErrors, ...consoleErrors].join(" | ")}`);
    await expect(page.locator("#resumeImportDialog")).toBeVisible();
    await expect(page.locator("#resumeImportStatus")).toContainText("解析完成");
    await expect(page.locator("[data-import-label='邮箱']")).toHaveValue("yunxiangzhong801@gmail.com");
    await expect(page.locator("[data-import-label='项目名称']")).toHaveValue("脉盔");
    await expect(page.locator("[data-import-label='职位']")).toHaveValue("队长");

    await page.locator("[data-import-profile-name]").fill("嵌入式方向简历");
    await page.locator("#confirmResumeImport").click();
    await expect(page.locator("#resumeImportDialog")).toBeHidden();
    await expect(page.locator("#profileSelect")).toContainText("嵌入式方向简历");
    await expect(page.evaluate(() => globalThis.__resumeFillMock.profileV2.sections.project.items[0].values.项目名称)).resolves.toBe("脉盔");
  } finally {
    server.close();
    server.closeAllConnections?.();
  }
});
