import { test, expect } from "@playwright/test";
import { installContentScript, runAutofill } from "./support/extension-fixture.js";

const FEISHU_EDIT_URL = "https://arashivision.jobs.feishu.cn/campus/resume/edit";
const FEISHU_VIEW_URL = "https://arashivision.jobs.feishu.cn/campus/resume/view";
const FEISHU_LOGIN_URL = "https://arashivision.jobs.feishu.cn/campus/login";

function profile() {
  return {
    sections: {
      basic: { title: "基本信息", values: { 姓名: "钟运翔" } },
      education: {
        title: "教育经历",
        kind: "repeat",
        items: [
          { title: "教育经历 1", values: { 学校名称: "湖南大学", 学历: "本科", 专业: "物联网工程" } },
          { title: "教育经历 2", values: { 学校名称: "示例大学", 学历: "硕士", 专业: "软件工程" } }
        ]
      },
      project: {
        title: "项目经历",
        kind: "repeat",
        items: [{
          title: "项目经历 1",
          values: {
            项目名称: "边缘智能项目",
            职位: "核心开发",
            项目内容: "项目简介原文",
            本人职责: "职责原文",
            项目成果: "成果原文",
            项目链接: "https://example.test/project"
          }
        }]
      }
    }
  };
}

function specialProfile() {
  return {
    sections: {
      basic: { title: "基本信息", values: { "国籍（国家或地区）": "中国" } },
      education: {
        title: "教育经历",
        kind: "repeat",
        items: [{
          title: "教育经历 1",
          values: {
            学校名称: "湖南大学",
            学历: "本科",
            专业: "物联网工程",
            开始时间: "2021-09",
            结束时间: "2025-06"
          }
        }]
      },
      self: { title: "自我评价", values: { 自我评价: "自我评价原文" } },
      other: { title: "其他信息", values: { GitHub: "https://github.com/yunxiangzhong", 个人主页: "https://example.com/home" } }
    }
  };
}

function field(cy, label, control) {
  return `<div class="atsx-row atsx-form-item" data-cy="${cy}">
    <div class="atsx-form-item-label">${label}</div><div class="atsx-form-item-control">${control}</div>
  </div>`;
}

function combo(cy, value = "") {
  return `<div data-cy="${cy}" role="combobox" class="atsx-select-selection" data-selected-value="${value}">
    <input class="atsx-select-search__field" value="${value}"><span class="selected">${value}</span>
  </div>`;
}

function projectItem(index = 0) {
  return `<div class="resumeEditForm-item">
    ${field(`project[${index}].name`, "项目名称", `<input data-cy="project[${index}].nameInput">`)}
    ${field(`project[${index}].role`, "项目角色", `<input data-cy="project[${index}].roleInput">`)}
    ${field(`project[${index}].link`, "项目链接", `<input data-cy="project[${index}].linkInput">`)}
    ${field(`project[${index}].desc`, "描述", `<textarea data-cy="project[${index}].descInput"></textarea>`)}
  </div>`;
}

function educationItem(index = 0) {
  return `<div class="resumeEditForm-item">
    ${field(`education[${index}].school`, "学校名称", combo(`education[${index}].schoolInput`))}
    ${field(`education[${index}].degree`, "学历", combo(`education[${index}].degreeInput`))}
    ${field(`education[${index}].fieldOfStudy`, "专业", `<input data-cy="education[${index}].fieldOfStudyInput">`)}
  </div>`;
}

function editFixture({ withAdder = false, replaceRootOnAdd = false } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>飞书简历编辑</title><style>
    .atsx-select-dropdown { position: fixed; left: 10px; top: 10px; width: 240px; min-height: 120px; background: white; z-index: 10; }
    .atsx-select-dropdown [role="option"] { display: block; min-height: 24px; }
  </style></head><body>
    <main>
      <section class="resumeEditForm-education createFormSection-repeatable"><h2 class="createFormSection-title">教育经历</h2>
        ${educationItem(0)}${withAdder ? '<div class="formOperate-addBtn">添加</div>' : ''}
      </section>
      <section class="resumeEditForm-project createFormSection-repeatable"><h2 class="createFormSection-title">项目经历</h2>
        ${projectItem(0)}
      </section>
      <section class="resumeEditForm-work createFormSection-repeatable"><h2 class="createFormSection-title">作品</h2>
        ${field("works[0].link", "作品链接", '<input data-cy="works[0].linkInput">')}
      </section>
    </main>
    <script>
      function bindCombos(root = document) {
        root.querySelectorAll('[role="combobox"]').forEach((combo) => {
          if (combo.dataset.bound) return;
          combo.dataset.bound = '1';
        combo.addEventListener('click', () => {
          const popup = document.createElement('div');
          popup.className = 'atsx-select-dropdown';
          popup.innerHTML = ['湖南大学', '示例大学', '本科', '硕士'].map((text) => '<div role="option">' + text + '</div>').join('');
          popup.querySelectorAll('[role="option"]').forEach((option) => option.addEventListener('click', () => {
            combo.dataset.selectedValue = option.textContent;
            combo.querySelector('input').value = option.textContent;
            combo.querySelector('.selected').textContent = option.textContent;
            popup.remove();
            combo.dispatchEvent(new Event('change', { bubbles: true }));
          }));
          document.body.appendChild(popup);
        });
        });
      }
      bindCombos();
      document.querySelector('.formOperate-addBtn')?.addEventListener('click', (event) => {
        const root = event.currentTarget.closest('.resumeEditForm-education');
        if (${JSON.stringify(replaceRootOnAdd)}) {
          const replacement = root.cloneNode(true);
          replacement.insertAdjacentHTML('beforeend', ${JSON.stringify(educationItem(1))});
          root.replaceWith(replacement);
          replacement.querySelectorAll('[role="combobox"]').forEach((combo) => delete combo.dataset.bound);
          bindCombos(replacement);
        } else {
          root.insertAdjacentHTML('beforeend', ${JSON.stringify(educationItem(1))});
          bindCombos(root);
        }
      });
    </script>
  </body></html>`;
}

function specialFixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>影石简历编辑</title><style>
    .atsx-select-dropdown { position: fixed; left: 10px; top: 10px; width: 240px; min-height: 80px; background: white; z-index: 10; }
    .atsx-select-dropdown [role="option"] { display: block; min-height: 24px; }
    .atsx-date-picker-dropdown { position: fixed; left: 280px; top: 10px; width: 280px; min-height: 80px; background: white; z-index: 20; }
    .atsx-date-picker-period-month-panel-list-item { display: block; min-height: 24px; }
  </style></head><body>
    <section class="resumeEditForm-basicInfoSection"><h2>基本信息</h2>
      ${field("nationality", "国籍", combo("nationalityInput"))}
    </section>
    <section class="resumeEditForm-education"><h2>教育经历</h2><div class="resumeEditForm-item">
      ${field("education[0].period", "开始时间", '<input data-cy="education[0].periodInputBegin" placeholder="YYYY-MM">')}
      ${field("education[0].period", "结束时间", '<input data-cy="education[0].periodInputEnd" placeholder="YYYY-MM">')}
    </div></section>
    <section class="resumeEditForm-customFieldModule"><h2>自我评价</h2>
      <div>${field("7306049742297991474[0].7306049742298302770", "自我评价", '<textarea data-cy="7306049742297991474[0].7306049742298302770Input"></textarea>')}</div>
    </section>
    <section class="resumeEditForm-sns"><h2>其他信息</h2><div class="resumeEditForm-item">
      ${field("sns[0].snsType", "社交平台", combo("sns[0].snsTypeInput"))}
      ${field("sns[0].link", "URL / ID", '<input data-cy="sns[0].linkInput">')}
      ${field("sns[1].snsType", "社交平台", combo("sns[1].snsTypeInput"))}
      ${field("sns[1].link", "URL / ID", '<input data-cy="sns[1].linkInput">')}
    </div></section>
    <button id="save" type="button">保存</button><button id="done" type="button">完成</button>
    <script>
      let activeDate = null;
      function addChoicePopup(combo) {
        const popup = document.createElement('div');
        popup.className = 'atsx-select-dropdown';
        const options = combo.dataset.cy === 'nationalityInput' ? ['中国', '美国'] : ['GitHub', '个人主页'];
        popup.innerHTML = options.map((text) => '<div role="option">' + text + '</div>').join('');
        popup.querySelectorAll('[role="option"]').forEach((option) => option.addEventListener('click', () => {
          combo.dataset.selectedValue = option.textContent;
          combo.querySelector('input').value = option.textContent;
          combo.querySelector('.selected').textContent = option.textContent;
          popup.remove();
        }));
        document.body.appendChild(popup);
      }
      document.querySelectorAll('[role="combobox"]').forEach((combo) => combo.addEventListener('click', () => addChoicePopup(combo)));
      document.querySelectorAll('[data-cy$="periodInputBegin"],[data-cy$="periodInputEnd"]').forEach((control) => control.addEventListener('click', () => {
        activeDate = control;
        const popup = document.createElement('div');
        popup.className = 'atsx-date-picker-dropdown';
        popup.innerHTML = '<div class="atsx-date-picker-period-month-panel-list">' + ['2021', '2022', '2025'].map((text) => '<div class="atsx-date-picker-period-month-panel-list-item" data-year="' + text + '">' + text + '</div>').join('') + '</div>';
        popup.querySelectorAll('[data-year]').forEach((option) => option.addEventListener('click', () => {
          popup.innerHTML = '<div class="atsx-date-picker-period-month-panel-list">' + ['01', '06', '09'].map((text) => '<div class="atsx-date-picker-period-month-panel-list-item" data-month="' + text + '">' + text + '</div>').join('') + '</div>';
          popup.querySelectorAll('[data-month]').forEach((month) => month.addEventListener('click', () => {
            activeDate.value = option.dataset.year + '-' + month.dataset.month;
            popup.remove();
          }));
        }));
        document.body.appendChild(popup);
      }));
      document.querySelectorAll('#save,#done').forEach((button) => button.addEventListener('click', () => button.dataset.clicked = '1'));
    </script>
  </body></html>`;
}

test("Feishu data-cy mapping keeps projects separate from works", async ({ page }) => {
  await installContentScript(page, { profile: profile(), html: editFixture(), url: FEISHU_EDIT_URL });
  const { response } = await runAutofill(page);

  expect(response.ok).toBe(true);
  expect(await page.locator('[data-cy="project[0].nameInput"]').inputValue()).toBe("边缘智能项目");
  expect(await page.locator('[data-cy="project[0].roleInput"]').inputValue()).toBe("核心开发");
  expect(await page.locator('[data-cy="project[0].descInput"]').inputValue()).toBe("项目简介原文\n职责原文\n成果原文");
  expect(await page.locator('[data-cy="works[0].linkInput"]').inputValue()).toBe("");
  expect(await page.locator('[data-cy="works[0].linkInput"]').getAttribute("data-ojaf-mark")).toBe("uncertain");
  expect(await page.locator('[data-cy="works[0].linkInput"]').getAttribute("title")).toContain("作品模块按用户选择跳过");
});

test("Feishu adapter adds missing repeat items before scanning", async ({ page }) => {
  await installContentScript(page, { profile: profile(), html: editFixture({ withAdder: true, replaceRootOnAdd: true }), url: FEISHU_EDIT_URL });
  const { response, debug } = await runAutofill(page);
  expect(response.ok).toBe(true);
  expect(await page.locator('.resumeEditForm-education .resumeEditForm-item').count()).toBe(2);
  expect(await page.locator('[data-cy="education[1].schoolInput"]').getAttribute("data-ojaf-mark")).toBe("filled");
  expect(await page.locator('[data-cy="education[1].schoolInput"] input').inputValue()).toBe("示例大学");
  await runAutofill(page);
  expect(await page.locator('.resumeEditForm-education .resumeEditForm-item').count()).toBe(2);

});

test("Feishu reports a missing add entry instead of hiding the second record", async ({ page }) => {
  await installContentScript(page, { profile: profile(), html: editFixture(), url: FEISHU_EDIT_URL });
  const { response, debug } = await runAutofill(page);

  expect(response.data.ok).toBe(true);
  expect(await page.locator('.resumeEditForm-education .resumeEditForm-item').count()).toBe(1);
  expect(debug.data.counts.blocked).toBeGreaterThan(0);
  expect(debug.data.blocked.some((item) => item.reason.includes("添加入口"))).toBe(true);
  expect(debug.data.summary.pending).toBeGreaterThan(0);
});

test("Feishu view page asks the user to enter edit mode", async ({ page }) => {
  await installContentScript(page, {
    profile: profile(),
    html: '<!doctype html><html><head><meta charset="utf-8"></head><body><main><h1>我的简历</h1><a href="/campus/resume/edit">编辑</a></main></body></html>',
    url: FEISHU_VIEW_URL
  });
  const { response } = await runAutofill(page);

  expect(response.ok).toBe(true);
  expect(response.data.reason).toBe("view page");
  expect(response.data.message).toContain("编辑");
  expect(response.data.editLink).toContain("/campus/resume/edit");
});

test("Feishu login page is reported before any field scan", async ({ page }) => {
  await installContentScript(page, {
    profile: profile(),
    html: '<!doctype html><html><head><meta charset="utf-8"></head><body><main><h1>登录飞书招聘</h1><button type="button">登录</button></main></body></html>',
    url: FEISHU_LOGIN_URL
  });
  const { response, debug } = await runAutofill(page);

  expect(response.ok).toBe(true);
  expect(response.data.ok).toBe(false);
  expect(response.data.reason).toBe("login page");
  expect(debug.data.scan.pageMode).toBe("login");
  expect(debug.data.scan.fieldCount).toBe(0);
});

test("Feishu handles nationality, dates, self evaluation and social accounts", async ({ page }) => {
  await installContentScript(page, { profile: specialProfile(), html: specialFixture(), url: FEISHU_EDIT_URL });
  const { response, debug } = await runAutofill(page);

  expect(response.ok).toBe(true);
  expect(await page.locator('[data-cy="nationalityInput"]').getAttribute("data-selected-value")).toBe("中国");
  expect(await page.locator('[data-cy="education[0].periodInputBegin"]').inputValue()).toBe("2021-09");
  expect(await page.locator('[data-cy="education[0].periodInputEnd"]').inputValue()).toBe("2025-06");
  expect(await page.locator('[data-cy="7306049742297991474[0].7306049742298302770Input"]').inputValue()).toBe("自我评价原文");
  expect(await page.locator('[data-cy="sns[0].snsTypeInput"]').getAttribute("data-selected-value")).toBe("GitHub");
  expect(await page.locator('[data-cy="sns[0].linkInput"]').inputValue()).toBe("https://github.com/yunxiangzhong");
  expect(await page.locator('[data-cy="sns[1].snsTypeInput"]').getAttribute("data-selected-value")).toBe("个人主页");
  expect(await page.locator('[data-cy="sns[1].linkInput"]').inputValue()).toBe("https://example.com/home");
  expect(await page.locator("#save").getAttribute("data-clicked")).toBeNull();
  expect(debug.data.scan.fields.some((item) => item.itemIndex === 0 && item.controlType === "date")).toBe(true);
});

test("Feishu leaves an ambiguous dropdown and missing date month for review", async ({ page }) => {
  const ambiguous = `<!doctype html><html><head><meta charset="utf-8"><title>飞书复核</title><style>
    .atsx-select-dropdown { position: fixed; left: 10px; top: 10px; width: 260px; min-height: 60px; background: white; z-index: 10; }
    .atsx-select-dropdown [role="option"] { display: block; min-height: 24px; }
  </style></head><body>
    <section class="resumeEditForm-education"><h2>教育经历</h2><div class="resumeEditForm-item">
      ${field("education[0].school", "学校名称", combo("education[0].schoolInput"))}
      ${field("education[0].period", "开始时间", '<input data-cy="education[0].periodInputBegin" placeholder="YYYY-MM">')}
    </div></section>
    <script>
      document.querySelector('[role="combobox"]').addEventListener('click', (event) => {
        const combo = event.currentTarget, popup = document.createElement('div');
        popup.className = 'atsx-select-dropdown';
        popup.innerHTML = ['湖南大学（校本部）', '湖南大学（南校区）'].map((text) => '<div role="option">' + text + '</div>').join('');
        popup.querySelectorAll('[role="option"]').forEach((option) => option.addEventListener('click', () => { combo.dataset.selectedValue = option.textContent; popup.remove(); }));
        document.body.appendChild(popup);
      });
    </script>
  </body></html>`;
  const data = specialProfile();
  data.sections.education.items[0].values.开始时间 = "2025";
  await installContentScript(page, { profile: data, html: ambiguous, url: FEISHU_EDIT_URL });
  const { debug } = await runAutofill(page);

  expect(await page.locator('[data-cy="education[0].schoolInput"]').getAttribute("data-ojaf-mark")).toBe("uncertain");
  expect(await page.locator('[data-cy="education[0].schoolInput"]').getAttribute("data-selected-value")).toBe("");
  expect(await page.locator('[data-cy="education[0].periodInputBegin"]').inputValue()).toBe("");
  expect(debug.data.summary.pending).toBeGreaterThan(0);
  expect(debug.data.results.some((item) => item.note.includes("下拉选项") || item.note.includes("日期资料缺少"))).toBe(true);
});

test("Feishu data-cy on the ATSX field wrapper still resolves the inner combobox", async ({ page }) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>飞书字段包装器</title><style>
    .atsx-select-dropdown { position: fixed; left: 10px; top: 10px; width: 220px; min-height: 30px; background: white; }
    .atsx-select-dropdown [role="option"] { display: block; min-height: 24px; }
  </style></head><body><section class="resumeEditForm-education"><h2>教育经历</h2><div class="resumeEditForm-item">
    <div class="atsx-form-item"><label>学校名称</label><div class="atsx-select-field" data-cy="education[0].schoolInput"><div role="combobox"><input value=""><span class="selected"></span></div></div></div>
  </div></section><script>
    document.querySelector('[role="combobox"]').addEventListener('click', (event) => { const combo = event.currentTarget, popup = document.createElement('div'); popup.className='atsx-select-dropdown'; popup.innerHTML='<div role="option">湖南大学</div>'; popup.firstElementChild.addEventListener('click', () => { combo.dataset.selectedValue='湖南大学'; combo.querySelector('input').value='湖南大学'; combo.querySelector('.selected').textContent='湖南大学'; popup.remove(); }); document.body.appendChild(popup); });
  </script></body></html>`;
  const data = { sections: { education: { title: "教育经历", kind: "repeat", items: [{ title: "教育经历 1", values: { 学校名称: "湖南大学" } }] } } };
  await installContentScript(page, { profile: data, html, url: FEISHU_EDIT_URL });
  const { debug } = await runAutofill(page);

  expect(await page.locator('[data-cy="education[0].schoolInput"] [role="combobox"]').getAttribute("data-selected-value")).toBe("湖南大学");
  expect(await page.locator('[data-cy="education[0].schoolInput"]').getAttribute("data-ojaf-mark")).toBe("filled");
  expect(debug.data.scan.fields.find((item) => item.dataCy === "education[0].schoolInput").itemIndex).toBe(0);
});

test("Feishu waits for the aria-controlled dropdown and ignores hidden duplicate popups", async ({ page }) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>飞书异步下拉</title><style>
    .atsx-select-dropdown { position: fixed; left: 10px; top: 10px; width: 220px; min-height: 30px; background: white; }
  </style></head><body><section class="resumeEditForm-education"><h2>教育经历</h2><div class="resumeEditForm-item">
    ${field("education[0].school", "学校名称", '<div data-cy="education[0].schoolInput" role="combobox" aria-controls="live-options"><input value=""><span class="selected"></span></div>')}
  </div></section>
  <div id="stale-options" class="atsx-select-dropdown" style="display:none"><div role="option">湖南大学</div></div>
  <div id="live-options" class="atsx-select-dropdown" style="display:none"></div>
  <script>
    const combo = document.querySelector('[role="combobox"]'), popup = document.querySelector('#live-options');
    combo.addEventListener('click', () => setTimeout(() => {
      combo.setAttribute('aria-expanded', 'true'); popup.style.display = 'block'; popup.innerHTML = '<div role="option">湖南大学</div>';
      popup.firstElementChild.addEventListener('click', () => { combo.dataset.selectedValue = '湖南大学'; combo.querySelector('input').value = '湖南大学'; combo.querySelector('.selected').textContent = '湖南大学'; popup.style.display = 'none'; });
    }, 120));
  </script></body></html>`;
  const data = { sections: { education: { title: "教育经历", kind: "repeat", items: [{ title: "教育经历 1", values: { 学校名称: "湖南大学" } }] } } };
  await installContentScript(page, { profile: data, html, url: FEISHU_EDIT_URL });
  const { response } = await runAutofill(page);

  expect(response.data.ok).toBe(true);
  expect(await page.locator('[data-cy="education[0].schoolInput"]').getAttribute("data-selected-value")).toBe("湖南大学");
});

test("Feishu keeps long project descriptions intact", async ({ page }) => {
  const data = profile();
  const longText = "项目正文" + "长描述".repeat(180);
  data.sections.project.items[0].values.项目内容 = longText;
  await installContentScript(page, { profile: data, html: editFixture(), url: FEISHU_EDIT_URL });
  await runAutofill(page);

  expect(await page.locator('[data-cy="project[0].descInput"]').inputValue()).toBe(`${longText}\n职责原文\n成果原文`);
});

test("Bambu single periodInput fills both start and end months", async ({ page }) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>拓竹简历编辑</title><style>
    .atsx-date-picker-dropdown { position: fixed; left: 10px; top: 10px; width: 260px; min-height: 60px; background: white; z-index: 20; }
    .atsx-date-picker-period-month-panel-list-item { display: block; min-height: 24px; }
  </style></head><body><section class="resumeEditForm-education"><h2>教育经历</h2><div class="resumeEditForm-item">
    ${field("education[0].period", "起止时间", '<div data-cy="education[0].periodInput" class="atsx-date-picker-period-month"><input placeholder="YYYY-MM"><input placeholder="YYYY-MM"></div>')}
  </div></section><script>
    let rangeStart = '';
    document.querySelector('[data-cy="education[0].periodInput"]').addEventListener('click', (event) => {
      const control = event.currentTarget, popup = document.createElement('div'); popup.className = 'atsx-date-picker-dropdown';
      popup.innerHTML = '<div class="atsx-date-picker-period-month-panel-list">' + ['2021', '2025'].map((text) => '<div class="atsx-date-picker-period-month-panel-list-item" data-year="' + text + '">' + text + '</div>').join('') + '</div>';
      popup.querySelectorAll('[data-year]').forEach((year) => year.addEventListener('click', () => {
        popup.innerHTML = '<div class="atsx-date-picker-period-month-panel-list">' + ['06', '09'].map((text) => '<div class="atsx-date-picker-period-month-panel-list-item" data-month="' + text + '">' + text + '</div>').join('') + '</div>';
        popup.querySelectorAll('[data-month]').forEach((month) => month.addEventListener('click', () => { if (!rangeStart) { rangeStart = year.dataset.year + '-' + month.dataset.month; control.querySelector('input').value = rangeStart; } else { control.querySelectorAll('input')[1].value = year.dataset.year + '-' + month.dataset.month; popup.remove(); } }));
      }));
      document.body.appendChild(popup);
    });
  </script></body></html>`;
  const data = specialProfile();
  await installContentScript(page, { profile: data, html, url: "https://bambulab.jobs.feishu.cn/campus/resume/edit" });
  const { response } = await runAutofill(page);

  expect(response.data.ok).toBe(true);
  expect(await page.locator('[data-cy="education[0].periodInput"] input').nth(0).inputValue()).toBe("2021-09");
  expect(await page.locator('[data-cy="education[0].periodInput"] input').nth(1).inputValue()).toBe("2025-06");
  expect(await page.locator('[data-cy="education[0].periodInput"]').getAttribute("data-ojaf-mark")).toBe("filled");
});

test("Bambu partial periodInput stays pending instead of treating one matching month as complete", async ({ page }) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>拓竹简历编辑</title><style>
    .atsx-date-picker-dropdown { position: fixed; left: 10px; top: 10px; width: 260px; min-height: 60px; background: white; z-index: 20; }
    .atsx-date-picker-period-month-panel-list-item { display: block; min-height: 24px; }
  </style></head><body><section class="resumeEditForm-education"><h2>教育经历</h2><div class="resumeEditForm-item">
    ${field("education[0].period", "起止时间", '<div data-cy="education[0].periodInput" class="atsx-date-picker-period-month"><input value="2021-09" placeholder="YYYY-MM"><input value="" placeholder="YYYY-MM"></div>')}
  </div></section></body></html>`;
  const data = specialProfile();
  await installContentScript(page, { profile: data, html, url: "https://bambulab.jobs.feishu.cn/campus/resume/edit" });
  const { response } = await runAutofill(page);

  expect(response.data.ok).toBe(false);
  expect(response.data.reason).toBe("no candidates");
  expect(response.data.pending).toBeGreaterThan(0);
  expect(await page.locator('[data-cy="education[0].periodInput"] input').nth(0).inputValue()).toBe("2021-09");
  expect(await page.locator('[data-cy="education[0].periodInput"] input').nth(1).inputValue()).toBe("");
});

test("Feishu uses a visible current-date option only when the control provides it", async ({ page }) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>飞书日期编辑</title><style>
    .atsx-date-picker-dropdown { position: fixed; left: 10px; top: 10px; width: 180px; min-height: 40px; background: white; z-index: 20; }
  </style></head><body><section class="resumeEditForm-education"><h2>教育经历</h2><div class="resumeEditForm-item">
    ${field("education[0].period", "结束时间", '<input data-cy="education[0].periodInputEnd" placeholder="YYYY-MM">')}
  </div></section><script>
    const input = document.querySelector('[data-cy="education[0].periodInputEnd"]');
    input.addEventListener('click', () => {
      const popup = document.createElement('div'); popup.className = 'atsx-date-picker-dropdown';
      popup.innerHTML = '<button type="button">至今</button>';
      popup.firstElementChild.addEventListener('click', () => { input.value = '至今'; popup.remove(); });
      document.body.appendChild(popup);
    });
  </script></body></html>`;
  const data = specialProfile();
  data.sections.education.items[0].values.结束时间 = "至今";
  await installContentScript(page, { profile: data, html, url: FEISHU_EDIT_URL });
  const { response } = await runAutofill(page);

  expect(response.data.ok).toBe(true);
  expect(await page.locator('[data-cy="education[0].periodInputEnd"]').inputValue()).toBe("至今");
});
