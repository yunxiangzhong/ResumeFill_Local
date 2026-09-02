const fields = {
  saveProfileButton: document.getElementById("saveProfile"),
  profileSectionEditor: document.getElementById("profileSectionEditor"),
  profileSelect: document.getElementById("profileSelect"),
  newProfileButton: document.getElementById("newProfile"),
  renameProfileButton: document.getElementById("renameProfile"),
  deleteProfileButton: document.getElementById("deleteProfile"),
  profileManagerFeedback: document.getElementById("profileManagerFeedback"),
  profileNav: document.getElementById("profileNav"),
  profileTips: document.getElementById("profileTips"),
  profileFileInput: document.getElementById("profileFileInput"),
  profileFeedback: document.getElementById("profileFeedback"),
  toast: document.getElementById("toast"),
  status: document.getElementById("status")
};

const PROFILE_SCHEMA_VERSION = 2;
const LEGACY_PROFILE_BACKUP_FORMAT = "OpenJobAutofillProfileBackup";
const SAVE_PROFILE_LABEL = fields.saveProfileButton?.textContent || "保存资料";

const RESUME_SECTION_GUIDE = [
  {
    key: "basic",
    title: "基本信息",
    aliases: ["个人信息", "联系方式"],
    tips: ["姓名、电话、邮箱、证件号建议放在这里。", "同一个值可以写多个常见字段名，例如“电话”和“手机号码”，方便不同网站匹配。"]
  },
  {
    key: "intention",
    title: "求职意向",
    aliases: ["求职意向 添加"],
    tips: ["岗位、城市、薪资、到岗时间和调剂意愿都放这里。", "如果不同公司岗位叫法不同，可以追加“目标岗位”“应聘岗位”等别名。"]
  },
  {
    key: "education",
    title: "教育经历",
    aliases: ["教育背景", "学历经历"],
    tips: ["按最高学历到较早学历排序。", "每段经历用“添加一条”维护，学校、专业、学历、学位、时间尽量写全。"]
  },
  {
    key: "internship",
    title: "实习经历",
    aliases: ["工作/实习经历", "实践经历"],
    tips: ["公司、部门、岗位、时间、地点、工作内容和成果是高频字段。", "证明人信息如果愿意提供，也可以作为字段追加。"]
  },
  {
    key: "work",
    title: "工作经历",
    aliases: ["正式工作经历"],
    tips: ["应届生没有正式工作经历可以留空。", "留空模块不会影响资料保存，后续需要时再补。"]
  },
  {
    key: "performance",
    title: "绩效考核",
    aliases: ["年度绩效", "绩效信息"],
    tips: ["社招或有正式工作经历时再填写，常见字段是考核年度、等级、排名和证明人。", "如果页面只有一两项绩效字段，也建议在这里单独维护，避免和普通工作经历证明人串填。"]
  },
  {
    key: "project",
    title: "项目经历/实践活动",
    aliases: ["项目经历", "实践活动"],
    tips: ["项目名、角色、项目内容、本人职责、项目成果最好分开写。", "如果网站要求“实践方式”，也可以直接加一行。"]
  },
  {
    key: "student",
    title: "干部任职经历（在校职务）",
    aliases: ["学生工作", "干部任职经历", "在校职务", "社团工作"],
    tips: ["学生会、班委、社团、干部任职都可以放这里。", "不同网站可能叫“学生工作”“在校职务”或“干部任职经历”。"]
  },
  {
    key: "awards",
    title: "奖惩情况",
    aliases: ["奖励情况", "荣誉成果"],
    tips: ["建议按时间倒序填写。", "奖项名称、颁奖单位、等级、描述拆开写，自动匹配更稳。"]
  },
  {
    key: "language",
    title: "外语能力",
    aliases: ["语言能力", "英语能力"],
    tips: ["CET、TOEFL、IELTS、GRE、GMAT 都建议写成单独字段。", "如果没有参加某项考试，可以写 `TOEFL：未参加`。"]
  },
  {
    key: "computer",
    title: "计算机技能（IT技能）",
    aliases: ["计算机技能", "IT技能", "证书技能"],
    tips: ["计算机技能通常可以添加多条。", "通用技能长描述建议放到“其他信息”的“爱好及专长”，具体证书放到“证书”模块。"]
  },
  {
    key: "certificates",
    title: "证书",
    aliases: ["证书信息", "资格证书"],
    tips: ["适合放职业资格证、技能证书、荣誉证书。", "证书编号、授予单位和证书说明不是每个网站都要求，但有就可以写。"]
  },
  {
    key: "family",
    title: "家庭情况",
    aliases: ["家庭信息", "家庭及社会关系"],
    tips: ["每位家庭成员用一条记录维护。", "常见字段是姓名、关系、出生日期、电话、工作单位、职务、政治面貌。"]
  },
  {
    key: "training",
    title: "培训经历",
    aliases: ["培训"],
    tips: ["没有培训经历可以留空。", "如果公司表单要求培训经历，按时间、机构、课程、内容拆分最容易匹配。"]
  },
  {
    key: "papers",
    title: "论文和著作",
    aliases: ["论文著作", "论文"],
    tips: ["没有论文著作可以留空。", "刊物名称、论文名称和描述拆开写，方便复制到不同字段。"]
  },
  {
    key: "patent",
    title: "专利",
    aliases: ["专利成果"],
    tips: ["没有专利可以留空。", "如果有多个专利，继续点击“添加一条”。"]
  },
  {
    key: "self",
    title: "自我描述",
    aliases: ["自我评价", "自我介绍"],
    tips: ["这类内容主要是提醒和复制，不一定适合完全自动填写。", "建议写成 2 到 4 句短句，便于按字数要求裁剪。"]
  },
  {
    key: "declarations",
    title: "有关声明",
    aliases: ["个人声明", "声明"],
    tips: ["声明类问题通常要认真核对，不建议盲填。", "行业或公司专属措辞建议统一写成“应聘单位”。"]
  },
  {
    key: "other",
    title: "其他信息",
    aliases: ["补充信息", "自定义资料"],
    tips: ["放没有固定归属但经常会用到的信息。", "如果某类信息越来越多，可以用自定义字段或后续新增模块承载。"]
  }
];

const STRUCTURED_RESUME_SECTIONS = [
  {
    key: "basic",
    title: "基本信息",
    kind: "simple",
    fields: profileFields([
      "姓名",
      "姓",
      "名",
      "英文名",
      "姓（拼音）",
      "名（拼音）",
      "性别",
      "出生日期",
      "民族",
      "国籍（国家或地区）",
      "电话",
      "邮箱",
      "微信号",
      "QQ",
      "证件号码类型",
      "证件号码",
      "政治面貌",
      "取得政治面貌时间",
      "婚姻状况",
      "户籍",
      "户籍类型",
      "籍贯",
      "生源地",
      "现居住城市",
      "现居住详细地址",
      "通讯地址",
      "邮政编码",
      "人事档案所在单位",
      "身高",
      "体重",
      "血型",
      "健康状况",
      "特长",
      "兴趣爱好",
      "高考时间",
      "高考分数",
      "高考科目",
      "工作年限",
      "专业技术职称",
      "紧急联系人",
      "紧急联系人电话",
      "与紧急联系人关系"
    ])
  },
  {
    key: "intention",
    title: "求职意向",
    kind: "repeat",
    itemLabel: "求职意向",
    defaultItems: 1,
    fields: profileFields(["意向岗位", "预计入职时间", "当前薪资", "期望工作城市", "期望薪资", "面试城市", "是否接受调剂"])
  },
  {
    key: "education",
    title: "教育经历",
    kind: "repeat",
    itemLabel: "教育经历",
    defaultItems: 1,
    fields: profileFields([
      "开始时间",
      "结束时间",
      "学校",
      "专业",
      "学号",
      "学制",
      "城市",
      "学位",
      "学历",
      "学习形式",
      "学校类别",
      "录取批次",
      "学院（院系）",
      "培养方式",
      "专业描述",
      "专业课程",
      "研究方向",
      "毕业论文",
      "成绩",
      "班级排名",
      "专业排名",
      "学历证书编号",
      "学位证书编号",
      "辅导员姓名",
      "辅导员联系方式",
      "是否为海外教育经历",
      "升学类型",
      "考试分数",
      "是否有转学经历"
    ])
  },
  {
    key: "internship",
    title: "实习经历",
    kind: "repeat",
    itemLabel: "实习经历",
    defaultItems: 1,
    fields: profileFields([
      "开始时间",
      "结束时间",
      "公司",
      "部门",
      "行业",
      "地点",
      "工资",
      "职位",
      "工作内容",
      "工作成果",
      "证明人姓名",
      "证明人职位",
      "证明人联系方式",
      "离职原因"
    ])
  },
  {
    key: "work",
    title: "工作经历",
    kind: "repeat",
    itemLabel: "工作经历",
    defaultItems: 1,
    fields: profileFields([
      "开始时间",
      "结束时间",
      "公司",
      "部门",
      "行业",
      "地点",
      "工资",
      "职位",
      "工作内容",
      "工作成果",
      "证明人姓名",
      "证明人职位",
      "证明人联系方式",
      "离职原因"
    ])
  },
  {
    key: "performance",
    title: "绩效考核",
    kind: "repeat",
    itemLabel: "绩效考核",
    defaultItems: 1,
    fields: profileFields([
      "考核年度",
      "绩效考核等级",
      "年度绩效排名",
      "绩效证明人",
      "绩效证明人联系方式",
      "绩效说明"
    ])
  },
  {
    key: "project",
    title: "项目经历/实践活动",
    kind: "repeat",
    itemLabel: "项目经历",
    defaultItems: 1,
    fields: profileFields([
      "开始时间",
      "结束时间",
      "职位",
      "部门",
      "项目名称",
      "参与人数",
      "项目内容",
      "实践方式",
      "本人职责",
      "项目成果",
      "项目链接",
      "证明人姓名",
      "证明人职位",
      "证明人联系方式"
    ])
  },
  {
    key: "student",
    title: "干部任职经历（在校职务）",
    kind: "repeat",
    itemLabel: "干部任职经历",
    defaultItems: 1,
    fields: profileFields(["开始时间", "结束时间", "组织名称", "职位", "工作内容", "本人职责"])
  },
  {
    key: "awards",
    title: "奖惩情况",
    kind: "repeat",
    itemLabel: "奖惩",
    defaultItems: 1,
    fields: profileFields(["奖惩时间", "奖惩名称", "颁奖单位", "奖励等级", "奖惩描述", "证明人"])
  },
  {
    key: "language",
    title: "外语能力",
    kind: "repeat",
    itemLabel: "外语能力",
    defaultItems: 1,
    fields: profileFields(["获得时间", "外语种类", "证书名称（技能名称）", "成绩", "掌握程度", "听说能力", "读写能力", "有效期"])
  },
  {
    key: "computer",
    title: "计算机技能（IT技能）",
    kind: "repeat",
    itemLabel: "计算机技能",
    defaultItems: 1,
    fields: profileFields(["获得时间", "证书名称（技能名称）", "成绩", "掌握程度"])
  },
  {
    key: "certificates",
    title: "证书",
    kind: "repeat",
    itemLabel: "证书",
    defaultItems: 1,
    fields: profileFields(["证书获得时间", "证书名称（技能名称）", "证书编号", "授予单位", "证书说明"])
  },
  {
    key: "family",
    title: "家庭情况",
    kind: "repeat",
    itemLabel: "家庭情况",
    defaultItems: 2,
    fields: profileFields(["姓名", "关系", "出生日期", "电话", "公司", "职位", "政治面貌", "联系地址"])
  },
  {
    key: "training",
    title: "培训经历",
    kind: "repeat",
    itemLabel: "培训经历",
    defaultItems: 1,
    fields: profileFields(["开始时间", "结束时间", "培训名称", "培训机构", "培训地点", "培训课程", "培训获得证书", "培训内容"])
  },
  {
    key: "papers",
    title: "论文和著作",
    kind: "repeat",
    itemLabel: "论文和著作",
    defaultItems: 1,
    fields: profileFields(["发表时间", "刊物名称", "刊物层级", "论文名称", "论文描述"])
  },
  {
    key: "patent",
    title: "专利",
    kind: "repeat",
    itemLabel: "专利",
    defaultItems: 1,
    fields: profileFields(["发表时间", "专利名称", "专利编号", "专利类型", "专利成果"])
  },
  {
    key: "self",
    title: "自我描述",
    kind: "simple",
    fields: profileFields(["自我描述", "自我评价"])
  },
  {
    key: "declarations",
    title: "有关声明",
    kind: "simple",
    fields: profileFields([
      "是否存在亲属在应聘单位工作",
      "是否患有影响工作的疾病",
      "是否存在不良行为记录",
      "是否享有境外长期或永久居留权",
      "是否拥有外国国籍",
      "是否拥有境外永久居留权",
      "是否同意背景调查",
      "本人声明以上填写内容与事实完全相符"
    ])
  },
  {
    key: "other",
    title: "其他信息",
    kind: "simple",
    fields: profileFields([
      "受到奖励/学术成果",
      "社会/校园活动",
      "爱好及专长",
      "招聘信息来源",
      "GitHub",
      "个人主页"
    ])
  }
];

let activeProfileSectionKey = "";
let profileSectionSyncFrame = 0;
let profileHasUnsavedChanges = false;
let profileEditorBaseline = null;
let profileLoadedId = "";
let profileLoadedRevision = 0;
let profileSaveFeedbackTimer = 0;
let toastTimer = 0;

fields.saveProfileButton.addEventListener("click", saveProfile);
document.getElementById("exportProfile").addEventListener("click", exportProfile);
document.getElementById("importProfile").addEventListener("click", () => fields.profileFileInput.click());
document.getElementById("resetProfile").addEventListener("click", resetProfile);
document.getElementById("clearLocalData").addEventListener("click", clearLocalData);
fields.profileSelect?.addEventListener("change", () => void switchActiveProfile(fields.profileSelect.value));
fields.newProfileButton?.addEventListener("click", () => void createNewProfile());
fields.renameProfileButton?.addEventListener("click", () => void renameActiveProfile());
fields.deleteProfileButton?.addEventListener("click", () => void removeActiveProfile());
fields.profileFileInput.addEventListener("change", importProfileFromFile);
fields.profileSectionEditor.addEventListener("input", handleProfileEditorInput);
fields.profileSectionEditor.addEventListener("focusin", handleProfileSectionFocus);
fields.profileSectionEditor.addEventListener("click", handleStructuredProfileClick);
window.addEventListener("scroll", scheduleProfileSectionSync, { passive: true });
window.addEventListener("resize", scheduleProfileSectionSync);

loadSettings();

function renderProfileManager(settings = {}) {
  if (!fields.profileSelect) {
    return;
  }
  const profiles = Array.isArray(settings.profiles) ? settings.profiles : [];
  if (settings.activeProfileId) {
    profileLoadedId = settings.activeProfileId;
  }
  if (settings.revision != null && Number.isFinite(Number(settings.revision))) {
    profileLoadedRevision = Number(settings.revision);
  }
  fields.profileSelect.replaceChildren();
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.name}（${profile.valueCount || 0} 项）`;
    option.selected = profile.id === settings.activeProfileId;
    fields.profileSelect.append(option);
  }
  const disabled = profiles.length <= 1;
  if (fields.deleteProfileButton) {
    fields.deleteProfileButton.disabled = disabled;
  }
  setProfileManagerFeedback(`已加载 ${profiles.length || 1} 份简历，当前资料只保存在本机。`);
}

function setProfileManagerFeedback(message, isError = false) {
  if (!fields.profileManagerFeedback) {
    return;
  }
  fields.profileManagerFeedback.textContent = message;
  fields.profileManagerFeedback.classList.toggle("error", isError);
}

function confirmProfileSwitch() {
  return !profileHasUnsavedChanges || window.confirm("当前简历有未保存修改，切换后这些修改会丢失。是否继续？");
}

async function switchActiveProfile(id) {
  if (!id) {
    return;
  }
  if (!confirmProfileSwitch()) {
    // Restore only the select value. The editor remains untouched so a
    // cancelled switch never discards the current draft.
    if (fields.profileSelect && profileLoadedId) {
      fields.profileSelect.value = profileLoadedId;
    }
    return;
  }
  try {
    setProfileManagerFeedback("正在切换...");
    const settings = await sendRuntimeMessage({
      type: "OJAF_SWITCH_PROFILE",
      payload: { id, expectedRevision: profileLoadedRevision }
    });
    renderProfileManager(settings);
    renderProfileSectionEditor(settings.profileV2);
    setProfileSaved("已切换简历，资料保存在本机。");
    setStatus(`已切换到 ${getActiveProfileName(settings)}。`);
  } catch (error) {
    setProfileManagerFeedback(`切换失败：${error.message}`, true);
    await loadSettings();
  }
}

async function createNewProfile() {
  if (!confirmProfileSwitch()) {
    return;
  }
  const name = window.prompt("请输入新简历名称", "简历");
  if (name == null || !name.trim()) {
    return;
  }
  try {
    const settings = await sendRuntimeMessage({
      type: "OJAF_CREATE_PROFILE",
      payload: { name, expectedRevision: profileLoadedRevision }
    });
    renderProfileManager(settings);
    renderProfileSectionEditor(settings.profileV2);
    setProfileSaved("已创建空白简历。请填写后保存。");
    setStatus(`已创建 ${getActiveProfileName(settings)}。`);
  } catch (error) {
    setProfileManagerFeedback(`新建失败：${error.message}`, true);
  }
}

async function renameActiveProfile() {
  const current = fields.profileSelect?.selectedOptions?.[0]?.textContent?.replace(/（.*$/, "") || "简历";
  const name = window.prompt("请输入新的简历名称", current);
  if (name == null || !name.trim()) {
    return;
  }
  try {
    const settings = await sendRuntimeMessage({
      type: "OJAF_RENAME_PROFILE",
      payload: {
        id: fields.profileSelect?.value,
        name,
        expectedRevision: profileLoadedRevision
      }
    });
    renderProfileManager(settings);
    setStatus(`已将简历重命名为 ${getActiveProfileName(settings)}。`);
  } catch (error) {
    setProfileManagerFeedback(`重命名失败：${error.message}`, true);
  }
}

async function removeActiveProfile() {
  const id = fields.profileSelect?.value;
  if (!id || !window.confirm("删除当前简历及其本机资料？此操作不可恢复，请先导出备份。")) {
    return;
  }
  try {
    const settings = await sendRuntimeMessage({
      type: "OJAF_DELETE_PROFILE",
      payload: { id, expectedRevision: profileLoadedRevision }
    });
    renderProfileManager(settings);
    renderProfileSectionEditor(settings.profileV2);
    setProfileSaved("已切换到保留的简历。");
    setStatus("已删除选中的本机简历。");
  } catch (error) {
    setProfileManagerFeedback(`删除失败：${error.message}`, true);
  }
}

function getActiveProfileName(settings = {}) {
  return settings.profiles?.find((profile) => profile.id === settings.activeProfileId)?.name || "当前简历";
}

window.addEventListener("beforeunload", (event) => {
  if (!profileHasUnsavedChanges) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

async function loadSettings() {
  try {
    const settings = await sendRuntimeMessage({ type: "OJAF_GET_SETTINGS" });
    renderProfileManager(settings);
    renderProfileNav();
    renderProfileTips(RESUME_SECTION_GUIDE[0]?.key);
    renderProfileSectionEditor(settings.profileV2);
    setProfileSaved("资料已加载，当前没有未保存修改。");
    scheduleProfileSectionSync();
    setStatus("设置已加载。");
  } catch (error) {
    setStatus(`加载失败：${error.message}`, true);
  }
}

async function saveProfile() {
  let saved = false;
  try {
    setProfileSaving(true);
    setProfileFeedback("正在保存资料...", "busy");
    showToast("正在保存资料...", "busy", 1600);
    const profileV2 = collectProfileV2FromEditor();
    const savedSettings = await sendRuntimeMessage({
      type: "OJAF_SAVE_SETTINGS",
      payload: {
        profileV2,
        profileId: profileLoadedId,
        expectedRevision: profileLoadedRevision
      }
    });
    profileEditorBaseline = cloneProfileData(savedSettings?.profileV2 || profileV2);
    renderProfileManager(savedSettings);
    saved = true;
    setStatus("简历资料保存成功，已保存到本机浏览器。");
    setProfileSaved("资料已保存到本机。");
    showToast("资料已保存到本机。");
  } catch (error) {
    setStatus(`保存资料失败：${error.message}`, true);
    setProfileFeedback(`保存资料失败：${error.message}`, "error");
    showToast(`保存资料失败：${error.message}`, "error");
  }
  finally {
    setProfileSaving(false);
  }
  return saved;
}

async function exportProfile() {
  try {
    if (profileHasUnsavedChanges) {
      const shouldSave = window.confirm("当前简历有未保存修改。导出前先保存吗？");
      if (shouldSave) {
        if (!(await saveProfile())) {
          return;
        }
      } else {
        setStatus("导出已取消：请先保存当前修改。", true);
        return;
      }
    }
    const profilesData = await sendRuntimeMessage({ type: "OJAF_GET_ALL_PROFILES" });
    const backup = createProfileBackup(profilesData);
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `resumefill-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("已导出本地资料备份。");
  } catch (error) {
    setStatus(`导出失败：${error.message}`, true);
  }
}

async function importProfileFromFile() {
  const file = fields.profileFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const imported = parseImportedProfileBackup(text);
    if (imported.profiles) {
      if (!window.confirm(`这会替换本机现有的 ${imported.profiles.length} 份简历，是否继续？`)) {
        return;
      }
      const settings = await sendRuntimeMessage({
        type: "OJAF_IMPORT_PROFILES",
        payload: { ...imported, expectedRevision: profileLoadedRevision }
      });
      renderProfileManager(settings);
      renderProfileSectionEditor(settings.profileV2);
    } else {
      const savedSettings = await sendRuntimeMessage({
        type: "OJAF_SAVE_SETTINGS",
        payload: {
          profileV2: imported.profileV2,
          profileId: profileLoadedId,
          expectedRevision: profileLoadedRevision
        }
      });
      renderProfileManager(savedSettings);
      renderProfileSectionEditor(savedSettings.profileV2);
    }
    setStatus("已导入并保存到本机。");
    setProfileSaved("资料已导入并保存到本机。");
    showToast("资料已导入并保存到本机。");
  } catch (error) {
    setStatus(`导入失败：${error.message}`, true);
    setProfileFeedback(`导入失败：${error.message}`, "error");
    showToast(`导入失败：${error.message}`, "error");
  } finally {
    fields.profileFileInput.value = "";
  }
}

function resetProfile() {
  const confirmed = window.confirm("这会用空白模板覆盖当前资料编辑区，是否继续？");
  if (!confirmed) {
    return;
  }

  renderProfileSectionEditor(createEmptyProfileV2());
  setProfileDirty("已恢复空白模板，记得点击保存资料。");
  setStatus("已恢复空白模板。点击保存后生效。");
}

async function clearLocalData() {
  const confirmed = window.confirm("这会清空当前浏览器保存的全部简历资料，只影响当前浏览器。是否继续？");
  if (!confirmed) {
    return;
  }

  try {
    await sendRuntimeMessage({ type: "OJAF_CLEAR_SETTINGS" });
    await loadSettings();
    setStatus("本地数据已清空，已恢复默认模板。");
  } catch (error) {
    setStatus(`清空失败：${error.message}`, true);
  }
}

function profileFields(labels) {
  return labels.map((label) => profileField(label));
}

function profileField(label, overrides = {}) {
  const normalized = String(label || "");
  const isLongText = /内容|描述|职责|成果|课程|评价|说明|原因|地址|专业描述|专业课程|毕业论文|技能|活动|学术成果|自我/.test(normalized);
  const isDate = /出生日期/.test(normalized);
  const isMonth = /时间|日期|年月|发表|获得|取得|入职/.test(normalized) && !isDate && !/有效期/.test(normalized);
  const isChoice = /^(性别|血型|婚姻状况|健康状况|高考科目|学历|学位|学制|学习形式|学校类别|录取批次|培养方式|升学类型|户籍类型|政治面貌|专业技术职称|外语种类|掌握程度|听说能力|读写能力|奖励等级|证件号码类型|与紧急联系人关系|关系)$/.test(normalized) || /^是否|^有无/.test(normalized);

  const field = {
    key: normalizeProfileSectionTitle(normalized) || `field_${Math.random().toString(36).slice(2)}`,
    label: normalized,
    type: isLongText ? "textarea" : isChoice ? "select" : isDate ? "date" : isMonth ? "month" : "text",
    rows: isLongText ? 4 : undefined,
    span: isLongText,
    placeholder: buildStructuredPlaceholder(normalized),
    ...overrides
  };

  if (field.type === "select") {
    field.options = getStructuredFieldOptions(normalized);
  }
  return field;
}

function getStructuredFieldOptions(label) {
  if (/性别/.test(label)) {
    return ["", "男", "女"];
  }
  if (/是否|有无/.test(label)) {
    return ["", "是", "否"];
  }
  if (/血型/.test(label)) {
    return ["", "A型", "B型", "AB型", "O型", "其他"];
  }
  if (/婚姻状况/.test(label)) {
    return ["", "未婚", "已婚", "离异", "其他"];
  }
  if (/健康状况/.test(label)) {
    return ["", "健康", "良好", "一般", "其他"];
  }
  if (/高考科目/.test(label)) {
    return ["", "理科", "文科", "综合改革"];
  }
  if (/证件号码类型/.test(label)) {
    return ["", "身份证", "护照", "港澳居民来往内地通行证", "台湾居民来往大陆通行证", "其他"];
  }
  if (/学历/.test(label)) {
    return ["", "博士研究生", "硕士研究生", "本科", "大专", "高中", "其他"];
  }
  if (/学位/.test(label)) {
    return ["", "博士", "硕士", "学士", "无"];
  }
  if (/学制/.test(label)) {
    return ["", "2年", "2.5年", "3年", "4年", "5年", "其他"];
  }
  if (/学习形式/.test(label)) {
    return ["", "全日制", "非全日制"];
  }
  if (/学校类别/.test(label)) {
    return ["", "985", "211", "双一流", "普通本科", "普通高校", "海外院校", "其他"];
  }
  if (/录取批次/.test(label)) {
    return ["", "本科提前批", "本科一批", "本科二批", "专科批", "普通批", "强基计划", "综合评价", "保送生", "其他"];
  }
  if (/培养方式/.test(label)) {
    return ["", "非定向", "定向", "统招统分", "委托培养", "自费"];
  }
  if (/升学类型/.test(label)) {
    return ["", "普通高等学校招生全国统一考试（高考）", "全国硕士研究生统一招生考试", "推荐免试", "自主招生", "港澳台联招", "海外申请", "其他"];
  }
  if (/户籍类型/.test(label)) {
    return ["", "居民户", "农业户口", "非农业户口", "家庭户口", "集体户口", "其他"];
  }
  if (/政治面貌/.test(label)) {
    return ["", "中共党员", "中共预备党员", "共青团员", "群众", "其他"];
  }
  if (/专业技术职称/.test(label)) {
    return ["", "无", "初级", "中级", "副高级", "正高级", "其他"];
  }
  if (/外语种类/.test(label)) {
    return ["", "英语", "日语", "法语", "德语", "其他"];
  }
  if (/掌握程度|听说能力|读写能力/.test(label)) {
    return ["", "熟练", "良好", "一般"];
  }
  if (/奖励等级/.test(label)) {
    return ["", "国家级", "省级", "市级", "校级", "院级", "其他"];
  }
  if (/关系|与紧急联系人关系/.test(label)) {
    return ["", "父亲", "母亲", "配偶", "兄弟姐妹", "朋友", "其他"];
  }
  return [""];
}

function buildStructuredPlaceholder(label) {
  if (/姓名/.test(label)) {
    return "例如 李明（示例）";
  }
  if (/电话|手机/.test(label)) {
    return "例如 13900000000";
  }
  if (/邮箱/.test(label)) {
    return "例如 liming@example.com";
  }
  if (/证件号码/.test(label)) {
    return "示例身份证号或其他证件号";
  }
  if (/学校|公司|机构|单位/.test(label)) {
    return "填写完整名称";
  }
  if (/内容|描述|职责|成果|评价/.test(label)) {
    return "用完整句子描述，后续可按网站字数要求裁剪";
  }
  return "";
}

function renderProfileNav() {
  if (!fields.profileNav) {
    return;
  }

  fields.profileNav.innerHTML = RESUME_SECTION_GUIDE.map((section) => {
    return `
      <a href="#profile-section-${escapeHtml(section.key)}" data-profile-nav="${escapeHtml(section.key)}">
        <span class="nav-title">${escapeHtml(section.title)}</span>
        <span class="completion-badge is-empty" data-completion-badge>0/0</span>
      </a>
    `;
  }).join("");

  fields.profileNav.querySelectorAll("[data-profile-nav]").forEach((link) => {
    link.addEventListener("click", () => {
      setActiveProfileSection(link.dataset.profileNav || "", { force: true });
      window.setTimeout(scheduleProfileSectionSync, 80);
    });
  });
}

function renderProfileTips(activeKey = "") {
  if (!fields.profileTips) {
    return;
  }

  const guideSection = RESUME_SECTION_GUIDE.find((section) => section.key === activeKey);
  const domSection = fields.profileSectionEditor?.querySelector(`[data-profile-section="${CSS.escape(activeKey || "")}"]`);
  const activeSection = guideSection || {
    key: activeKey || RESUME_SECTION_GUIDE[0]?.key,
    title: domSection?.dataset.sectionTitle || RESUME_SECTION_GUIDE[0]?.title || "基本信息",
    tips: ["这是自定义模块，保存时会继续保留。"]
  };
  const globalTips = [
    "像网申页面一样直接填字段；保存时会在后台整理成本机资料备份。",
    "同一个值如果不同网站叫法不同，可以点“添加自定义字段”补充别名。",
    "没有的经历可以留空；经历类模块可以添加多条。",
    "资料只保存在本机浏览器里，不会同步到云端。",
    "字段匹配只使用本地规则，不会联网或上传资料。"
  ];

  fields.profileTips.innerHTML = `
    <article class="tip-card">
      <div class="tip-kicker">当前模块</div>
      <h3>${escapeHtml(activeSection.title || "基本信息")}</h3>
      ${(activeSection?.tips || []).map((tip) => `<p>${escapeHtml(tip)}</p>`).join("")}
    </article>
    <article class="tip-card">
      <div class="tip-kicker">通用规则</div>
      ${globalTips.map((tip) => `<p>${escapeHtml(tip)}</p>`).join("")}
    </article>
  `;

  fields.profileNav?.querySelectorAll("[data-profile-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.profileNav === activeSection.key);
  });
}

function setActiveProfileSection(sectionKey, options = {}) {
  if (!sectionKey) {
    return;
  }
  if (!options.force && activeProfileSectionKey === sectionKey) {
    return;
  }

  activeProfileSectionKey = sectionKey;
  renderProfileTips(sectionKey);
}

function scheduleProfileSectionSync() {
  if (profileSectionSyncFrame) {
    return;
  }

  profileSectionSyncFrame = window.requestAnimationFrame(() => {
    profileSectionSyncFrame = 0;
    syncActiveProfileSectionFromScroll();
  });
}

function syncActiveProfileSectionFromScroll() {
  if (!fields.profileSectionEditor) {
    return;
  }

  const sections = Array.from(fields.profileSectionEditor.querySelectorAll("[data-profile-section]"));
  if (sections.length === 0) {
    return;
  }

  const anchorY = Math.min(Math.max(window.innerHeight * 0.26, 120), 220);
  let activeSection = sections[0];
  let activeScore = Number.POSITIVE_INFINITY;

  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    if (rect.bottom < 80) {
      continue;
    }

    const distance = rect.top <= anchorY ? Math.abs(rect.top - anchorY) * 0.35 : Math.abs(rect.top - anchorY);
    if (distance < activeScore) {
      activeScore = distance;
      activeSection = section;
    }
  }

  setActiveProfileSection(activeSection.dataset.profileSection || "");
}

function handleProfileSectionFocus(event) {
  const card = event.target.closest("[data-profile-section]");
  if (!card) {
    return;
  }
  setActiveProfileSection(card.dataset.profileSection || "", { force: true });
}

function handleStructuredProfileClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const sectionEl = button.closest("[data-profile-section]");
  const sectionKey = sectionEl?.dataset.profileSection || "";
  const section = getStructuredSectionConfig(sectionKey) || {
    key: sectionKey,
    title: sectionEl?.dataset.sectionTitle || "自定义资料",
    kind: "simple",
    fields: []
  };
  if (!section) {
    return;
  }

  if (action === "add-structured-item") {
    const itemsRoot = sectionEl.querySelector("[data-structured-items]");
    const index = itemsRoot ? itemsRoot.querySelectorAll("[data-structured-item]").length : 0;
    itemsRoot?.insertAdjacentHTML("beforeend", renderStructuredItem(section, createBlankStructuredItem(section, index), index));
    handleProfileEditorInput();
    setStatus(`已添加一条 ${section.itemLabel || section.title}。`);
    return;
  }

  if (action === "remove-structured-item") {
    button.closest("[data-structured-item]")?.remove();
    handleProfileEditorInput();
    setStatus(`已删除一条 ${section.itemLabel || section.title}。`);
    return;
  }

  if (action === "add-custom-row") {
    const target = button.closest("[data-custom-area]")?.querySelector("[data-custom-rows]");
    target?.insertAdjacentHTML("beforeend", renderCustomStructuredRow());
    handleProfileEditorInput();
    setStatus("已添加自定义字段。");
    return;
  }

  if (action === "remove-custom-row") {
    button.closest("[data-custom-row]")?.remove();
    handleProfileEditorInput();
    setStatus("已删除自定义字段。");
  }
}

function renderProfileSectionEditor(profileV2) {
  if (!fields.profileSectionEditor) {
    return;
  }

  profileEditorBaseline = cloneProfileData(profileV2);
  const parsed = normalizeProfileV2(profileV2);
  const known = STRUCTURED_RESUME_SECTIONS.map((section) => renderStructuredSection(section, parsed.sections[section.key])).join("");

  const extras = (parsed.customSections || [])
    .map((section, index) => {
      const key = section.key || `extra-${index}`;
      const fields = Object.keys(section.values || {}).map((label, valueIndex) => ({
        key: `extra_${index}_${valueIndex}`,
        label,
        type: "text"
      }));
      return renderStructuredSection(
        {
          key,
          title: section.title,
          kind: "simple",
          fields,
          isExtra: true
        },
        {
          values: section.values || {},
          custom: section.custom || []
        }
      );
    })
    .join("");

  fields.profileSectionEditor.innerHTML = known + extras;
  scheduleProfileSectionSync();
  updateProfileCompletion();
}

function renderStructuredSection(section, data = null) {
  const config = {
    ...section,
    kind: section.kind || "simple"
  };
  const isRepeat = config.kind === "repeat";
  const parsedData = data || (isRepeat ? { items: [] } : { values: {}, custom: [] });
  const sectionDescription = config.isExtra
    ? "导入资料里的自定义模块，会继续保存。"
    : isRepeat
      ? "像网申页面一样逐条维护；没有内容可以留空。"
      : "直接填写字段；没有内容可以留空。";

  const action = isRepeat
    ? `<button class="structured-add" type="button" data-action="add-structured-item">+ 添加一条</button>`
    : "";

  const body = isRepeat
    ? renderStructuredRepeater(config, parsedData.items)
    : renderStructuredSimple(config, parsedData);

  return `
    <section id="profile-section-${escapeHtml(section.key)}" class="profile-edit-section" data-profile-section="${escapeHtml(section.key)}" data-section-title="${escapeHtml(section.title)}" data-extra-section="${config.isExtra ? "true" : "false"}">
      <div class="profile-edit-head">
        <div>
          <div class="profile-title-row">
            <h3>${escapeHtml(section.title)}</h3>
            <span class="completion-badge is-empty" data-completion-badge>0/0</span>
          </div>
          <p>${escapeHtml(sectionDescription)}</p>
        </div>
        ${action}
      </div>
      ${body}
    </section>
  `;
}

function renderStructuredSimple(section, data = {}) {
  const values = data.values || {};
  const custom = data.custom || [];
  return `
    <div class="structured-grid">
      ${(section.fields || []).map((field) => renderStructuredField(field, values[field.label])).join("")}
    </div>
    ${renderStructuredCustomArea(custom)}
  `;
}

function renderStructuredRepeater(section, items = []) {
  const list = Array.isArray(items) && items.length > 0
    ? items
    : Array.from({ length: Math.max(1, Number(section.defaultItems || 1)) }, (_unused, index) => createBlankStructuredItem(section, index));
  return `
    <div class="structured-items" data-structured-items>
      ${list.map((item, index) => renderStructuredItem(section, item, index)).join("")}
    </div>
  `;
}

function renderStructuredItem(section, item, index) {
  const title = item?.title || `${section.itemLabel || section.title} ${index + 1}`;
  const itemId = item?.id || createClientItemId();
  return `
    <article class="structured-item" data-structured-item data-item-id="${escapeHtml(itemId)}">
      <div class="structured-item-head">
        <input class="structured-item-title" data-item-title value="${escapeHtml(title)}" aria-label="${escapeHtml(section.itemLabel || section.title)}标题" />
        <button class="structured-remove" type="button" data-action="remove-structured-item">删除</button>
      </div>
      <div class="structured-grid">
        ${(section.fields || []).map((field) => renderStructuredField(field, item?.values?.[field.label])).join("")}
      </div>
      ${renderStructuredCustomArea(item?.custom || [])}
    </article>
  `;
}

function renderStructuredField(field, value = "") {
  const id = `structured_${field.key}_${Math.random().toString(36).slice(2)}`;
  const fieldClass = field.span ? "structured-field span-2" : "structured-field";
  const valueText = value == null ? "" : String(value);
  let control = "";

  if (field.type === "textarea") {
    control = `<textarea id="${id}" data-field-label="${escapeHtml(field.label)}" rows="${field.rows || 4}" placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(valueText)}</textarea>`;
  } else if (field.type === "select") {
    const options = (field.options || ["", "是", "否"])
      .map((option) => {
        const selected = String(option) === valueText ? " selected" : "";
        return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
      })
      .join("");
    control = `<select id="${id}" data-field-label="${escapeHtml(field.label)}">${options}</select>`;
  } else {
    control = `<input id="${id}" data-field-label="${escapeHtml(field.label)}" type="${escapeHtml(field.type || "text")}" value="${escapeHtml(valueText)}" placeholder="${escapeHtml(field.placeholder || "")}" />`;
  }

  return `
    <label class="${fieldClass}" for="${id}">
      <span>${escapeHtml(field.label)}</span>
      ${control}
    </label>
  `;
}

function renderStructuredCustomArea(customRows = []) {
  return `
    <div class="structured-custom" data-custom-area>
      <div class="structured-custom-head">
        <span>自定义字段</span>
        <button type="button" data-action="add-custom-row">+ 添加自定义字段</button>
      </div>
      <div class="structured-custom-rows" data-custom-rows>
        ${(customRows || []).map((row) => renderCustomStructuredRow(row)).join("")}
      </div>
    </div>
  `;
}

function renderCustomStructuredRow(row = {}) {
  return `
    <div class="structured-custom-row" data-custom-row>
      <input data-custom-label value="${escapeHtml(row.label || "")}" placeholder="字段名，例如 个人主页" />
      <input data-custom-value value="${escapeHtml(row.value || "")}" placeholder="字段值" />
      <button type="button" data-action="remove-custom-row">删除</button>
    </div>
  `;
}

function getStructuredSectionConfig(key) {
  return STRUCTURED_RESUME_SECTIONS.find((section) => section.key === key) || null;
}

function createBlankStructuredItem(section, index = 0) {
  return {
    id: createClientItemId(),
    title: `${section.itemLabel || section.title} ${index + 1}`,
    values: {},
    custom: []
  };
}

function normalizeProfileSectionTitle(value) {
  return String(value || "")
    .replace(/[()（）/／、\s]/g, "")
    .replace(/添加|HOT|NEW/g, "")
    .trim();
}

function normalizePlainText(value, maxLength = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function handleProfileEditorInput() {
  setProfileDirty("资料已修改，记得点击保存资料。");
  updateProfileCompletion();
}

function updateProfileCompletion() {
  if (!fields.profileSectionEditor) {
    return;
  }

  const sections = Array.from(fields.profileSectionEditor.querySelectorAll("[data-profile-section]"));
  for (const sectionEl of sections) {
    const completion = getSectionCompletion(sectionEl);
    const text = `${completion.filled}/${completion.total}`;
    const state = getCompletionState(completion);

    sectionEl.querySelectorAll("[data-completion-badge]").forEach((badge) => {
      updateCompletionBadge(badge, text, state);
    });

    const navBadge = fields.profileNav?.querySelector(`[data-profile-nav="${CSS.escape(sectionEl.dataset.profileSection || "")}"] [data-completion-badge]`);
    if (navBadge) {
      updateCompletionBadge(navBadge, text, state);
    }
  }
}

function getSectionCompletion(sectionEl) {
  const controls = Array.from(sectionEl.querySelectorAll("[data-field-label]"));
  const customRows = Array.from(sectionEl.querySelectorAll("[data-custom-row]"));
  const total = controls.length + customRows.length;
  const filled = controls.filter((control) => String(control.value || "").trim() !== "").length
    + customRows.filter((row) => {
      const label = String(row.querySelector("[data-custom-label]")?.value || "").trim();
      const value = String(row.querySelector("[data-custom-value]")?.value || "").trim();
      return label !== "" && value !== "";
    }).length;

  return { filled, total };
}

function getCompletionState(completion) {
  if (!completion.total) {
    return "empty";
  }
  const ratio = completion.filled / completion.total;
  if (ratio >= 0.8) {
    return "good";
  }
  if (ratio >= 0.35) {
    return "partial";
  }
  return "empty";
}

function updateCompletionBadge(badge, text, state) {
  badge.textContent = text;
  badge.classList.toggle("is-good", state === "good");
  badge.classList.toggle("is-partial", state === "partial");
  badge.classList.toggle("is-empty", state === "empty");
}

function setProfileFeedback(message, state = "") {
  if (!fields.profileFeedback) {
    return;
  }

  if (profileSaveFeedbackTimer) {
    window.clearTimeout(profileSaveFeedbackTimer);
    profileSaveFeedbackTimer = 0;
  }

  fields.profileFeedback.textContent = message;
  fields.profileFeedback.classList.toggle("is-dirty", state === "dirty");
  fields.profileFeedback.classList.toggle("is-saved", state === "saved");
  fields.profileFeedback.classList.toggle("error", state === "error");
  fields.profileFeedback.classList.toggle("busy", state === "busy");
}

function setProfileSaving(isSaving) {
  if (!fields.saveProfileButton) {
    return;
  }

  fields.saveProfileButton.dataset.saving = isSaving ? "true" : "false";
  updateProfileSaveButton();
}

function updateProfileSaveButton() {
  if (!fields.saveProfileButton) {
    return;
  }

  const isSaving = fields.saveProfileButton.dataset.saving === "true";
  fields.saveProfileButton.disabled = isSaving;
  fields.saveProfileButton.textContent = isSaving
    ? "保存中..."
    : profileHasUnsavedChanges
      ? `${SAVE_PROFILE_LABEL}（未保存）`
      : SAVE_PROFILE_LABEL;
}

function setProfileDirty(message = "资料已修改，记得点击保存资料。") {
  profileHasUnsavedChanges = true;
  updateProfileSaveButton();
  setProfileFeedback(message, "dirty");
}

function setProfileSaved(message = "资料已保存到本机。") {
  profileHasUnsavedChanges = false;
  updateProfileSaveButton();
  setProfileFeedback(message, "saved");
}

function collectProfileV2FromEditor() {
  const profileV2 = createEmptyProfileV2();
  if (!fields.profileSectionEditor) {
    return profileV2;
  }

  const customSections = [];
  fields.profileSectionEditor.querySelectorAll("[data-profile-section]").forEach((sectionEl) => {
    const key = sectionEl.dataset.profileSection || "";
    const title = sectionEl.dataset.sectionTitle || "";
    const config = getStructuredSectionConfig(key);
    const isExtra = sectionEl.dataset.extraSection === "true";

    if (config?.kind === "repeat") {
      profileV2.sections[key] = {
        key,
        title: config.title,
        kind: "repeat",
        items: collectStructuredItems(sectionEl, config)
      };
      return;
    }

    const scopeData = collectStructuredFieldsFromScope(sectionEl);
    const sectionData = {
      key,
      title: config?.title || title || "自定义资料",
      kind: "simple",
      values: scopeData.values,
      custom: scopeData.custom
    };

    if (config && !isExtra) {
      profileV2.sections[key] = sectionData;
    } else if (hasSimpleSectionData(sectionData)) {
      customSections.push(sectionData);
    }
  });

  profileV2.customSections = customSections;
  profileV2.updatedAt = new Date().toISOString();
  return mergeProfileV2PreservingUnknown(profileEditorBaseline, profileV2);
}

function createClientItemId() {
  if (globalThis.crypto?.randomUUID) {
    return `item-${crypto.randomUUID()}`;
  }
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function mergeProfileV2PreservingUnknown(baseProfile, editedProfile) {
  const edited = normalizeProfileV2(editedProfile);
  if (!isPlainObject(baseProfile)) {
    return edited;
  }

  const merged = cloneProfileData(baseProfile);
  merged.schemaVersion = PROFILE_SCHEMA_VERSION;
  merged.updatedAt = edited.updatedAt || merged.updatedAt || "";
  merged.sections = isPlainObject(merged.sections) ? merged.sections : {};

  for (const [key, editedSection] of Object.entries(edited.sections || {})) {
    const baseSection = isPlainObject(merged.sections[key]) ? merged.sections[key] : {};
    if (editedSection.kind === "repeat") {
      const baseItems = Array.isArray(baseSection.items) ? baseSection.items : [];
      const baseItemsById = new Map(baseItems.filter((item) => item?.id).map((item) => [item.id, item]));
      const sectionConfig = getStructuredSectionConfig(key);
      const controlledLabels = new Set((sectionConfig?.fields || []).map((field) => field.label));
      merged.sections[key] = {
        ...baseSection,
        ...editedSection,
        items: (editedSection.items || []).map((item) => {
          const baseItem = baseItemsById.get(item?.id) || {};
          const preservedValues = isPlainObject(baseItem.values) ? { ...baseItem.values } : {};
          for (const label of controlledLabels) {
            delete preservedValues[label];
          }
          return {
            ...baseItem,
            ...item,
            values: {
              ...preservedValues,
              ...(isPlainObject(item.values) ? item.values : {})
            },
            custom: Array.isArray(item.custom) ? item.custom : []
          };
        })
      };
    } else {
      const sectionConfig = getStructuredSectionConfig(key);
      const controlledLabels = new Set((sectionConfig?.fields || []).map((field) => field.label));
      const preservedValues = isPlainObject(baseSection.values) ? { ...baseSection.values } : {};
      for (const label of controlledLabels) {
        delete preservedValues[label];
      }
      merged.sections[key] = {
        ...baseSection,
        ...editedSection,
        values: {
          ...preservedValues,
          ...(isPlainObject(editedSection.values) ? editedSection.values : {})
        },
        custom: Array.isArray(editedSection.custom) ? editedSection.custom : []
      };
    }
  }

  const baseCustomSections = Array.isArray(merged.customSections) ? merged.customSections : [];
  const editedCustomSections = Array.isArray(edited.customSections) ? edited.customSections : [];
  merged.customSections = editedCustomSections.map((section) => {
    const baseSection = baseCustomSections.find((candidate) => candidate?.key === section.key)
      || {};
    return {
      ...baseSection,
      ...section,
      // Every custom value is rendered in the editor. Replacing this object
      // lets the user clear a value instead of silently restoring it from the
      // baseline during the merge.
      values: isPlainObject(section.values) ? section.values : {},
      custom: Array.isArray(section.custom) ? section.custom : []
    };
  });

  return merged;
}

function cloneProfileData(value) {
  if (value == null) {
    return createEmptyProfileV2();
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return createEmptyProfileV2();
  }
}

function collectStructuredItems(sectionEl, section) {
  const items = [];
  sectionEl.querySelectorAll("[data-structured-item]").forEach((itemEl, index) => {
    const id = normalizePlainText(itemEl.dataset.itemId || createClientItemId(), 100);
    const title = normalizePlainText(itemEl.querySelector("[data-item-title]")?.value || `${section.itemLabel || section.title} ${index + 1}`, 120);
    const scopeData = collectStructuredFieldsFromScope(itemEl);
    const item = {
      id,
      title,
      values: scopeData.values,
      custom: scopeData.custom
    };
    if (hasStructuredItemData(item)) {
      items.push(item);
    }
  });
  return items;
}

function collectStructuredFieldsFromScope(scope) {
  const values = {};
  const custom = [];
  scope.querySelectorAll("[data-field-label]").forEach((control) => {
    const label = control.dataset.fieldLabel || "";
    const value = String(control.value || "").trim();
    if (label && !isUnsafeObjectKey(label) && value) {
      values[label] = value;
    }
  });

  scope.querySelectorAll("[data-custom-row]").forEach((row) => {
    const label = normalizePlainText(row.querySelector("[data-custom-label]")?.value || "", 80);
    const value = String(row.querySelector("[data-custom-value]")?.value || "").trim();
    if (label && value) {
      custom.push({ label, value });
    }
  });

  return { values, custom };
}

function hasSimpleSectionData(section) {
  return Object.keys(section?.values || {}).length > 0 || (section?.custom || []).length > 0;
}

function hasStructuredItemData(item) {
  return Object.keys(item?.values || {}).length > 0 || (item?.custom || []).length > 0;
}

function createEmptyProfileV2() {
  const sections = {};
  for (const section of STRUCTURED_RESUME_SECTIONS) {
    sections[section.key] = section.kind === "repeat"
      ? { key: section.key, title: section.title, kind: "repeat", items: [] }
      : { key: section.key, title: section.title, kind: "simple", values: {}, custom: [] };
  }

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    updatedAt: "",
    sections,
    customSections: []
  };
}

function normalizeProfileV2(profileV2) {
  const normalized = createEmptyProfileV2();
  const source = isPlainObject(profileV2) ? profileV2 : {};
  const sourceSections = isPlainObject(source.sections) ? source.sections : {};

  for (const config of STRUCTURED_RESUME_SECTIONS) {
    const input = sourceSections[config.key];
    normalized.sections[config.key] = normalizeProfileSectionData(config, input);
  }

  normalized.customSections = Array.isArray(source.customSections)
    ? source.customSections
        .map((section, index) => normalizeCustomProfileSection(section, index))
        .filter(hasSimpleSectionData)
    : [];
  normalized.updatedAt = normalizePlainText(source.updatedAt || "", 80);
  return normalized;
}

function normalizeProfileSectionData(config, input) {
  if (config.kind === "repeat") {
    return {
      key: config.key,
      title: config.title,
      kind: "repeat",
      items: Array.isArray(input?.items)
        ? input.items.map((item, index) => normalizeProfileItem(item, index)).filter(hasStructuredItemData)
        : []
    };
  }

  return {
    key: config.key,
    title: config.title,
    kind: "simple",
    values: normalizeValuesObject(input?.values),
    custom: normalizeCustomRows(input?.custom)
  };
}

function normalizeProfileItem(item = {}, index = 0) {
  return {
    id: normalizePlainText(item.id || `item-${index}`, 100),
    title: normalizePlainText(item.title || "", 120),
    values: normalizeValuesObject(item.values),
    custom: normalizeCustomRows(item.custom)
  };
}

function normalizeCustomProfileSection(section = {}, index = 0) {
  return {
    key: normalizePlainText(section.key || `extra-${index}`, 80),
    title: normalizePlainText(section.title || "自定义资料", 120),
    kind: "simple",
    values: normalizeValuesObject(section.values),
    custom: normalizeCustomRows(section.custom)
  };
}

function normalizeValuesObject(values) {
  const result = {};
  if (!isPlainObject(values)) {
    return result;
  }

  for (const [label, value] of Object.entries(values)) {
    const cleanLabel = normalizePlainText(label, 120);
    const cleanValue = String(value == null ? "" : value).trim();
    if (cleanLabel && !isUnsafeObjectKey(cleanLabel) && cleanValue) {
      result[cleanLabel] = cleanValue;
    }
  }
  return result;
}

function isUnsafeObjectKey(value) {
  return ["__proto__", "constructor", "prototype"].includes(String(value));
}

function normalizeCustomRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      label: normalizePlainText(row?.label || "", 80),
      value: String(row?.value == null ? "" : row.value).trim()
    }))
    .filter((row) => row.label && row.value);
}

function createProfileBackup(profilesData) {
  return {
    format: "ResumeFillLocalProfiles",
    version: 2,
    exportedAt: new Date().toISOString(),
    revision: Number(profilesData?.revision) || 0,
    activeProfileId: profilesData?.activeProfileId || "",
    profiles: Array.isArray(profilesData?.profiles)
      ? profilesData.profiles.map((profile) => ({
          id: normalizePlainText(profile.id || "", 100),
          name: normalizePlainText(profile.name || "未命名简历", 80),
          createdAt: Number(profile.createdAt) || Date.now(),
          updatedAt: Number(profile.updatedAt) || Date.now(),
          profileV2: cloneProfileData(profile.profileV2)
        }))
      : []
  };
}

function parseImportedProfileBackup(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("导入文件是空的。");
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("资料备份文件格式不正确，请选择从本插件导出的备份文件。");
  }

  if (!isPlainObject(parsed)) {
    throw new Error("资料备份文件格式不正确。");
  }
  if (parsed.format === "ResumeFillLocalProfiles" && Array.isArray(parsed.profiles)) {
    const profiles = parsed.profiles
      .map((profile) => ({
        ...profile,
        profileV2: cloneProfileData(profile.profileV2)
      }))
      .filter((profile) => profile.profileV2);
    if (profiles.length === 0) {
      throw new Error("备份中没有可导入的简历。");
    }
    return {
      format: parsed.format,
      profiles,
      activeProfileId: parsed.activeProfileId || profiles[0].id
    };
  }
  if (parsed.format === LEGACY_PROFILE_BACKUP_FORMAT && parsed.profileV2) {
    return { profileV2: cloneProfileData(parsed.profileV2) };
  }
  throw new Error("当前只支持 ResumeFill Local 或 OpenJobAutofill 的资料备份文件。");
}

function setStatus(message, isError = false) {
  fields.status.textContent = message;
  fields.status.classList.toggle("error", isError);
}

function showToast(message, state = "saved", duration = 2800) {
  if (!fields.toast) {
    return;
  }

  if (toastTimer) {
    window.clearTimeout(toastTimer);
    toastTimer = 0;
  }

  fields.toast.textContent = message;
  fields.toast.hidden = false;
  fields.toast.classList.toggle("error", state === "error");
  fields.toast.classList.toggle("busy", state === "busy");

  window.requestAnimationFrame(() => {
    fields.toast.classList.add("is-visible");
  });

  toastTimer = window.setTimeout(() => {
    fields.toast.classList.remove("is-visible");
    toastTimer = window.setTimeout(() => {
      fields.toast.hidden = true;
      toastTimer = 0;
    }, 180);
  }, duration);
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Runtime message failed."));
        return;
      }
      resolve(response.data);
    });
  });
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
