const PROFILE_SCHEMA_VERSION = 2;
const STORAGE_KEYS = {
  resumeStore: "resumeStore",
  legacyProfile: "profileV2"
};
const LEGACY_KEYS_TO_REMOVE = [STORAGE_KEYS.legacyProfile, "apiConfig", "updateState"];
const MAX_PROFILES = 12;
const MAX_STRING_LENGTH = 20000;
const MAX_STORE_CHARS = 5_000_000;
const MUTATING_MESSAGE_TYPES = new Set([
  "OJAF_SAVE_SETTINGS",
  "OJAF_CLEAR_SETTINGS",
  "OJAF_IMPORT_PROFILES",
  "OJAF_CREATE_PROFILE",
  "OJAF_SWITCH_PROFILE",
  "OJAF_RENAME_PROFILE",
  "OJAF_DELETE_PROFILE"
]);
let mutationQueue = Promise.resolve();

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

  const operation = MUTATING_MESSAGE_TYPES.has(message.type)
    ? enqueueMutation(() => handleMessage(message))
    : handleMessage(message);
  operation
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: publicError(error) }));
  return true;
});

function enqueueMutation(operation) {
  const next = mutationQueue.then(operation, operation);
  mutationQueue = next.catch(() => undefined);
  return next;
}

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
    revision: store.revision
  };
}

async function saveSettings(payload) {
  const store = await ensureStore();
  assertExpectedRevision(store, payload.expectedRevision);
  let changed = false;
  if (payload.activeProfileId) {
    const nextActiveId = requireProfileId(store, payload.activeProfileId);
    changed = changed || store.activeId !== nextActiveId;
    store.activeId = nextActiveId;
  }
  if (payload.profileV2) {
    const targetId = payload.profileId
      ? requireProfileId(store, payload.profileId)
      : store.activeId;
    const profile = store.profiles.find((item) => item.id === targetId) || getActiveProfile(store);
    profile.profileV2 = normalizeProfile(payload.profileV2);
    profile.updatedAt = Date.now();
    changed = true;
  }
  if (changed) {
    bumpRevision(store);
    await saveStore(store);
  }
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
    revision: store.revision,
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
  const current = await ensureStore();
  assertExpectedRevision(current, payload.expectedRevision);
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
  await saveStore({ version: 2, revision: current.revision + 1, activeId, profiles });
  return getSettings();
}

async function createProfile(payload) {
  const store = await ensureStore();
  assertExpectedRevision(store, payload.expectedRevision);
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
  bumpRevision(store);
  await saveStore(store);
  return getSettings();
}

async function switchProfile(payload) {
  const store = await ensureStore();
  assertExpectedRevision(store, payload.expectedRevision);
  store.activeId = requireProfileId(store, payload.id);
  bumpRevision(store);
  await saveStore(store);
  return getSettings();
}

async function renameProfile(payload) {
  const store = await ensureStore();
  assertExpectedRevision(store, payload.expectedRevision);
  const id = requireProfileId(store, payload.id);
  const profile = store.profiles.find((item) => item.id === id);
  profile.name = cleanName(payload.name || profile.name);
  profile.updatedAt = Date.now();
  bumpRevision(store);
  await saveStore(store);
  return getSettings();
}

async function deleteProfile(payload) {
  const store = await ensureStore();
  assertExpectedRevision(store, payload.expectedRevision);
  if (store.profiles.length <= 1) {
    throw new Error("至少保留一份简历。可以使用“恢复空白模板”清空内容。");
  }
  const id = requireProfileId(store, payload.id);
  store.profiles = store.profiles.filter((profile) => profile.id !== id);
  if (store.activeId === id) {
    store.activeId = store.profiles[0].id;
  }
  bumpRevision(store);
  await saveStore(store);
  return getSettings();
}

async function clearSettings() {
  const current = await ensureStore();
  const next = createStore();
  // Keep revisions monotonic so a stale settings page cannot restore data
  // after another window has cleared the local store.
  next.revision = Math.max(0, Number(current.revision) || 0) + 1;
  await saveStore(next);
  // Remove keys used by the upstream build as well, so an old API key or
  // update state cannot remain in this extension's local storage after the
  // user asks to clear all local resume data.
  await chrome.storage.local.remove(LEGACY_KEYS_TO_REMOVE);
  return getSettings();
}

async function ensureStore() {
  const values = await chrome.storage.local.get([
    STORAGE_KEYS.resumeStore,
    STORAGE_KEYS.legacyProfile,
    ...LEGACY_KEYS_TO_REMOVE.filter((key) => key !== STORAGE_KEYS.legacyProfile)
  ]);
  const hasLegacyKeys = LEGACY_KEYS_TO_REMOVE.some((key) => values[key] !== undefined);
  if (values[STORAGE_KEYS.resumeStore]) {
    if (hasLegacyKeys) {
      await chrome.storage.local.remove(LEGACY_KEYS_TO_REMOVE);
    }
    return normalizeStore(values[STORAGE_KEYS.resumeStore]);
  }
  const legacyProfile = values[STORAGE_KEYS.legacyProfile]
    ? normalizeProfile(values[STORAGE_KEYS.legacyProfile])
    : clone(EMPTY_PROFILE);
  const store = createStore(legacyProfile);
  await saveStore(store);
  if (hasLegacyKeys) {
    await chrome.storage.local.remove(LEGACY_KEYS_TO_REMOVE);
  }
  return store;
}

function createStore(profileV2 = EMPTY_PROFILE) {
  const timestamp = Date.now();
  return {
    version: 2,
    revision: 0,
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
  return {
    version: 2,
    revision: Number.isFinite(Number(input?.revision)) ? Math.max(0, Number(input.revision)) : 0,
    activeId,
    profiles: safeProfiles
  };
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
    ...sanitizeUnknownProperties(input, ["id", "name", "createdAt", "updatedAt", "profileV2"]),
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
    ...sanitizeUnknownProperties(input, ["schemaVersion", "updatedAt", "sections", "customSections"]),
    schemaVersion: PROFILE_SCHEMA_VERSION,
    updatedAt: cleanText(input.updatedAt, 80),
    sections: {},
    customSections: []
  };
  if (input.sections && typeof input.sections === "object" && !Array.isArray(input.sections)) {
    for (const [key, section] of Object.entries(input.sections).slice(0, 80)) {
      const cleanKey = cleanText(key, 100);
      if (!cleanKey || isUnsafeObjectKey(cleanKey) || !section || typeof section !== "object") {
        continue;
      }
      result.sections[cleanKey] = normalizeSection(section, cleanKey);
    }
  }
  if (Array.isArray(input.customSections)) {
    result.customSections = input.customSections
      .slice(0, 30)
      .map((section, index) => normalizeSection(section, cleanId(section?.key) || `custom-${index}`))
      .filter((section) => Object.keys(section.values || {}).length > 0 || section.custom.length > 0);
  }
  return result;
}

function normalizeSection(input, key) {
  const title = cleanText(input.title || key, 160) || key;
  if (input.kind === "repeat" || Array.isArray(input.items)) {
    const itemIds = new Set();
    return {
      ...sanitizeUnknownProperties(input, ["key", "title", "kind", "items", "values", "custom"]),
      key,
      title,
      kind: "repeat",
      items: Array.isArray(input.items) ? input.items.slice(0, 50).map((item, index) => normalizeItem(item, index, itemIds)).filter(hasItemData) : []
    };
  }
  return {
    ...sanitizeUnknownProperties(input, ["key", "title", "kind", "items", "values", "custom"]),
    key,
    title,
    kind: "simple",
    values: normalizeValues(input.values),
    custom: normalizeRows(input.custom)
  };
}

function normalizeItem(input = {}, index = 0, usedIds = null) {
  const baseId = cleanId(input.id) || `item-${index}`;
  let id = baseId;
  let suffix = 1;
  while (usedIds?.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds?.add(id);
  return {
    ...sanitizeUnknownProperties(input, ["id", "title", "values", "custom"]),
    id,
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
    if (cleanLabel && !isUnsafeObjectKey(cleanLabel) && cleanValue) {
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
    ...sanitizeUnknownProperties(row, ["label", "value"]),
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

function bumpRevision(store) {
  store.revision = Math.max(0, Number(store.revision) || 0) + 1;
}

function assertExpectedRevision(store, expectedRevision) {
  if (expectedRevision == null || expectedRevision === "") {
    return;
  }
  const expected = Number(expectedRevision);
  if (!Number.isFinite(expected) || expected !== Number(store.revision || 0)) {
    throw new Error("本地资料已在其他窗口更新，请先重新加载后再保存。");
  }
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

function cleanText(value, maxLength = MAX_STRING_LENGTH) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function cleanName(value) {
  return cleanText(value, 80) || "未命名简历";
}

function cleanId(value) {
  const cleaned = cleanText(value, 100).replace(/[^a-zA-Z0-9_-]/g, "");
  return isUnsafeObjectKey(cleaned) ? "" : cleaned;
}

function isUnsafeObjectKey(value) {
  return ["__proto__", "constructor", "prototype"].includes(String(value));
}

function sanitizeUnknownProperties(input, knownKeys, depth = 0) {
  if (!input || typeof input !== "object" || Array.isArray(input) || depth > 3) {
    return {};
  }
  const known = new Set(knownKeys || []);
  const result = {};
  for (const [key, value] of Object.entries(input).slice(0, 80)) {
    if (known.has(key) || isUnsafeObjectKey(key)) {
      continue;
    }
    if (typeof value === "string") {
      result[key] = cleanText(value, MAX_STRING_LENGTH);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = value;
    } else if (typeof value === "boolean") {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 50).map((item) => sanitizeUnknownValue(item, depth + 1)).filter((item) => item !== undefined);
    } else if (value && typeof value === "object") {
      result[key] = sanitizeUnknownProperties(value, [], depth + 1);
    }
  }
  return result;
}

function sanitizeUnknownValue(value, depth = 0) {
  if (typeof value === "string") {
    return cleanText(value, MAX_STRING_LENGTH);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value) && depth <= 3) {
    return value.slice(0, 50).map((item) => sanitizeUnknownValue(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object" && depth <= 3) {
    return sanitizeUnknownProperties(value, [], depth + 1);
  }
  return undefined;
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
