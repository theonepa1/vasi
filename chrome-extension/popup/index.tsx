import { createRoot } from "react-dom/client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "antd";

interface LogMessage {
  time: string;
  log: string;
  level?: "info" | "error" | "success";
}

const AppRun = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chrome.storage.local.get(["isRunning"], (result) => {
      if (result.isRunning !== undefined) {
        setIsRunning(result.isRunning);
      }
    });
    const messageListener = (message: any) => {
      if (message.type === "stop") {
        setIsRunning(false);
        chrome.storage.local.set({ isRunning: false });
      } else if (message.type === "log") {
        const time = new Date().toLocaleTimeString();
        setLogs((prev) => [
          ...prev,
          { time, log: message.log, level: message.level || "info" },
        ]);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const handleClick = () => {
    setLogs([]);
    setIsRunning(true);
    chrome.storage.local.set({ isRunning: true });
    chrome.runtime.sendMessage({ type: "run" });
  };

  const getLogStyle = (level: string) => {
    switch (level) {
      case "error":
        return { color: "#ff4d4f" };
      case "success":
        return { color: "#52c41a" };
      default:
        return { color: "#1890ff" };
    }
  };

  return (
    <div
      style={{
        minWidth: "200px",
        minHeight: "80px",
      }}
    >
      <div
        style={{
          textAlign: "center",
        }}
      >
        <h3>Click to test</h3>
        <Button
          type="primary"
          onClick={handleClick}
          disabled={isRunning}
          className="flex items-center justify-center"
        >
          {isRunning ? "Running..." : "Run"}
        </Button>
      </div>
      {logs.length > 0 && (
        <div
          ref={logsRef}
          style={{
            marginTop: "16px",
            textAlign: "left",
            border: "1px solid #d9d9d9",
            borderRadius: "4px",
            padding: "8px",
            width: "360px",
            height: "220px",
            overflowY: "auto",
            backgroundColor: "#f5f5f5",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "8px" }}>Logs:</div>
          {logs.map((log, index) => (
            <div
              key={index}
              style={{
                fontSize: "12px",
                marginBottom: "4px",
                fontFamily: "monospace",
                ...getLogStyle(log.level || "info"),
              }}
            >
              [{log.time}] {log.log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <AppRun />
  </React.StrictMode>
);
