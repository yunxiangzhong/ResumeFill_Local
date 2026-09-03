// Local resume extraction and heuristic mapping.
// The parser intentionally returns source-aware draft data so the UI can ask
// the user to review uncertain fields before saving a new profile.

import * as pdfjsLib from "./vendor/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.mjs", import.meta.url).toString();

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_BLOCKS = 1200;
const URL_RE = /https?:\/\/[^\s)\]}>，。；]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?86[-\s]?)?1[3-9]\d{9}|(?:0\d{2,3}[-\s]?)?\d{7,8}/g;
const GPA_RE = /(?:^|[\s|｜])(?:GPA|绩点|平均学分绩点|平均学分成绩)\s*(?:[：:=]\s*|\s+)([0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?)/i;
const DATE_RE = /\d{4}\s*(?:[./年-]\s*\d{1,2}(?:\s*月)?|[./年-]\s*\d{4}|(?:-|–|—|~|至|到)\s*(?:\d{4}|至今|现在)|[./年-]\s*(?:至今|现在))/;
const RANGE_RE = /((?:19|20)\d{2}(?:[./年-]\d{1,2})?)\s*(?:-|–|—|~|至|到)\s*((?:19|20)\d{2}(?:[./年-]\d{1,2})?|至今|现在)/;

const SECTION_RULES = [
  { key: "education", title: "教育经历", patterns: [/^教育(?:经历|背景)?$/i, /^学历(?:经历)?$/i, /^education$/i] },
  { key: "intention", title: "求职意向", patterns: [/^求职意向(?:信息)?$/i, /^职业目标$/i, /^career objective$/i] },
  { key: "project", title: "项目经历/实践活动", patterns: [/^项目(?:经历|经验)?(?:[/／](?:实践活动|项目实践))?$/i, /^项目实践$/i, /^projects?$/i] },
  { key: "internship", title: "实习经历", patterns: [/^实习(?:经历)?$/i, /^工作[与/／]实习经历$/i, /^工作经历[/／]实习经历$/i, /^internships?$/i] },
  { key: "work", title: "工作经历", patterns: [/^工作经历$/i, /^工作经验$/i, /^工作经历[/／]正式工作$/i, /^work experience$/i] },
  { key: "student", title: "干部任职经历（在校职务）", patterns: [/^社团经历$/i, /^校园经历$/i, /^学生工作$/i, /^干部任职经历.*$/i, /^校园活动$/i] },
  { key: "computer", title: "计算机技能（IT技能）", patterns: [/^技能(?:特长)?$/i, /^专业技能(?:与特长)?$/i, /^技术栈$/i, /^计算机技能.*$/i, /^skills?$/i] },
  { key: "language", title: "外语能力", patterns: [/^语言能力$/i, /^英语能力$/i, /^外语能力$/i, /^languages?$/i] },
  { key: "awards", title: "奖惩情况", patterns: [/^奖惩(?:情况)?$/i, /^奖励(?:情况)?$/i, /^荣誉(?:成果|奖励)?$/i, /^荣誉与奖励$/i, /^awards?$/i] },
  { key: "certificates", title: "证书", patterns: [/^证书(?:信息|与资质)?$/i, /^资格证书$/i, /^certificates?$/i] },
  { key: "self", title: "自我描述", patterns: [/^自我(?:评价|介绍|描述)?$/i, /^个人总结$/i, /^profile$/i] },
  { key: "other", title: "其他信息", patterns: [/^其他(?:信息)?$/i, /^补充信息$/i, /^additional information$/i] }
];

export async function parseResumeFile(file, onProgress = () => {}) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("请选择 PDF、DOCX 或 Markdown 简历文件。");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("文件超过 15 MB，请先导出较小的文本版简历。");
  }
  const extension = getExtension(file.name);
  onProgress("正在读取文件…");
  let blocks;
  if (extension === "pdf") {
    blocks = await extractPdfBlocks(file, onProgress);
  } else if (extension === "docx") {
    blocks = await extractDocxBlocks(file, onProgress);
  } else if (extension === "md" || extension === "markdown") {
    blocks = extractMarkdownBlocks(await file.text());
  } else {
    throw new Error("暂不支持这种格式，请选择 .pdf、.docx、.md 或 .markdown 文件。");
  }
  if (!blocks.length || !blocks.some((block) => block.text.trim())) {
    throw new Error("没有读取到可识别的文字。扫描版 PDF 请先转换为文本 PDF。");
  }
  onProgress("正在识别栏目和经历…");
  return mapBlocksToDraft(blocks, file.name, extension);
}

function getExtension(name) {
  return String(name || "").toLowerCase().split(".").pop();
}

async function extractPdfBlocks(file, onProgress) {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data, disableWorker: true, useWorkerFetch: false, isEvalSupported: false });
  try {
    const pdf = await loadingTask.promise;
    const blocks = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress(`正在读取 PDF 第 ${pageNumber}/${pdf.numPages} 页…`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false });
      const lines = groupPdfTextItems(content.items || []);
      const annotations = await page.getAnnotations({ intent: "display" }).catch(() => []);
      for (const annotation of annotations || []) {
        if (!annotation.url) continue;
        const centerY = Array.isArray(annotation.rect) ? (annotation.rect[1] + annotation.rect[3]) / 2 : null;
        const target = lines.find((line) => centerY != null && Math.abs(line.y - centerY) < 12);
        if (target && !target.text.includes(annotation.url)) target.text = `${target.text} ${annotation.url}`;
        if (!target) lines.push({ text: annotation.url, y: centerY || 0 });
      }
      for (const line of lines) {
        const text = line.text.trim();
        // Text PDFs often expose a footer page number as a standalone line.
        // It is layout noise and should not become the tail of an experience.
        if (text && !/^\d{1,3}$/.test(text)) {
          blocks.push({ text, page: pageNumber, source: `PDF 第 ${pageNumber} 页` });
        }
      }
    }
    return blocks.slice(0, MAX_BLOCKS);
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
}

function groupPdfTextItems(items) {
  const rows = [];
  for (const item of items) {
    const text = String(item?.str || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = Number(transform[4]) || 0;
    const y = Number(transform[5]) || 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 3);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, text, width: Number(item.width) || text.length * 6 });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      let text = "";
      let previousEnd = null;
      for (const item of sorted) {
        const gap = previousEnd == null ? 0 : item.x - previousEnd;
        const separator = previousEnd != null && gap > 12 ? "  " : "";
        text += `${separator}${item.text}`;
        previousEnd = item.x + item.width;
      }
      return { text: text.replace(/ {3,}/g, "  "), y: row.y };
    });
}

async function extractDocxBlocks(file, onProgress) {
  const mammoth = globalThis.mammoth;
  if (!mammoth?.convertToHtml) {
    throw new Error("DOCX 解析组件未加载，请重新打开设置页。");
  }
  onProgress("正在读取 Word 段落和表格…");
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
    externalFileAccess: false,
    includeEmbeddedStyleMap: false
  });
  const document = new DOMParser().parseFromString(`<body>${result.value}</body>`, "text/html");
  const blocks = [];
  for (const element of document.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,tr")) {
    const text = element.tagName === "TR"
      ? [...element.querySelectorAll("th,td")].map((cell) => cleanLine(cell.textContent)).filter(Boolean).join(" | ")
      : cleanLine(element.textContent);
    if (text) blocks.push({ text, source: "DOCX", kind: /^H[1-6]$/.test(element.tagName) ? "heading" : "paragraph" });
  }
  if (result.messages?.some((message) => message.type === "error")) {
    blocks.push({ text: "[Word 解析提示] " + result.messages.map((message) => message.message).join("；"), source: "DOCX" });
  }
  return blocks.slice(0, MAX_BLOCKS);
}

function extractMarkdownBlocks(markdown) {
  return String(markdown || "")
    .replace(/^---[\s\S]*?---\s*/u, "")
    .split(/\r?\n/)
    .map((line) => {
      const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
      const text = heading ? heading[1] : line.replace(/^\s*(?:[-*+] |\d+[.)] )/, "");
      const links = [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)];
      const normalized = links.reduce((current, match) => current.replace(match[0], `${match[1]} ${match[2]}`), text)
        .replace(/[*_~`]/g, "");
      return { text: cleanLine(normalized), source: "Markdown", kind: heading ? "heading" : "paragraph" };
    })
    .filter((block) => block.text && !/^[-*_]{3,}$/.test(block.text));
}

function cleanLine(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function mapBlocksToDraft(blocks, fileName, format) {
  const lines = blocks.map((block, index) => ({ ...block, index, text: cleanLine(block.text) })).filter((block) => block.text);
  const sections = makeEmptySections();
  const sectionRanges = findSectionRanges(lines);
  const classified = new Set();
  const sectionUnclassified = [];
  for (const range of sectionRanges) {
    const sectionLines = lines.slice(range.start + 1, range.end);
    classified.add(range.start);
    sectionLines.forEach((line) => classified.add(line.index));
    if (range.key === "basic") continue;
    parseSection(range.key, sectionLines, sections, sectionUnclassified);
  }
  const basicLines = lines.filter((line) => !classified.has(line.index) && line.index < (sectionRanges[0]?.start ?? lines.length));
  parseBasic(basicLines, sections.sections.basic.values);
  const explicitGpa = findExplicitGpa(lines);
  if (explicitGpa) {
    const education = sections.sections.education;
    const educationItem = education.items[0] || item("教育经历 1", {});
    educationItem.values.GPA ||= explicitGpa.value;
    if (!education.items.length) education.items.push(educationItem);
    classified.add(explicitGpa.index);
  }
  appendUnknownLabeledLines(basicLines, "basic", sectionUnclassified);
  const unclassified = [...sectionUnclassified, ...lines
    .filter((line) => !classified.has(line.index) && !basicLines.some((candidate) => candidate.index === line.index))
    .map((line) => ({ text: line.text, source: line.source || format.toUpperCase() }))
  ].slice(0, 80);
  const confidence = calculateConfidence(sections, unclassified);
  return {
    fileName,
    format,
    profileV2: sections,
    unclassified,
    confidence,
    stats: countDraftValues(sections)
  };
}

function makeEmptySections() {
  const simple = (key, title) => ({ key, title, kind: "simple", values: {}, custom: [] });
  const repeat = (key, title) => ({ key, title, kind: "repeat", items: [] });
  return {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    sections: {
      basic: simple("basic", "基本信息"),
      intention: repeat("intention", "求职意向"),
      education: repeat("education", "教育经历"),
      internship: repeat("internship", "实习经历"),
      work: repeat("work", "工作经历"),
      performance: repeat("performance", "绩效考核"),
      project: repeat("project", "项目经历/实践活动"),
      student: repeat("student", "干部任职经历（在校职务）"),
      awards: repeat("awards", "奖惩情况"),
      language: repeat("language", "外语能力"),
      computer: repeat("computer", "计算机技能（IT技能）"),
      certificates: repeat("certificates", "证书"),
      family: repeat("family", "家庭情况"),
      training: repeat("training", "培训经历"),
      papers: repeat("papers", "论文和著作"),
      patent: repeat("patent", "专利"),
      self: simple("self", "自我描述"),
      declarations: simple("declarations", "有关声明"),
      other: simple("other", "其他信息")
    },
    customSections: []
  };
}

function findSectionRanges(lines) {
  const found = [];
  for (const [index, line] of lines.entries()) {
    const rule = SECTION_RULES.find((candidate) => candidate.patterns.some((pattern) => pattern.test(normalizeHeading(line.text))));
    if (rule) found.push({ ...rule, start: index, end: lines.length });
  }
  return found.map((range, index) => ({ ...range, end: found[index + 1]?.start ?? lines.length }));
}

function normalizeHeading(text) {
  return cleanLine(text).replace(/^#+\s*/, "").replace(/[：:]$/, "").replace(/\s*[/／]\s*/g, "/").trim();
}

function parseBasic(lines, values) {
  if (!lines.length) return;
  Object.assign(values, extractLabeledValues(lines, "basic"));
  const all = lines.map((line) => line.text).join(" ").replace(/\s+([.@])/g, "$1");
  const emails = unique(all.match(EMAIL_RE) || []);
  const phones = unique(all.match(PHONE_RE) || []).map((phone) => phone.replace(/[\s-]/g, ""));
  if (emails[0]) values["邮箱"] = emails[0];
  if (phones[0]) values["电话"] = phones[0];
  const urls = unique(all.match(URL_RE) || []);
  const github = urls.find((url) => /github\.com/i.test(url));
  const website = urls.find((url) => !/github\.com/i.test(url));
  if (github) values["GitHub"] = github;
  if (website) values["个人网站"] = website;
  const nameLine = lines.find((line) => /^[\u3400-\u9fff]{2,8}(?:\s|$)/.test(line.text) && !/(教育|经历|技能|项目|实习|社团)/.test(line.text));
  if (nameLine) values["姓名"] = nameLine.text.split(/\s+/)[0];
  const degreeLine = lines.find((line) => /(本科|硕士|博士|专科|研究生)/.test(line.text));
  if (degreeLine) {
    const degree = degreeLine.text.match(/(博士研究生|硕士研究生|研究生|本科|硕士|博士|专科)/)?.[1];
    if (degree) values["最高学历"] = degree;
  }
}

function parseSection(key, lines, sections, sectionUnclassified = []) {
  if (key === "intention") {
    const values = extractLabeledValues(lines, key);
    const first = lines.find((line) => line.text)?.text || "";
    if (!values["意向岗位"] && first && !DATE_RE.test(first) && !/^[：:]/.test(first)) {
      const inferredRole = first.split(/[｜|]/)[0].trim();
      if (inferredRole && inferredRole.length <= 80 && !/^(求职意向|职业目标)$/i.test(inferredRole)) {
        values["意向岗位"] = inferredRole;
      }
    }
    if (Object.keys(values).length) sections.sections.intention.items.push(item("求职意向 1", values));
    appendUnknownLabeledLines(lines, key, sectionUnclassified);
    return;
  }
  if (key === "computer") {
    const values = lines.filter((line) => line.text).map((line) => line.text.replace(/^[•·▪*-]\s*/, "")).join("\n");
    if (values) {
      const skillValues = { "证书名称（技能名称）": values };
      const explicitLevel = values.match(/(?:掌握程度|熟练程度|熟悉程度)[：:]\s*(精通|熟练|熟悉|了解|一般)/i)?.[1];
      if (explicitLevel) skillValues["掌握程度"] = explicitLevel;
      sections.sections.computer.items.push(item("计算机技能 1", skillValues));
    }
    const cet = lines.map((line) => line.text).join(" ").match(/(?:CET[- ]?[四四六六级]|英语四级|英语六级)[：:\s]*(\d{3})?/i);
    if (cet) sections.sections.language.items.push(item("外语能力 1", { "外语种类": "英语", "证书名称（技能名称）": cet[0].trim(), ...(cet[1] ? { 成绩: cet[1] } : {}) }));
    return;
  }
  if (key === "language") {
    const values = extractLabeledValues(lines, key);
    if (!values["外语种类"]) values["外语种类"] = lines.map((line) => line.text).join("\n");
    sections.sections.language.items.push(item("外语能力 1", values));
    return;
  }
  if (key === "self") {
    sections.sections.self.values["自我描述"] = lines.map((line) => line.text).join("\n");
    return;
  }
  if (key === "awards") {
    lines.forEach((line, index) => {
      const values = extractLabeledValues([line], key);
      if (!Object.keys(values).length) values["奖惩描述"] = line.text;
      sections.sections.awards.items.push(item(`奖惩 ${index + 1}`, values));
    });
    return;
  }
  if (key === "certificates") {
    lines.forEach((line, index) => {
      const values = extractLabeledValues([line], key);
      if (!Object.keys(values).length) values["证书名称（技能名称）"] = line.text;
      sections.sections.certificates.items.push(item(`证书 ${index + 1}`, values));
    });
    return;
  }
  if (key === "other") {
    sections.sections.other.values["补充信息"] = lines.map((line) => line.text).join("\n");
    return;
  }
  const records = splitRecords(lines, key);
  records.forEach((record, index) => sections.sections[key].items.push(item(`${sections.sections[key].title} ${index + 1}`, parseRecord(record, key))));
  if (key === "education") appendUnknownLabeledLines(lines, key, sectionUnclassified);
}

function appendUnknownLabeledLines(lines, key, target) {
  const allowed = allowedLabelsFor(key);
  for (const line of lines) {
    const match = line.text.match(/^\s*([^：:]{1,18})[：:]\s*(.+)$/);
    if (!match) continue;
    const label = normalizeLabel(match[1], key);
    const value = match[2].trim();
    if (isGpaLabel(match[1])) continue;
    if (value && !/^[*_~`]+$/.test(value) && !allowed.has(label)) {
      target.push({ text: line.text, source: line.source || key.toUpperCase() });
    }
  }
}

function splitRecords(lines, key) {
  if (!lines.length) return [];
  const records = [];
  let current = [];
  for (const line of lines) {
    const text = line.text;
    const hasSemanticHeading = current.some((candidate) => candidate.kind === "heading");
    const startsRecord = current.length > 0 && isRecordHeader(line, key)
      && !/^\d+[.)、]/.test(text)
      && !(hasSemanticHeading && line.kind !== "heading")
      && !isRoleDateLine(text)
      && !(current.length <= 2 && current.every((candidate) => isRoleOnlyLine(candidate.text)) && isCompanyDateLine(text));
    if (startsRecord) {
      records.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) records.push(current);
  return records;
}

function isRecordHeader(line, key) {
  const text = line.text;
  if (line.kind === "heading" || recordLineIsHeading(text)) return true;
  if (key === "project" && DATE_RE.test(text) && !/^[•·▪*-]/.test(text)) return true;
  if (key === "project" && /[｜|]/.test(text) && text.length <= 90 && !/项目(?:简介|内容|描述)|背景与目标/.test(text)) return true;
  if ((key === "education" || key === "internship" || key === "work" || key === "student") && DATE_RE.test(text) && !/^\d+[.)、]/.test(text)) return true;
  return false;
}

function recordLineIsHeading(text) {
  return /^#{2,6}\s/.test(text) || /^\s*【.+】\s*$/.test(text);
}

function parseRecord(record, key) {
  const text = record.map((line) => line.text).join("\n");
  const first = record[0]?.text || "";
  const values = {};
  const dates = extractDates(text);
  if (dates.start) values["开始时间"] = dates.start;
  if (dates.end) values["结束时间"] = dates.end;
  const labeled = extractLabeledValues(record, key);
  Object.assign(values, labeled);
  const url = unique(text.match(URL_RE) || [])[0];
  if (url) values["项目链接"] = url;
  if (key === "education") {
    const degree = text.match(/(博士研究生|硕士研究生|研究生|本科|硕士|博士|专科)/)?.[1];
    const school = first.match(/([\u3400-\u9fffA-Za-z·（）()]{2,40}(?:大学|学院|学校))/)?.[1];
    const major = first.match(/(?:大学|学院|学校)\s+([^|｜\n]+?)(?:\s*[·|｜]\s*|\s+)(本科|硕士|博士|研究生|专科)/)?.[1]
      || text.match(/([^\n|｜]+?)\s*[·•]\s*(?:本科|硕士|博士|研究生|专科)/)?.[1];
    if (school) values["学校"] = school;
    if (major) values["专业"] = major.trim();
    if (degree) values["学历"] = degree;
    const gpa = findExplicitGpa(record)?.value || text.match(GPA_RE)?.[1]?.trim();
    if (gpa) values.GPA = gpa;
    const courseIndex = record.findIndex((line) => /核心课程|专业课程/.test(line.text));
    if (courseIndex >= 0) {
      const courseText = record.slice(courseIndex).map((line, index) => index === 0
        ? line.text.replace(/^.*?(核心课程|专业课程)\s*[*_~`]*\s*(?:[：:]\s*)?/, "")
        : line.text).filter(Boolean).join("\n");
      if (courseText) values["专业课程"] = courseText;
    }
  } else if (key === "project") {
    const header = first.replace(/^#+\s*/, "");
    const headerWithoutDate = header.replace(RANGE_RE, "").replace(/(?:19|20)\d{2}(?:[./年-]\d{1,2})?/g, "").trim();
    const roleSource = record.slice(0, 3).map((line) => line.text).join(" ");
    const role = roleSource.match(/(?:队长|主程|负责人|核心开发|开发|成员|实习生|工程师|组长)/i)?.[0];
    const name = (headerWithoutDate.split(/[｜|]/)[0] || headerWithoutDate)
      .replace(/(?:队长|主程|负责人|核心开发|开发|成员|实习生|工程师|学生|组长)\s*$/i, "")
      .trim();
    if (name) values["项目名称"] = name;
    if (role) values["职位"] = role;
    const description = record
      .filter((line) => !isHeaderLike(line.text, line.kind) && !isProjectLinkLine(line.text))
      .map((line) => line.text)
      .join("\n");
    if (description) values["项目内容"] = description;
  } else {
    const companySource = record.find((line) => /(?:有限公司|公司)/.test(line.text))?.text
      || record.find((line) => /(?:大学|学院|战队|团队|工作室)/.test(line.text))?.text
      || first;
    const company = companySource.match(/([\u3400-\u9fffA-Za-z·（）()]{2,50}(?:公司|大学|学院|战队|团队|工作室|有限公司))/)?.[1];
    if (company) values[key === "student" ? "组织名称" : "公司"] = company;
    const role = text.match(/(数据分析师|工程师|实习生|队员|负责人|主程|开发|助理|经理|专员)/i)?.[1];
    if (role) values["职位"] = role;
    const detail = record
      .filter((line, index) => index > 0 && !isHeaderLike(line.text, line.kind))
      .map((line) => line.text)
      .join("\n");
    if (detail) values["工作内容"] = detail;
  }
  return values;
}

function extractLabeledValues(record, key) {
  const values = {};
  const allowed = allowedLabelsFor(key);
  for (const line of record) {
    if (/^\s*\d+[.)、]/.test(line.text)) continue;
    const match = line.text.match(/^\s*([^：:]{1,18})[：:]\s*(.+)$/);
    if (!match) continue;
    const label = normalizeLabel(match[1], key);
    const value = match[2].trim();
    if (allowed.has(label) && value && !/^[*_~`]+$/.test(value)) values[label] = value;
  }
  return values;
}

function findExplicitGpa(lines) {
  for (const line of lines || []) {
    const match = String(line?.text || "").match(GPA_RE);
    if (match?.[1]) return { value: match[1].replace(/\s+/g, ""), index: line.index };
  }
  return null;
}

function isGpaLabel(label) {
  return /^(?:GPA|绩点|平均学分绩点|平均学分成绩)$/i.test(cleanLine(label).replace(/[*_~`]/g, ""));
}

function allowedLabelsFor(key) {
  if (key === "project") {
    return new Set(["项目内容", "本人职责", "项目成果", "技术栈", "项目链接", "项目名称", "职位", "开始时间", "结束时间", "部门", "参与人数", "实践方式", "证明人姓名", "证明人职位", "证明人联系方式"]);
  }
  if (key === "education") {
    return new Set(["专业课程", "学校", "专业", "学号", "学制", "城市", "学位", "学历", "学习形式", "学校类别", "录取批次", "学院（院系）", "培养方式", "专业描述", "研究方向", "毕业论文", "成绩", "GPA", "班级排名", "专业排名", "学历证书编号", "学位证书编号", "辅导员姓名", "辅导员联系方式", "是否为海外教育经历", "升学类型", "考试分数", "是否有转学经历", "开始时间", "结束时间"]);
  }
  if (key === "intention") {
    return new Set(["意向岗位", "预计入职时间", "当前薪资", "期望工作城市", "期望薪资", "面试城市", "是否接受调剂"]);
  }
  if (key === "awards") {
    return new Set(["奖惩时间", "奖惩名称", "颁奖单位", "奖励等级", "奖惩描述", "证明人"]);
  }
  if (key === "language") {
    return new Set(["获得时间", "外语种类", "证书名称（技能名称）", "成绩", "掌握程度", "听说能力", "读写能力", "有效期"]);
  }
  if (key === "certificates") {
    return new Set(["证书获得时间", "证书名称（技能名称）", "证书编号", "授予单位", "证书说明"]);
  }
  if (key === "basic") {
    return new Set(["姓名", "性别", "出生日期", "民族", "国籍（国家或地区）", "电话", "邮箱", "微信号", "QQ", "证件号码类型", "证件号码", "政治面貌", "婚姻状况", "户籍", "籍贯", "生源地", "现居住城市", "现居住详细地址", "通讯地址", "邮政编码", "身高", "体重", "血型", "健康状况", "特长", "兴趣爱好", "个人网站", "GitHub"]);
  }
  if (key === "student") {
    return new Set(["工作内容", "本人职责", "组织名称", "职位", "开始时间", "结束时间"]);
  }
  return new Set(["工作内容", "工作成果", "本人职责", "公司", "部门", "行业", "地点", "工资", "职位", "证明人姓名", "证明人职位", "证明人联系方式", "离职原因", "组织名称", "开始时间", "结束时间"]);
}

function normalizeLabel(label, key = "") {
  const text = cleanLine(label).replace(/[*_~`]/g, "");
  if (key === "basic") {
    const basicMappings = [
      ["姓名", "姓名"], ["名字", "姓名"], ["手机号码", "电话"], ["手机", "电话"], ["联系电话", "电话"], ["联系方式", "电话"],
      ["电子邮箱", "邮箱"], ["E-mail", "邮箱"], ["Email", "邮箱"], ["个人主页", "个人网站"], ["网站", "个人网站"], ["主页", "个人网站"],
      ["GitHub地址", "GitHub"], ["Github", "GitHub"], ["微信", "微信号"], ["QQ号", "QQ"], ["出生年月", "出生日期"],
      ["现居地", "现居住城市"], ["所在城市", "现居住城市"], ["身份证号", "证件号码"]
    ];
    return basicMappings.find(([pattern]) => text.toLowerCase().includes(pattern.toLowerCase()))?.[1] || text;
  }
  if (key === "intention") {
    const intentionMappings = [
      ["意向岗位", "意向岗位"], ["目标岗位", "意向岗位"], ["应聘岗位", "意向岗位"], ["求职岗位", "意向岗位"], ["岗位", "意向岗位"],
      ["预计入职时间", "预计入职时间"], ["到岗时间", "预计入职时间"], ["入职时间", "预计入职时间"],
      ["当前薪资", "当前薪资"], ["目前薪资", "当前薪资"], ["期望工作城市", "期望工作城市"], ["意向城市", "期望工作城市"], ["工作城市", "期望工作城市"],
      ["期望薪资", "期望薪资"], ["期望工资", "期望薪资"], ["薪资要求", "期望薪资"], ["面试城市", "面试城市"], ["是否接受调剂", "是否接受调剂"], ["接受调剂", "是否接受调剂"]
    ];
    return intentionMappings.find(([pattern]) => text.toLowerCase().includes(pattern.toLowerCase()))?.[1] || text;
  }
  if (key === "education") {
    const educationMappings = [
      ["毕业院校", "学校"], ["院校", "学校"], ["专业名称", "专业"], ["学位", "学位"], ["学历", "学历"], ["核心课程", "专业课程"],
      ["GPA", "GPA"], ["绩点", "GPA"], ["平均学分绩点", "GPA"], ["平均学分成绩", "GPA"],
      ["学院", "学院（院系）"], ["院系", "学院（院系）"], ["专业说明", "专业描述"], ["专业介绍", "专业描述"],
      ["平均成绩", "成绩"], ["班级排名", "班级排名"], ["专业排名", "专业排名"]
    ];
    return educationMappings.find(([pattern]) => text.includes(pattern))?.[1] || text;
  }
  if (key === "project") {
    const projectMappings = [["项目名称", "项目名称"], ["项目角色", "职位"], ["项目岗位", "职位"], ["角色", "职位"]];
    return projectMappings.find(([pattern]) => text.includes(pattern))?.[1] || text;
  }
  if (["internship", "work", "student"].includes(key)) {
    const experienceMappings = [["单位名称", "公司"], ["所在单位", "公司"], ["所在部门", "部门"], ["岗位名称", "职位"], ["工作职位", "职位"], ["职称", "职位"]];
    return experienceMappings.find(([pattern]) => text.includes(pattern))?.[1] || text;
  }
  if (key === "awards") {
    const awardMappings = [["获奖时间", "奖惩时间"], ["奖项名称", "奖惩名称"], ["奖项", "奖惩名称"], ["颁发单位", "颁奖单位"], ["等级", "奖励等级"]];
    return awardMappings.find(([pattern]) => text.includes(pattern))?.[1] || text;
  }
  if (key === "language") {
    const languageMappings = [["语言", "外语种类"], ["语种", "外语种类"], ["考试名称", "证书名称（技能名称）"], ["考试成绩", "成绩"], ["熟练程度", "掌握程度"]];
    return languageMappings.find(([pattern]) => text.includes(pattern))?.[1] || text;
  }
  if (key === "certificates") {
    const certificateMappings = [["获得时间", "证书获得时间"], ["证书名称", "证书名称（技能名称）"], ["证书编号", "证书编号"], ["发证单位", "授予单位"], ["证书说明", "证书说明"]];
    return certificateMappings.find(([pattern]) => text.includes(pattern))?.[1] || text;
  }
  const mappings = [
    ["项目简介", "项目内容"], ["项目内容", "项目内容"], ["项目描述", "项目内容"], ["背景与目标", "项目内容"],
    ["主要工作", "本人职责"], ["本人职责", "本人职责"], ["项目成果", "项目成果"], ["工作成果", "工作成果"],
    ["核心课程", "专业课程"], ["技术栈", "技术栈"], ["项目链接", "项目链接"], ["链接", "项目链接"]
  ];
  const mapped = mappings.find(([pattern]) => text.includes(pattern))?.[1] || text;
  if (key !== "project" && mapped === "项目内容") return "工作内容";
  return mapped;
}

function extractDates(text) {
  const range = text.match(RANGE_RE);
  if (range) return { start: normalizeDate(range[1]), end: normalizeDate(range[2]) };
  const singles = [...text.matchAll(/((?:19|20)\d{2}(?:[./年-]\d{1,2})?)/g)];
  const single = singles.find((match) => /[./-]\d{1,2}$/.test(match[1])) || singles.at(-1);
  return single ? { start: normalizeDate(single[1]), end: "" } : { start: "", end: "" };
}

function normalizeDate(value) {
  const text = String(value || "").trim().replace(/[年月]/g, "-").replace(/[./]/g, "-").replace(/-$/, "");
  const match = text.match(/^(\d{4})(?:-(\d{1,2}))?$/);
  if (!match) return /至今|现在/.test(text) ? "至今" : text;
  return match[2] ? `${match[1]}-${match[2].padStart(2, "0")}` : match[1];
}

function isHeaderLike(text, kind = "") {
  return kind === "heading" || /^#+\s/.test(text) || DATE_RE.test(text) || /^(项目链接|项目地址)$/i.test(text);
}

function isProjectLinkLine(text) {
  const normalized = cleanLine(text).replace(/[*_~`]/g, "");
  return /^(?:项目链接|项目地址|链接)(?:\s+|\s*[：:]|$)/i.test(normalized);
}

function isRoleDateLine(text) {
  return /^(?:队长|主程|负责人|核心开发|开发|成员|实习生|工程师|学生|组长|数据分析师|助理|专员)(?:\s|$|｜|\||：|:)[\s｜|：:]*?(?:三等奖|一等奖|二等奖|优秀|校企合作项目)?[\s｜|：:]*?(?:19|20)\d{2}/i.test(text);
}

function isRoleOnlyLine(text) {
  return /^(?:队长|主程|负责人|核心开发|开发|成员|实习生|工程师|学生|组长|数据分析师|助理|专员)(?:\s|$|｜|\||：|:)/i.test(text)
    && !/(?:项目|工作|职责|简介|背景)/.test(text);
}

function isCompanyDateLine(text) {
  return /(?:公司|有限公司|大学|学院|战队|团队|工作室)\s+.*(?:19|20)\d{2}/.test(text);
}

function item(title, values) {
  return { id: `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, title, values, custom: [] };
}

function unique(values) {
  return [...new Set((values || []).map((value) => String(value).trim()).filter(Boolean))];
}

function countDraftValues(profile) {
  let valueCount = 0;
  let itemCount = 0;
  for (const section of Object.values(profile.sections || {})) {
    if (section.kind === "repeat") {
      itemCount += section.items.length;
      valueCount += section.items.reduce((sum, current) => sum + Object.keys(current.values || {}).length, 0);
    } else {
      valueCount += Object.keys(section.values || {}).length;
    }
  }
  return { valueCount, itemCount };
}

function calculateConfidence(profile, unclassified) {
  const stats = countDraftValues(profile);
  const base = stats.valueCount ? Math.min(0.97, 0.56 + stats.valueCount / 75) : 0.25;
  return Math.max(0.15, Number((base - Math.min(0.25, unclassified.length / 300)).toFixed(2)));
}

export const __test__ = { extractPdfBlocks, extractMarkdownBlocks, groupPdfTextItems, mapBlocksToDraft, normalizeDate, parseRecord };
