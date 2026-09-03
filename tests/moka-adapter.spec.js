import { test, expect } from "@playwright/test";
import { installContentScript, runAutofill, sendContentMessage } from "./support/extension-fixture.js";

const MOKA_URL = "https://app.mokahr.com/campus-recruitment/example/140888?locale=zh-CN#/candidateHome/resume";

function profile() {
  return {
    sections: {
      basic: {
        title: "基本信息",
        values: {
          性别: "男",
          最高学历: "本科",
          现居住城市: "示例市",
          证件号码类型: "身份证",
          证件号码: "11010120000101001X",
          出生日期: "2005-09-30"
        }
      },
      intention: {
        title: "求职意向",
        values: { 当前薪资: "", 期望薪资: "", 期望城市: "" }
      },
      work: {
        title: "工作经历",
        kind: "repeat",
        items: [{
          title: "工作经历 1",
          values: { 公司名称: "", 职位名称: "", 工作职责: "", 开始时间: "", 结束时间: "" }
        }]
      },
      education: {
        title: "教育经历",
        kind: "repeat",
        items: [{
          title: "示例大学",
          values: {
            学校: "示例大学",
            专业: "物联网工程",
            学历: "本科",
            开始时间: "2023-09",
            结束时间: "2027-06"
          }
        }]
      },
      internship: {
        title: "实习经历",
        kind: "repeat",
        items: [{
          title: "示例科技公司",
          values: {
            公司: "示例科技公司",
            职位: "数据分析师",
            工作内容: "实习工作内容原文",
            开始时间: "2025-07",
            结束时间: "2025-08"
          }
        }]
      },
      project: {
        title: "项目经历",
        kind: "repeat",
        items: [
          {
            title: "项目一",
            values: {
              项目名称: "项目一",
              职位: "队长",
              项目内容: "项目一内容原文",
              本人职责: "项目一职责原文",
              开始时间: "2026-06",
              结束时间: "2026-07"
            }
          },
          {
            title: "项目二",
            values: {
              项目名称: "项目二",
              职位: "核心开发",
              项目内容: "项目二内容原文",
              开始时间: "2025-11",
              结束时间: "2025-12"
            }
          },
          {
            title: "项目三",
            values: {
              项目名称: "项目三",
              职位: "主程",
              项目内容: "项目三内容原文",
              本人职责: "项目三职责原文",
              开始时间: "2026-05",
              结束时间: "2026-05"
            }
          }
        ]
      },
      language: {
        title: "外语能力",
        kind: "repeat",
        items: [{
          title: "英语",
          values: { 外语种类: "英语", 掌握程度: "熟练" }
        }]
      },
      self: { title: "自我描述", values: { 自我描述: "" } },
      awards: {
        title: "获奖经历",
        kind: "repeat",
        items: [{ title: "获奖经历 1", values: { 奖项名称: "", 开始时间: "", 结束时间: "" } }]
      }
    }
  };
}

function mokaSelect({ placeholder = "请选择", options = [], autocomplete = false } = {}) {
  return `<div class="sd-Dropdown-container-1CigZ"><label class="sd-Input-container-1Eq4x sd-Select-container-1Eq4x select">
    <span class="sd-Input-display-value-RwqDy"></span><input type="text" placeholder="${placeholder}" ${autocomplete ? "data-autocomplete=\"true\"" : ""}>
  </label></div>`;
}

function dateRange() {
  return `<div class="date_info-3a1x"><div class="sd-Dropdown-container-1CigZ"><label class="sd-Select-container-1Eq4x"><span class="sd-Input-display-value-RwqDy"></span><input type="text" placeholder="年"></label></div>
    <div class="sd-Dropdown-container-1CigZ"><label class="sd-Select-container-1Eq4x"><span class="sd-Input-display-value-RwqDy"></span><input type="text" placeholder="月"></label></div>
    <span>-</span>
    <div class="sd-Dropdown-container-1CigZ"><label class="sd-Select-container-1Eq4x"><span class="sd-Input-display-value-RwqDy"></span><input type="text" placeholder="年"></label></div>
    <div class="sd-Dropdown-container-1CigZ"><label class="sd-Select-container-1Eq4x"><span class="sd-Input-display-value-RwqDy"></span><input type="text" placeholder="月"></label></div>
  </div>`;
}

function field(label, control, className = "") {
  return `<div class="apply-field-Q2iJ7AtQGX ${className}"><div class="title-IWWQ0Xa4L7"><span><span>${label}</span></span></div><div class="ctrl-CICMG4Fr4_">${control}</div></div>`;
}

function repeatItem(kind, index = 0) {
  if (kind === "education") {
    return `<div class="apply-fields-BzcXI4i2Pm education-item">
      ${field("学校名称", mokaSelect({ placeholder: "请输入就读学校", autocomplete: true }))}
      ${field("专业名称", mokaSelect({ placeholder: "请输入专业名称", autocomplete: true }))}
      ${field("学历", mokaSelect({ options: ["本科", "硕士"] }))}
      ${field("起止时间", dateRange(), "date_info")}
    </div>`;
  }
  if (kind === "internship") {
    return `<div class="apply-fields-BzcXI4i2Pm internship-item">
      ${field("公司名称", '<input type="text" placeholder="公司名称">')}
      ${field("职位名称", '<input type="text" placeholder="职位名称">')}
      ${field("工作职责", '<textarea placeholder="工作职责"></textarea>')}
      ${field("起止时间", dateRange(), "date_info")}
    </div>`;
  }
  if (kind === "project") {
    return `<div class="apply-fields-BzcXI4i2Pm project-item">
      ${field("项目名称", '<input type="text" placeholder="项目名称">')}
      ${field("职责", '<input type="text" placeholder="职责">')}
      ${field("项目描述", '<textarea placeholder="项目描述"></textarea>')}
      ${field("项目中职责", '<textarea placeholder="项目中职责"></textarea>')}
      ${field("起止时间", dateRange(), "date_info")}
    </div>`;
  }
  if (kind === "work") {
    return `<div class="apply-fields-BzcXI4i2Pm work-item">
      ${field("公司名称", '<input type="text" placeholder="公司名称">')}
      ${field("职位名称", '<input type="text" placeholder="职位名称">')}
      ${field("工作职责", '<textarea placeholder="工作职责"></textarea>')}
      ${field("起止时间", dateRange(), "date_info")}
    </div>`;
  }
  if (kind === "awards") {
    return `<div class="apply-fields-BzcXI4i2Pm awards-item">
      ${field("奖项名称", '<input type="text" placeholder="奖项名称">')}
      ${field("起止时间", dateRange(), "date_info")}
    </div>`;
  }
  return `<div class="apply-fields-BzcXI4i2Pm language-item">
    ${field("语言类型", mokaSelect({ options: ["英语", "日语"] }))}
    ${field("掌握程度", mokaSelect({ options: ["熟练", "一般"] }))}
  </div>`;
}

function mokaFixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Moka 简历编辑</title><style>
    .sd-Dropdown-dropdown { display: block; background: white; border: 1px solid #ddd; }
    .sd-Dropdown-dropdown[hidden] { display: none; }
    .sd-Menu-content-item, .sd-basic-year-item { display: block; min-height: 24px; }
  </style></head><body><main>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">个人信息</div>
      ${field("性别", mokaSelect({ options: ["男", "女"] }))}
      ${field("最高学历", mokaSelect({ options: ["本科", "硕士"] }))}
      ${field("所在地", '<input type="text" placeholder="所在地">')}
      ${field("证件号码", mokaSelect({ placeholder: "证件类型" }), "id-type")}
      ${field("证件号码", '<input type="text" placeholder="证件号码">', "id-number")}
      <div class="apply-field-Q2iJ7AtQGX day_info-3a1x"><div class="title-IWWQ0Xa4L7"><span><span>出生日期 (年龄)</span></span></div><div class="ctrl-CICMG4Fr4_"><div class="sd-Dropdown-container-1CigZ"><label><input type="text" placeholder="出生日期 (年龄)" readonly></label></div></div></div>
    </section>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">求职意向</div>${field("当前薪资", '<input type="text" placeholder="当前薪资">')}${field("期望薪资", '<input type="text" placeholder="期望薪资">')}${field("期望城市", '<input type="text" placeholder="期望城市">')}</section>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">工作经历</div>${repeatItem("work")}</section>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">教育背景</div>${repeatItem("education")}</section>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">实习经历</div>${repeatItem("internship")}</section>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">项目经验</div>${repeatItem("project")}<button type="button" class="add-project">添加</button></section>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">语言能力</div>${repeatItem("language")}</section>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">自我描述</div>${field("自我描述", '<textarea placeholder="简介"></textarea>')}</section>
    <section class="apply-block-KRDTLLb5hU"><div class="blockTitle-dcmrfhpkg1">获奖经历</div>${repeatItem("awards")}</section>
    <div role="dialog" aria-label="登录弹窗"><label>登录邮箱<input type="text" placeholder="登录邮箱"></label><label>验证码<input type="text" placeholder="登录验证码"></label></div>
    <button id="save" type="button">保存</button>
  </main><script>
    const MONTHS = ${JSON.stringify(["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"])};
    function optionPopup(input, options) {
      const popup = document.createElement('div');
      popup.className = 'sd-Dropdown-dropdown';
      popup.innerHTML = options.map(text => '<div class="sd-Menu-content-item">' + text + '</div>').join('');
      popup.querySelectorAll('.sd-Menu-content-item').forEach(option => option.addEventListener('click', () => {
        if (input.dataset.unconfirmed !== 'true') input.closest('label').querySelector('[class*="sd-Input-display-value"]').textContent = option.textContent;
        popup.remove();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }));
      input.closest('[class*="sd-Dropdown-container"]').appendChild(popup);
      return popup;
    }
    function bindSelects(root = document) {
      root.querySelectorAll('[class*="sd-Select-container"] input').forEach(input => {
        if (input.dataset.bound) return;
        input.dataset.bound = '1';
        input.addEventListener('click', () => {
          if (!input.dataset.autocomplete) {
            const options = input.placeholder === '年' ? ['2023','2025','2026','2027'] : input.placeholder === '月' ? ['1','5','6','7','8','9','11','12'] : ['男','女','本科','硕士','身份证','英语','日语','熟练','一般'];
            optionPopup(input, options);
          }
        });
        input.addEventListener('input', () => {
          if (input.dataset.autocomplete) optionPopup(input, [input.value]);
        });
      });
    }
    function birthdayPopup(input) {
      const popup = document.createElement('div'); popup.className = 'sd-Dropdown-dropdown'; popup.dataset.stage = 'months';
      function renderMonths(year) { popup.dataset.stage = 'months'; popup.innerHTML = '<div class="sd-basic-selector"><span class="sd-basic-selector-year">' + year + '年</span></div><div>' + MONTHS.map(month => '<div class="sd-basic-year-item">' + month + '</div>').join('') + '</div>'; }
      function renderYears(start) { popup.dataset.stage = 'years'; popup.innerHTML = '<div class="sd-basic-selector"><span class="sd-basic-selector-year">' + start + ' - ' + (start + 9) + '</span><span class="sd-Icon-icondoubleRight"></span></div><div>' + Array.from({length: 10}, (_, i) => '<div class="sd-basic-year-item">' + (start + i) + '</div>').join('') + '</div>'; popup.querySelector('[class*="icondoubleRight"]').addEventListener('click', () => renderYears(start + 10)); }
      renderMonths(1990);
      popup.querySelector('[class*="basic-selector-year"]').addEventListener('click', () => renderYears(1990));
      popup.addEventListener('click', event => { const item = event.target.closest('[class*="basic-year-item"]'); if (!item) return; if (popup.dataset.stage === 'years') { renderMonths(Number(item.textContent)); } else { const month = String(MONTHS.indexOf(item.textContent) + 1).padStart(2, '0'); input.value = '2005-' + month + '-30 (20岁)'; popup.remove(); input.dispatchEvent(new Event('change', { bubbles: true })); } });
      input.closest('[class*="sd-Dropdown-container"]').appendChild(popup);
    }
    document.querySelectorAll('[class*="day_info"] input').forEach(input => input.addEventListener('click', () => birthdayPopup(input)));
    bindSelects();
    document.querySelector('.add-project').addEventListener('click', event => { const root = event.currentTarget.closest('[class*="apply-block-"]'); root.insertAdjacentHTML('beforeend', ${JSON.stringify(repeatItem("project", 1))}); bindSelects(root); });
    document.querySelector('#save').addEventListener('click', event => event.currentTarget.dataset.clicked = '1');
  </script></body></html>`;
}

test("Moka adapter fills custom controls, dates, and repeatable project rows", async ({ page }) => {
  await installContentScript(page, { profile: profile(), html: mokaFixture(), url: MOKA_URL });
  const { response, debug } = await runAutofill(page);

  expect(response.ok).toBe(true);
  expect(response.data.ok).toBe(true);
  expect(await page.locator('[class*="apply-block-"]').nth(3).locator('[class*="apply-fields-"]').count()).toBe(1);
  expect(await page.locator('[class*="apply-block-"]').nth(5).locator('[class*="apply-fields-"]').count()).toBe(3);
  expect(await page.locator('[class*="apply-block-"]').nth(0).locator('[class*="sd-Input-display-value"]').first().textContent()).toBe("男");
  expect(await page.locator('[class*="apply-block-"]').nth(0).locator('[class*="sd-Input-display-value"]').nth(1).textContent()).toBe("本科");
  expect(await page.locator('.id-type [class*="sd-Input-display-value"]').textContent()).toBe("身份证");
  expect(await page.locator('.id-number input[placeholder="证件号码"]').inputValue()).toBe("11010120000101001X");
  expect(await page.locator('[class*="day_info"] input').inputValue()).toContain("2005-09");
  expect(await page.locator('.education-item input[placeholder="请输入就读学校"]').locator('..').locator('[class*="sd-Input-display-value"]').textContent()).toBe("示例大学");
  expect(await page.locator('.education-item [class*="date_info"] [class*="sd-Input-display-value"]').allTextContents()).toEqual(["2023", "9", "2027", "6"]);
  expect(await page.locator('.education-item textarea').count()).toBe(0);
  expect(await page.locator('.internship-item input[placeholder="公司名称"]').inputValue()).toBe("示例科技公司");
  expect(await page.locator('.internship-item textarea').inputValue()).toBe("实习工作内容原文");
  expect(await page.locator('.project-item input[placeholder="项目名称"]').nth(0).inputValue()).toBe("项目一");
  expect(await page.locator('.project-item input[placeholder="项目名称"]').nth(1).inputValue()).toBe("项目二");
  expect(await page.locator('.project-item input[placeholder="项目名称"]').nth(2).inputValue()).toBe("项目三");
  expect(await page.locator('.project-item textarea[placeholder="项目描述"]').nth(0).inputValue()).toBe("项目一内容原文");
  expect(await page.locator('.project-item textarea[placeholder="项目中职责"]').nth(1).inputValue()).toBe("");
  expect(await page.locator('#save').getAttribute('data-clicked')).toBeNull();
  expect(debug.data.scan.siteAdapter.id).toBe("moka");
  expect(debug.data.scan.repeatPreparation.added.filter(item => item.section === "项目经历")).toHaveLength(2);
  expect(debug.data.summary.pending).toBe(0);
  expect(debug.data.summary.skipped).toBeGreaterThan(0);
  expect(debug.data.scan.fields.some(field => field.mokaInfo?.sectionKey === "project" && field.mokaInfo?.rangePart === "start" && field.mokaInfo?.rangeUnit === "year")).toBe(true);
  expect(debug.data.results.some(result => result.skipped && result.fieldLabel === "项目中职责")).toBe(true);
});

test("Moka adapter leaves an unconfirmed Sugar option pending and never saves", async ({ page }) => {
  await installContentScript(page, { profile: profile(), html: mokaFixture(), url: MOKA_URL });
  await page.evaluate(() => {
    document.querySelector('[class*="sd-Select-container"] input').dataset.unconfirmed = "true";
  });
  const response = await sendContentMessage(page, { type: "OJAF_START_AUTOFILL" });

  expect(response.ok).toBe(true);
  expect(response.data.ok).toBe(true);
  expect(response.data.pending).toBeGreaterThan(0);
  expect(await page.locator('[class*="sd-Input-display-value"]').first().textContent()).toBe("");
  expect(await page.locator("#save").getAttribute("data-clicked")).toBeNull();
});

test("Moka adapter keeps an existing conflicting value for manual review", async ({ page }) => {
  await installContentScript(page, { profile: profile(), html: mokaFixture(), url: MOKA_URL });
  await page.locator('input[placeholder="所在地"]').fill("已有城市");
  const response = await sendContentMessage(page, { type: "OJAF_START_AUTOFILL" });

  expect(response.ok).toBe(true);
  expect(response.data.ok).toBe(true);
  expect(response.data.pending).toBeGreaterThan(0);
  expect(await page.locator('input[placeholder="所在地"]').inputValue()).toBe("已有城市");
  expect(await page.locator("#save").getAttribute("data-clicked")).toBeNull();
});
