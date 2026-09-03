import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

function buildTextPdf(lines) {
  const escapePdfText = (value) => String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = ["BT", "/F1 12 Tf", "72 720 Td", ...lines.flatMap((line, index) => [index ? "0 -20 Td" : "", `(${escapePdfText(line)}) Tj`]), "ET"].filter(Boolean).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "binary");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

test("PDF parser runs in the browser with the bundled local worker", async ({ page }) => {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
      if (requestPath === "/blank.html") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<!doctype html><title>PDF parser test</title>");
        return;
      }
      const targetPath = path.resolve(projectRoot, `.${requestPath}`);
      if (!targetPath.startsWith(projectRoot)) return response.writeHead(403).end();
      const content = await readFile(targetPath);
      const contentType = /\.(?:js|mjs)$/.test(targetPath) ? "text/javascript" : "text/plain";
      response.writeHead(200, { "content-type": `${contentType}; charset=utf-8` }).end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  try {
    const port = server.address().port;
    await page.goto(`http://127.0.0.1:${port}/blank.html`);
    const result = await page.evaluate(async ({ port, pdfBytes }) => {
      const { parseResumeFile } = await import(`http://127.0.0.1:${port}/src/resume-importer.js`);
      const pdfjsLib = await import(`http://127.0.0.1:${port}/src/vendor/pdf.min.mjs`);
      const file = new File([Uint8Array.from(pdfBytes)], "browser-test.pdf", { type: "application/pdf" });
      const draft = await parseResumeFile(file);
      return {
        email: draft.profileV2.sections.basic.values.邮箱,
        project: draft.profileV2.sections.project.items[0]?.values?.项目名称,
        workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc
      };
    }, { port, pdfBytes: [...buildTextPdf(["resume@example.com", "Projects", "Blink Helmet | 2026.07", "Project description"]) ] });

    expect(result.email).toBe("resume@example.com");
    expect(result.project).toBe("Blink Helmet");
    expect(result.workerSrc).toMatch(/\/src\/vendor\/pdf\.worker\.mjs$/);
    expect(requests.some((url) => /\/src\/vendor\/pdf\.worker\.mjs$/.test(url))).toBeTruthy();
    expect(requests.every((url) => url.startsWith(`http://127.0.0.1:${port}/`))).toBeTruthy();
  } finally {
    server.close();
    server.closeAllConnections?.();
  }
});
