# ResumeFill Local

[中文 README](README.md)

ResumeFill Local is a privacy-first browser extension for filling Chinese job application forms. It keeps resume data in the current browser and uses deterministic local matching for Feishu, Moka, Beisen and generic form pages.

## Privacy boundary

- No account, cloud sync, cloud AI, telemetry, update checks or external API requests.
- The manifest requests only `activeTab`, `scripting` and `storage`.
- Page code is injected only after you click the extension and start an action on the current page.
- The extension never reads or uploads attachments, never fills file or password controls, and never clicks a final submit button.
- Browser extension storage is not operating-system encryption. Exported JSON backups are also unencrypted.

## Features

- Multiple local resume profiles with create, switch, rename and delete actions.
- Local resume import: choose a text PDF, DOCX or Markdown file, review the mapped fields, then create a new profile.
- Structured fields for contact details, education, class/major rank, work, projects, awards, certificates and custom data.
- Local matching and filling for text controls, native selects, radio buttons, checkboxes, dates and common component controls.
- Green marks for filled fields and orange marks for fields that need review or manual copying.
- JSON backup and restore for the complete local profile library, including custom and unknown fields.

Education records accept imported GPA values. When the source has no GPA, the field stays blank; values are never calculated or invented. Rank values are copied only when present in the profile.

Resume parsing runs entirely in the browser with bundled PDF.js and Mammoth resources. Scanned PDFs, legacy `.doc` files and image-only text require conversion before import; verify contacts, dates and experience ownership in the preview.

## Installation

1. Download or clone this repository.
2. Open `edge://extensions/` or `chrome://extensions/`.
3. Enable Developer mode and choose **Load unpacked**.
4. Select the directory containing `manifest.json`.
5. Open the extension settings and save your local profiles.

No Node.js installation or build step is required to run the extension. To run the local regression suite, use Node.js 20 or newer and execute:

```bash
npm ci
npm run test:install
npm test
```

The tests use only synthetic pages and Playwright Chromium. On Linux, use `npx playwright install --with-deps chromium` when system dependencies are missing.

## License and source

This project is based on the fixed MIT-licensed revision of [OpenJobAutofill](https://github.com/Br1an67/OpenJobAutofill). See [NOTICE.md](NOTICE.md) for the exact revision and modification boundary. The original `LICENSE` file is retained.
