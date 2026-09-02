const PROFILE_SCHEMA_VERSION = 2;
const STORAGE_KEYS = {
  resumeStore: "resumeStore",
  legacyProfile: "profileV2"
};
const PANEL_STATE_KEY = "RESUMEFILL_PANEL_STATE";
const MAX_PROFILES = 12;
const MAX_STRING_LENGTH = 20000;
const MAX_STORE_CHARS = 5_000_000;

const EMPTY_PROFILE = Object.freeze({
  schemaVersion: PROFILE_SCHEMA_VERSION,
  updatedAt: "",
  sections: {},
  customSections: []
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureStore();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string" || !message.type.startsWith("OJAF_")) {
    return undefined;
  }

  if (sender.id && sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "消息来源无效。" });
    return undefined;
  }

  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: publicError(error) }));
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case "OJAF_OPEN_OPTIONS":
      await chrome.runtime.openOptionsPage();
      return {};
    case "OJAF_GET_SETTINGS":
      return getSettings();
    case "OJAF_SAVE_SETTINGS":
      return saveSettings(message.payload || {});
    case "OJAF_CLEAR_SETTINGS":
      return clearSettings();
    case "OJAF_LIST_PROFILES":
      return listProfiles();
    case "OJAF_GET_ALL_PROFILES":
      return getAllProfiles();
    case "OJAF_IMPORT_PROFILES":
      return importProfiles(message.payload || {});
    case "OJAF_CREATE_PROFILE":
      return createProfile(message.payload || {});
    case "OJAF_SWITCH_PROFILE":
      return switchProfile(message.payload || {});
    case "OJAF_RENAME_PROFILE":
      return renameProfile(message.payload || {});
    case "OJAF_DELETE_PROFILE":
      return deleteProfile(message.payload || {});
    case "OJAF_SAVE_PROFILE_PANEL_STATE":
      return savePanelState(message.payload || {});
    case "OJAF_GET_PROFILE_PANEL_STATE":
      return getPanelState(message.payload || {});
    case "OJAF_MAP_FIELDS":
      return { mappings: [], notes: ["已关闭 AI，本次使用本地规则。"] };
    case "OJAF_ANALYZE_PAGE_STRUCTURE":
      return { fieldHints: [], notes: ["已关闭 AI，本次使用本地规则。"], siteType: "local" };
    case "OJAF_GET_UPDATE_STATUS":
      return { status: "disabled", message: "当前不会自动检查更新。" };
    case "OJAF_CHECK_FOR_UPDATE":
      return { status: "disabled", message: "联网更新检查已关闭，请从信任的仓库手动更新。" };
    case "OJAF_OPEN_UPDATE_PAGE":
      return { status: "disabled", opened: false };
    default:
      throw new Error(`未知消息：${message.type}`);
  }
}

async function getSettings() {
  const store = await ensureStore();
  const active = getActiveProfile(store);
  return {
    profileV2: clone(active.profileV2),
    profiles: store.profiles.map(profileSummary),
    activeProfileId: active.id,
    apiConfig: {}
  };
}

async function saveSettings(payload) {
  const store = await ensureStore();
  if (payload.activeProfileId) {
    store.activeId = requireProfileId(store, payload.activeProfileId);
  }
  if (payload.profileV2) {
    const profile = getActiveProfile(store);
    profile.profileV2 = normalizeProfile(payload.profileV2);
    profile.updatedAt = Date.now();
  }
  await saveStore(store);
  return getSettings();
}

async function listProfiles() {
  const store = await ensureStore();
  return { profiles: store.profiles.map(profileSummary), activeProfileId: store.activeId };
}

async function getAllProfiles() {
  const store = await ensureStore();
  return {
    activeProfileId: store.activeId,
    profiles: store.profiles.map((profile) => ({
      ...profileSummary(profile),
      profileV2: clone(profile.profileV2)
    }))
  };
}

async function importProfiles(payload) {
  if (!Array.isArray(payload.profiles) || payload.profiles.length === 0) {
    throw new Error("备份中没有可导入的简历。");
  }
  const profiles = [];
  const ids = new Set();
  for (const input of payload.profiles.slice(0, MAX_PROFILES)) {
    const normalized = normalizeStoredProfile({
      ...input,
      id: cleanId(input?.id) || createId()
    });
    if (!normalized || ids.has(normalized.id)) {
      continue;
    }
    ids.add(normalized.id);
    profiles.push(normalized);
  }
  if (profiles.length === 0) {
    throw new Error("备份中的简历格式无法识别。");
  }
  const activeId = profiles.some((profile) => profile.id === payload.activeProfileId)
    ? payload.activeProfileId
    : profiles[0].id;
  await saveStore({ version: 1, activeId, profiles });
  return getSettings();
}

async function createProfile(payload) {
  const store = await ensureStore();
  if (store.profiles.length >= MAX_PROFILES) {
    throw new Error(`最多保存 ${MAX_PROFILES} 份简历。`);
  }
  const name = cleanName(payload.name || `简历 ${store.profiles.length + 1}`);
  const profile = {
    id: createId(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    profileV2: clone(EMPTY_PROFILE)
  };
  store.profiles = [...store.profiles, profile];
  store.activeId = profile.id;
  await saveStore(store);
  return getSettings();
}

async function switchProfile(payload) {
  const store = await ensureStore();
  store.activeId = requireProfileId(store, payload.id);
  await saveStore(store);
  return getSettings();
}

async function renameProfile(payload) {
  const store = await ensureStore();
  const profile = store.profiles.find((item) => item.id === payload.id) || getActiveProfile(store);
  profile.name = cleanName(payload.name || profile.name);
  profile.updatedAt = Date.now();
  await saveStore(store);
  return getSettings();
}

async function deleteProfile(payload) {
  const store = await ensureStore();
  if (store.profiles.length <= 1) {
    throw new Error("至少保留一份简历。可以使用“恢复空白模板”清空内容。");
  }
  const id = requireProfileId(store, payload.id);
  store.profiles = store.profiles.filter((profile) => profile.id !== id);
  if (store.activeId === id) {
    store.activeId = store.profiles[0].id;
  }
  await saveStore(store);
  return getSettings();
}

async function clearSettings() {
  await saveStore(createStore());
  // Remove keys used by the upstream build as well, so an old API key or
  // update state cannot remain in this extension's local storage after the
  // user asks to clear all local resume data.
  await chrome.storage.local.remove([
    STORAGE_KEYS.legacyProfile,
    "apiConfig",
    "updateState"
  ]);
  return getSettings();
}

async function ensureStore() {
  const values = await chrome.storage.local.get([STORAGE_KEYS.resumeStore, STORAGE_KEYS.legacyProfile]);
  if (values[STORAGE_KEYS.resumeStore]) {
    return normalizeStore(values[STORAGE_KEYS.resumeStore]);
  }
  const legacyProfile = values[STORAGE_KEYS.legacyProfile]
    ? normalizeProfile(values[STORAGE_KEYS.legacyProfile])
    : clone(EMPTY_PROFILE);
  const store = createStore(legacyProfile);
  await saveStore(store);
  return store;
}

function createStore(profileV2 = EMPTY_PROFILE) {
  const timestamp = Date.now();
  return {
    version: 1,
    activeId: "default",
    profiles: [{
      id: "default",
      name: "默认简历",
      createdAt: timestamp,
      updatedAt: timestamp,
      profileV2: normalizeProfile(profileV2)
    }]
  };
}

function normalizeStore(input) {
  const profiles = Array.isArray(input?.profiles)
    ? input.profiles.map(normalizeStoredProfile).filter(Boolean).slice(0, MAX_PROFILES)
    : [];
  const safeProfiles = profiles.length > 0 ? profiles : createStore().profiles;
  const activeId = safeProfiles.some((profile) => profile.id === input?.activeId)
    ? input.activeId
    : safeProfiles[0].id;
  return { version: 1, activeId, profiles: safeProfiles };
}

function normalizeStoredProfile(input) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const id = cleanId(input.id);
  if (!id) {
    return null;
  }
  return {
    id,
    name: cleanName(input.name || "未命名简历"),
    createdAt: Number(input.createdAt) || Date.now(),
    updatedAt: Number(input.updatedAt) || Date.now(),
    profileV2: normalizeProfile(input.profileV2)
  };
}

function normalizeProfile(input) {
  if (!input || typeof input !== "object") {
    return clone(EMPTY_PROFILE);
  }
  const result = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    updatedAt: cleanText(input.updatedAt, 80),
    sections: {},
    customSections: []
  };
  if (input.sections && typeof input.sections === "object" && !Array.isArray(input.sections)) {
    for (const [key, section] of Object.entries(input.sections).slice(0, 80)) {
      const cleanKey = cleanText(key, 100);
      if (!cleanKey || !section || typeof section !== "object") {
        continue;
      }
      result.sections[cleanKey] = normalizeSection(section, cleanKey);
    }
  }
  if (Array.isArray(input.customSections)) {
    result.customSections = input.customSections
      .slice(0, 30)
      .map((section, index) => normalizeSection(section, `custom-${index}`))
      .filter((section) => Object.keys(section.values || {}).length > 0 || section.custom.length > 0);
  }
  return result;
}

function normalizeSection(input, key) {
  const title = cleanText(input.title || key, 160) || key;
  if (input.kind === "repeat" || Array.isArray(input.items)) {
    return {
      key,
      title,
      kind: "repeat",
      items: Array.isArray(input.items) ? input.items.slice(0, 50).map(normalizeItem).filter(hasItemData) : []
    };
  }
  return {
    key,
    title,
    kind: "simple",
    values: normalizeValues(input.values),
    custom: normalizeRows(input.custom)
  };
}

function normalizeItem(input = {}) {
  return {
    title: cleanText(input.title || "", 160),
    values: normalizeValues(input.values),
    custom: normalizeRows(input.custom)
  };
}

function normalizeValues(input) {
  const values = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return values;
  }
  for (const [label, value] of Object.entries(input).slice(0, 100)) {
    const cleanLabel = cleanText(label, 160);
    const cleanValue = cleanText(value, MAX_STRING_LENGTH);
    if (cleanLabel && cleanValue) {
      values[cleanLabel] = cleanValue;
    }
  }
  return values;
}

function normalizeRows(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, 100).map((row) => ({
    label: cleanText(row?.label, 160),
    value: cleanText(row?.value, MAX_STRING_LENGTH)
  })).filter((row) => row.label && row.value);
}

function hasItemData(item) {
  return Object.keys(item.values).length > 0 || item.custom.length > 0;
}

function getActiveProfile(store) {
  return store.profiles.find((profile) => profile.id === store.activeId) || store.profiles[0];
}

function requireProfileId(store, id) {
  const clean = cleanId(id);
  if (!clean || !store.profiles.some((profile) => profile.id === clean)) {
    throw new Error("找不到指定简历。请刷新设置页后重试。");
  }
  return clean;
}

function profileSummary(profile) {
  return {
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    valueCount: countProfileValues(profile.profileV2)
  };
}

function countProfileValues(profile) {
  let count = 0;
  for (const section of Object.values(profile?.sections || {})) {
    if (section.kind === "repeat") {
      for (const item of section.items || []) {
        count += Object.keys(item.values || {}).length + (item.custom || []).length;
      }
    } else {
      count += Object.keys(section.values || {}).length + (section.custom || []).length;
    }
  }
  return count;
}

async function saveStore(store) {
  const normalized = normalizeStore(store);
  const serialized = JSON.stringify(normalized);
  if (serialized.length > MAX_STORE_CHARS) {
    throw new Error("简历库超过本地存储上限，请减少内容或拆分备份文件。");
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.resumeStore]: normalized });
}

async function savePanelState(payload) {
  if (!chrome.storage.session) {
    return { saved: false };
  }
  const pageKey = cleanText(payload.pageKey, 800);
  if (!pageKey) {
    return { saved: false };
  }
  const current = await chrome.storage.session.get(PANEL_STATE_KEY);
  const all = current[PANEL_STATE_KEY] && typeof current[PANEL_STATE_KEY] === "object" ? current[PANEL_STATE_KEY] : {};
  all[pageKey] = { pageKey, ...(payload.patch || {}), updatedAt: Date.now() };
  const entries = Object.entries(all)
    .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
    .slice(0, 20);
  await chrome.storage.session.set({ [PANEL_STATE_KEY]: Object.fromEntries(entries) });
  return { saved: true };
}

async function getPanelState(payload) {
  if (!chrome.storage.session) {
    return null;
  }
  const pageKey = cleanText(payload.pageKey, 800);
  if (!pageKey) {
    return null;
  }
  const current = await chrome.storage.session.get(PANEL_STATE_KEY);
  return current[PANEL_STATE_KEY]?.[pageKey] || null;
}

function cleanText(value, maxLength = MAX_STRING_LENGTH) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function cleanName(value) {
  return cleanText(value, 80) || "未命名简历";
}

function cleanId(value) {
  return cleanText(value, 100).replace(/[^a-zA-Z0-9_-]/g, "");
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return `profile-${crypto.randomUUID()}`;
  }
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function publicError(error) {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}
