/**********************************************
 * popup.ts
 * 
 * 1) Builds a UI with a "Run" button, logs panel
 * 2) Reads/writes `isRunning` in chrome.storage.local
 * 3) Listens for runtime messages to update logs or stop
 **********************************************/

interface LogMessage {
  time: string;
  log: string;
  level?: "info" | "error" | "success";
}

// We'll keep track of running state + logs in memory
let isRunning = false;
let logs: LogMessage[] = [];

// References to DOM elements we'll create
let buttonEl: HTMLButtonElement;
let logsContainerEl: HTMLDivElement;

document.addEventListener("DOMContentLoaded", () => {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  // ======== Build the UI ========

  // A wrapper container for everything
  const container = document.createElement("div");
  container.style.minWidth = "200px";
  container.style.minHeight = "80px";
  container.style.fontFamily = "sans-serif";

  // Title
  const heading = document.createElement("h3");
  heading.textContent = "Click to test";
  heading.style.textAlign = "center";
  container.appendChild(heading);

  // "Run" button
  buttonEl = document.createElement("button");
  buttonEl.style.display = "inline-block";
  buttonEl.style.margin = "0 auto";
  buttonEl.style.padding = "8px 16px";
  buttonEl.style.cursor = "pointer";

  buttonEl.addEventListener("click", handleClick);

  // Center the button
  const buttonWrapper = document.createElement("div");
  buttonWrapper.style.textAlign = "center";
  buttonWrapper.appendChild(buttonEl);
  container.appendChild(buttonWrapper);

  // Logs panel (hidden until there's at least one log)
  logsContainerEl = document.createElement("div");
  logsContainerEl.style.marginTop = "16px";
  logsContainerEl.style.textAlign = "left";
  logsContainerEl.style.border = "1px solid #d9d9d9";
  logsContainerEl.style.borderRadius = "4px";
  logsContainerEl.style.padding = "8px";
  logsContainerEl.style.width = "360px";
  logsContainerEl.style.height = "220px";
  logsContainerEl.style.overflowY = "auto";
  logsContainerEl.style.backgroundColor = "#f5f5f5";
  logsContainerEl.style.display = "none"; // hidden if no logs

  // Title for logs
  const logsTitle = document.createElement("div");
  logsTitle.textContent = "Logs:";
  logsTitle.style.fontWeight = "bold";
  logsTitle.style.marginBottom = "8px";
  logsContainerEl.appendChild(logsTitle);

  container.appendChild(logsContainerEl);

  // Add container to #root
  rootEl.appendChild(container);

  // ======== Load initial state from chrome.storage ========

  chrome.storage.local.get(["isRunning"], (result) => {
    if (typeof result.isRunning === "boolean") {
      isRunning = result.isRunning;
    }
    render();
  });

  // ======== Set up message listener ========
  const messageListener = (message: any) => {
    if (message.type === "stop") {
      isRunning = false;
      chrome.storage.local.set({ isRunning: false });
      render();
    } else if (message.type === "log") {
      const time = new Date().toLocaleTimeString();
      logs.push({
        time,
        log: message.log,
        level: message.level || "info",
      });
      render(); // update logs UI
      // Scroll to bottom
      logsContainerEl.scrollTop = logsContainerEl.scrollHeight;
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Cleanup if popup closes (optional).
  // Not strictly necessary since popup is ephemeral, but we do it for completeness.
  window.addEventListener("unload", () => {
    chrome.runtime.onMessage.removeListener(messageListener);
  });
});

/**
 * Called when user clicks the "Run" button.
 */
function handleClick() {
  // Clear old logs
  logs = [];

  isRunning = true;
  chrome.storage.local.set({ isRunning: true });

  // Send a message to background or wherever
  chrome.runtime.sendMessage({ type: "run" });

  render();
}

/**
 * Update the button text + logs panel in the DOM
 * based on current `isRunning` + `logs`.
 */
function render() {
  if (!buttonEl || !logsContainerEl) return;

  // Update button text and disabled state
  if (isRunning) {
    buttonEl.textContent = "Running...";
    buttonEl.disabled = true;
  } else {
    buttonEl.textContent = "Run";
    buttonEl.disabled = false;
  }

  // If logs is empty, hide logsContainer
  if (logs.length === 0) {
    logsContainerEl.style.display = "none";
  } else {
    logsContainerEl.style.display = "block";
  }

  // Remove old log lines (keeping the "Logs:" title as first child)
  while (logsContainerEl.childNodes.length > 1) {
    logsContainerEl.removeChild(logsContainerEl.lastChild!);
  }

  // Add new log lines
  logs.forEach((log) => {
    const line = document.createElement("div");
    line.style.fontSize = "12px";
    line.style.marginBottom = "4px";
    line.style.fontFamily = "monospace";
    const style = getLogStyle(log.level || "info");
    if (style.color) {
      line.style.color = style.color;
    }
    line.textContent = `[${log.time}] ${log.log}`;
    logsContainerEl.appendChild(line);
  });
}

/**
 * Returns inline style for a log line, based on level.
 */
function getLogStyle(level: string): { color?: string } {
  switch (level) {
    case "error":
      return { color: "#ff4d4f" };
    case "success":
      return { color: "#52c41a" };
    default:
      return { color: "#1890ff" };
  }
}
