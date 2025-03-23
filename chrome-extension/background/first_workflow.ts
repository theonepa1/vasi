import { Eko } from "@/core/eko";
import { LLMConfig, WorkflowCallback } from "@/types";
import { getLLMConfig } from "@/extension/core";

export async function main(prompt: string) {
  // Load LLM model configuration
  // the current browser plugin project provides a page for configuring LLM parameters
  let config = await getLLMConfig();
  if (!config || !config.apiKey) {
    printLog("Please configure apiKey", "error");
    return;
  }

  // Initialize eko
  let eko = new Eko(config as LLMConfig);

  // Generate a workflow from natural language description
  const workflow = await eko.generate(prompt);

  // Execute the workflow
  await eko.execute(workflow, hookLogs());
}

function hookLogs(): WorkflowCallback {
  return {
    hooks: {
      beforeWorkflow: async (workflow) => {
        printLog("Start workflow: " + workflow.name);
      },
      beforeSubtask: async (subtask, context) => {
        printLog("> subtask: " + subtask.name);
      },
      beforeToolUse: async (tool, context, input) => {
        printLog("> tool: " + tool.name);
        return input;
      },
      afterToolUse: async (tool, context, result) => {
        printLog("  tool: " + tool.name + " completed", "success");
        return result;
      },
      afterSubtask: async (subtask, context, result) => {
        printLog("  subtask: " + subtask.name + " completed", "success");
        return result;
      },
      afterWorkflow: async (workflow, variables) => {
        printLog("Completed", "success");
      },
    },
  };
}

function printLog(log: string, level?: "info" | "success" | "error") {
  chrome.runtime.sendMessage({ type: "log", log, level: level || "info" });
}
