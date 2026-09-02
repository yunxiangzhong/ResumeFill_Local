const els = {
  status: document.getElementById("status"),
  openOptions: document.getElementById("openOptions"),
  startAutofillBtn: document.getElementById("startAutofillBtn"),
  showProfilePanelBtn: document.getElementById("showProfilePanelBtn"),
  clearMarksBtn: document.getElementById("clearMarksBtn")
};

const DEFAULT_START_LABEL = els.startAutofillBtn?.textContent || "开始填写";

els.openOptions?.addEventListener("click", () => chrome.runtime.openOptionsPage());
els.startAutofillBtn?.addEventListener("click", () => void startAutofill());
els.showProfilePanelBtn?.addEventListener("click", () => void showProfilePanel());
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
    const response = await sendToActiveTab({ type: "OJAF_GET_RUNTIME_STATE" });
    const state = response?.data || {};
    const busy = Boolean(state.autofillInProgress);
    if (els.startAutofillBtn) {
      els.startAutofillBtn.disabled = busy;
      els.startAutofillBtn.textContent = busy ? "处理中..." : DEFAULT_START_LABEL;
    }
    if (state.autofillSummary) {
      const summary = state.autofillSummary;
      setStatus(`上次填写：已填写 ${summary.filled || 0} 项，待处理 ${pendingCount(summary)} 项。`);
    }
  } catch {
    if (els.startAutofillBtn) {
      els.startAutofillBtn.disabled = false;
      els.startAutofillBtn.textContent = DEFAULT_START_LABEL;
    }
  }
}

async function showProfilePanel() {
  try {
    await sendToActiveTab({ type: "OJAF_SHOW_PROFILE_PANEL" });
    setStatus("已打开资料面板。");
  } catch (error) {
    setStatus(`打开失败：${error.message}`, true);
  }
}

async function startAutofill() {
  try {
    if (els.startAutofillBtn) {
      els.startAutofillBtn.disabled = true;
      els.startAutofillBtn.textContent = "处理中...";
    }
    setStatus("正在本地扫描当前页面并准备填写...");
    const response = await sendToActiveTab({ type: "OJAF_START_AUTOFILL" });
    const data = response?.data || {};
    if (data.ok && data.filled != null) {
      setStatus(`已填写 ${data.filled || 0} 项，待处理 ${pendingCount(data)} 项。请复核后手动提交。`);
    } else if (data.reason === "busy") {
      setStatus("当前已有处理任务，请稍候。", true);
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

async function clearMarks() {
  try {
    await sendToActiveTab({ type: "OJAF_CLEAR_MARKS" });
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

async function sendToActiveTab(message) {
  const tabs = await queryTabs({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error("没有找到当前标签页。");
  }
  try {
    return await sendTabMessage(tab.id, message);
  } catch (firstError) {
    await executeScript(tab.id, "src/content.js");
    try {
      return await sendTabMessage(tab.id, message);
    } catch {
      throw firstError;
    }
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
        reject(new Error(error.message));
      } else if (!response?.ok) {
        reject(new Error(response?.error || "页面消息失败。"));
      } else {
        resolve(response);
      }
    });
  });
}
