const els = {
  status: document.getElementById("status"),
  openOptions: document.getElementById("openOptions"),
  startAutofillBtn: document.getElementById("startAutofillBtn"),
  clearMarksBtn: document.getElementById("clearMarksBtn")
};

const DEFAULT_START_LABEL = els.startAutofillBtn?.textContent || "开始填写";
let lastRuntimeState = null;
const CONTENT_SCRIPT_VERSION = (() => {
  try {
    return `${chrome.runtime.getManifest().version}-local`;
  } catch {
    return "0.2.5-local";
  }
})();

els.openOptions?.addEventListener("click", () => chrome.runtime.openOptionsPage());
els.startAutofillBtn?.addEventListener("click", () => void startAutofill());
els.clearMarksBtn?.addEventListener("click", () => void clearMarks());

void initialize();

async function initialize() {
  try {
    setStatus("本地模式已启用：资料和字段匹配均在浏览器内完成。");
    await syncRuntimeState();
  } catch (error) {
    setStatus(`读取页面失败：${error.message}`, true);
  }
}

async function syncRuntimeState() {
  try {
    const response = await sendToActiveTab(
      { type: "OJAF_GET_RUNTIME_STATE" },
      { injectIfMissing: false }
    );
    const state = response?.data || {};
    lastRuntimeState = state;
    const busy = Boolean(state.autofillInProgress);
    if (els.startAutofillBtn) {
      els.startAutofillBtn.disabled = busy;
      els.startAutofillBtn.textContent = busy ? "处理中..." : DEFAULT_START_LABEL;
    }
    if (state.autofillSummary) {
      const summary = state.autofillSummary;
      const pending = pendingCount(summary);
      setStatus(summary.message || (pending > 0
        ? `上次填写结束，仍需处理 ${pending} 项。`
        : `上次填写结束，已填写 ${summary.filled || 0} 项。`));
      renderDetails(summary);
    }
  } catch {
    if (els.startAutofillBtn) {
      els.startAutofillBtn.disabled = false;
      els.startAutofillBtn.textContent = DEFAULT_START_LABEL;
    }
  }
}

async function startAutofill() {
  try {
    if (els.startAutofillBtn) {
      els.startAutofillBtn.disabled = true;
      els.startAutofillBtn.textContent = "处理中...";
    }
    setStatus("正在本地扫描当前页面并准备填写...");
    await ensureCurrentContentScript();
    const response = await sendToActiveTab({ type: "OJAF_START_AUTOFILL" });
    const data = response?.data || {};
    if (data.ok && data.filled != null) {
      const pending = pendingCount(data);
      renderDetails(data);
      setStatus(data.message || (pending > 0
        ? `填写结束，仍需处理 ${pending} 项。请复核后手动提交。`
        : `填写结束，已填写 ${data.filled || 0} 项。请复核后手动提交。`));
    } else if (data.reason === "busy") {
      setStatus("当前已有处理任务，请稍候。", true);
    } else if (data.reason === "no candidates") {
      renderDetails(data);
      setStatus(data.message || "填写结束，仍需处理页面上的字段。", true);
    } else if (data.reason === "view page" || data.reason === "login page") {
      setStatus(data.message || "请先进入飞书简历编辑页并登录后再开始填写。", true);
    } else if (data.reason) {
      setStatus(`处理未完成：${data.reason}`, true);
    } else {
      setStatus("已完成本地扫描。橙色字段需要你手动复核或填写。");
    }
  } catch (error) {
    setStatus(`开始填写失败：${error.message}`, true);
  } finally {
    await syncRuntimeState();
  }
}

async function ensureCurrentContentScript() {
  const tabs = await queryTabs({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error("没有找到当前标签页。");
  }

  // Opening the popup already performs the runtime-state probe. Reuse it so
  // clicking start does not create a second probe or a duplicate injection.
  const state = lastRuntimeState;
  if (!state) {
    // Let the actual start message perform the single fallback injection when
    // the initial probe found no receiver.
    return;
  }
  if (state.autofillInProgress || state.scriptVersion === CONTENT_SCRIPT_VERSION) {
    return;
  }
  await executeScript(tab.id, "src/content.js");
}

function renderDetails(summary = {}) {
  const details = document.getElementById("details");
  const list = document.getElementById("detailsList");
  if (!details || !list) return;
  const items = Array.isArray(summary.details) ? summary.details : [];
  list.textContent = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    const status = item.status === "skipped" ? "已跳过" : "待处理";
    row.textContent = `[${status}] ${item.label || "页面字段"}：${item.reason || "需要手动复核"}`;
    list.append(row);
  });
  details.hidden = items.length === 0;
}

async function clearMarks() {
  try {
    await sendToActiveTab({ type: "OJAF_CLEAR_MARKS" }, { injectIfMissing: false });
    setStatus("已清除颜色标记，不会修改表单内容。");
  } catch (error) {
    setStatus(`清除失败：${error.message}`, true);
  }
}

function pendingCount(summary = {}) {
  return Number(summary.pending ?? Number(summary.skipped || 0) + Number(summary.failed || 0));
}

function setStatus(message, isError = false) {
  if (!els.status) {
    return;
  }
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

async function sendToActiveTab(message, options = {}) {
  const injectIfMissing = options.injectIfMissing !== false;
  const tabs = await queryTabs({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error("没有找到当前标签页。");
  }
  try {
    return await sendTabMessage(tab.id, message);
  } catch (firstError) {
    if (!injectIfMissing || firstError.code !== "NO_RECEIVER") {
      throw firstError;
    }
    await executeScript(tab.id, "src/content.js");
    return sendTabMessage(tab.id, message);
  }
}

function queryTabs(query) {
  return new Promise((resolve) => chrome.tabs.query(query, resolve));
}

function executeScript(tabId, file) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files: [file] }, () => {
      const error = chrome.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve();
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        const wrapped = new Error(error.message);
        wrapped.code = /receiving end does not exist|could not establish connection/i.test(error.message)
          ? "NO_RECEIVER"
          : "TAB_MESSAGE_ERROR";
        reject(wrapped);
      } else if (!response?.ok) {
        const wrapped = new Error(response?.error || "页面消息失败。");
        wrapped.code = "MESSAGE_REJECTED";
        reject(wrapped);
      } else {
        resolve(response);
      }
    });
  });
}
