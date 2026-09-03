import { test, expect } from "@playwright/test";
import { __test__ } from "../src/resume-importer.js";

test("Markdown headings keep education, internship and project records separate", () => {
  const blocks = __test__.extractMarkdownBlocks(`# 钟运翔

19914770930 | yunxiangzhong801@gmail.com | [GitHub](https://github.com/yunxiangzhong)

## 教育经历
### 湖南大学
物联网工程 · 本科
2023 – 2027

## 实习经历
### 湖南省次元门文化科技有限公司
数据分析师 ｜ 2025.07 – 2025.08
参与训练文本标注。

## 项目经历
### 脉盔
队长 ｜ 2026.07
项目简介：智能头盔。`);
  const draft = __test__.mapBlocksToDraft(blocks, "resume.md", "md");

  expect(draft.profileV2.sections.basic.values).toMatchObject({
    姓名: "钟运翔",
    电话: "19914770930",
    邮箱: "yunxiangzhong801@gmail.com",
    GitHub: "https://github.com/yunxiangzhong"
  });
  expect(draft.profileV2.sections.education.items[0].values).toMatchObject({
    学校: "湖南大学",
    学历: "本科",
    开始时间: "2023",
    结束时间: "2027"
  });
  expect(draft.profileV2.sections.internship.items).toHaveLength(1);
  expect(draft.profileV2.sections.internship.items[0].values).toMatchObject({
    公司: "湖南省次元门文化科技有限公司",
    职位: "数据分析师"
  });
  expect(draft.profileV2.sections.project.items[0].values).toMatchObject({
    项目名称: "脉盔",
    职位: "队长",
    开始时间: "2026-07"
  });
});

test("Markdown emphasis around labels does not create formatting-only fields", () => {
  const blocks = __test__.extractMarkdownBlocks(`# 钟运翔

## 项目经历
### 脉盔
**队长 ｜ 2026.07** **项目链接**： https://example.com/resume
**项目简介**：智能头盔。
**主要工作：**
**固件开发**：完成采集、通信和反馈闭环。
`);
  const project = __test__.mapBlocksToDraft(blocks, "resume.md", "md").profileV2.sections.project.items[0].values;

  expect(project).toMatchObject({
    项目名称: "脉盔",
    职位: "队长",
    项目链接: "https://example.com/resume"
  });
  expect(project.项目内容).toContain("固件开发：完成采集、通信和反馈闭环。");
  expect(project).not.toHaveProperty("本人职责");
  expect(project).not.toHaveProperty("项目简介");
});

test("Feishu-style basic and intention labels map to canonical fields", () => {
  const blocks = __test__.extractMarkdownBlocks(`姓名：李四
手机号码：13800138000
电子邮箱：li@example.com

## 教育经历
湖南大学 物联网工程 本科 2023 - 2027
GPA：3.3

## 求职意向
目标岗位：嵌入式软件工程师
意向城市：长沙
到岗时间：2026-07
期望薪资：10-15K
是否接受调剂：是
`);
  const draft = __test__.mapBlocksToDraft(blocks, "resume.md", "md");

  expect(draft.profileV2.sections.basic.values).toMatchObject({
    姓名: "李四",
    电话: "13800138000",
    邮箱: "li@example.com"
  });
  expect(draft.profileV2.sections.education.items[0].values.GPA).toBe("3.3");
  expect(draft.unclassified.some((entry) => entry.text.includes("GPA"))).toBeFalsy();
  expect(draft.profileV2.sections.intention.items[0].values).toMatchObject({
    意向岗位: "嵌入式软件工程师",
    期望工作城市: "长沙",
    预计入职时间: "2026-07",
    期望薪资: "10-15K",
    是否接受调剂: "是"
  });
});

test("Skill proficiency stays blank unless the source labels it explicitly", () => {
  const blocks = __test__.extractMarkdownBlocks(`## 技能
C/C++、Python；熟悉 STM32 与 ESP32 开发。
`);
  const values = __test__.mapBlocksToDraft(blocks, "resume.md", "md").profileV2.sections.computer.items[0].values;
  expect(values["证书名称（技能名称）"]).toContain("熟悉 STM32");
  expect(values).not.toHaveProperty("掌握程度");
});

test("PDF-like lines preserve multiple projects and original descriptions", () => {
  const blocks = [
    { text: "教育经历", source: "PDF 第 1 页" },
    { text: "湖南大学 物联网工程 本科 2023 – 2027", source: "PDF 第 1 页" },
    { text: "核心课程：数据结构、高等数学、计算机", source: "PDF 第 1 页" },
    { text: "系统、操作系统、嵌入式计算机系统。", source: "PDF 第 1 页" },
    { text: "项目经历 / 实践活动", source: "PDF 第 1 页" },
    { text: "脉盔 ｜ 全国大学生物联网设计竞赛队长 2026/07", source: "PDF 第 1 页" },
    { text: "项目简介：智能头盔端到端 IoT 闭环。", source: "PDF 第 1 页" },
    { text: "基于 STM32 的嵌入式智能测温系统 核心开发 2025/11 - 2025/12", source: "PDF 第 2 页" },
    { text: "项目简介：分布式测温系统。", source: "PDF 第 2 页" }
  ];
  const draft = __test__.mapBlocksToDraft(blocks, "resume.pdf", "pdf");
  const projects = draft.profileV2.sections.project.items;

  expect(draft.profileV2.sections.education.items[0].values.专业课程).toContain("系统、操作系统、嵌入式计算机系统");
  expect(draft.profileV2.sections.education.items[0].values).not.toHaveProperty("GPA");
  expect(projects).toHaveLength(2);
  expect(projects[0].values).toMatchObject({ 项目名称: "脉盔", 职位: "队长", 开始时间: "2026-07" });
  expect(projects[0].values.项目内容).toContain("智能头盔端到端 IoT 闭环");
  expect(projects[1].values).toMatchObject({
    项目名称: "基于 STM32 的嵌入式智能测温系统",
    职位: "核心开发",
    开始时间: "2025-11",
    结束时间: "2025-12"
  });
  expect(draft.unclassified.some((entry) => entry.text.includes("核心课程"))).toBeFalsy();
});

test("unsupported and empty inputs fail with actionable messages", async () => {
  await expect(__test__.mapBlocksToDraft([], "empty.md", "md").stats.valueCount).toBe(0);
  const { parseResumeFile } = await import("../src/resume-importer.js");
  const file = new File(["plain text"], "resume.txt");
  await expect(parseResumeFile(file)).rejects.toThrow("暂不支持");
});
