/**********************************************
 * options.ts
 * 
 * Compile (e.g. via tsc or Rollup) to produce
 * "options.js" which is included in options.html
 **********************************************/

interface LLMConfig {
  llm: string;
  apiKey: string;
  modelName: string;
  options: {
    baseURL: string;
  };
}

const modelLLMs = [
  { value: "claude", label: "Claude (default)" },
  { value: "openai", label: "OpenAI" },
];

const modelOptions: Record<string, { value: string; label: string }[]> = {
  claude: [
    {
      value: "claude-3-5-sonnet-20241022",
      label: "Claude 3.5 Sonnet (default)",
    },
    {
      value: "claude-3-opus-20240229",
      label: "Claude 3 Opus",
    },
  ],
  openai: [
    { value: "gpt-4o", label: "gpt-4o (default)" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4", label: "gpt-4" },
  ],
};

// We'll run our code after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  // 1) Create a form element to hold everything
  const formEl = document.createElement("form");
  formEl.style.maxWidth = "400px";

  // 2) Create fields: LLM, Base URL, Model Name, API Key
  //    We'll append these to `formEl`.

  // Helper to create label+input or label+select quickly
  function createField(
    labelText: string,
    element: HTMLInputElement | HTMLSelectElement
  ) {
    const fieldDiv = document.createElement("div");
    fieldDiv.style.marginBottom = "12px";

    const labelEl = document.createElement("label");
    labelEl.textContent = labelText;
    labelEl.style.display = "block";
    labelEl.style.marginBottom = "4px";

    fieldDiv.appendChild(labelEl);
    fieldDiv.appendChild(element);
    return fieldDiv;
  }

  // --- LLM field (select) ---
  const llmSelect = document.createElement("select");
  llmSelect.id = "llm";
  modelLLMs.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    llmSelect.appendChild(option);
  });
  formEl.appendChild(createField("LLM", llmSelect));

  // --- Base URL field (text) ---
  const baseURLInput = document.createElement("input");
  baseURLInput.id = "baseURL";
  baseURLInput.type = "text";
  baseURLInput.placeholder = "Please enter the base URL";
  formEl.appendChild(createField("Base URL", baseURLInput));

  // --- Model Name field (select) ---
  const modelNameSelect = document.createElement("select");
  modelNameSelect.id = "modelName";
  formEl.appendChild(createField("Model Name", modelNameSelect));

  // --- API Key field (password) ---
  const apiKeyInput = document.createElement("input");
  apiKeyInput.id = "apiKey";
  apiKeyInput.type = "password";
  apiKeyInput.placeholder = "Please enter the API Key";
  formEl.appendChild(createField("API Key", apiKeyInput));

  // 3) Create Save button
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "Save";
  saveButton.style.padding = "8px";
  saveButton.style.cursor = "pointer";
  formEl.appendChild(saveButton);

  // 4) Create a message area for success/error
  const messageEl = document.createElement("div");
  messageEl.style.marginTop = "16px";
  formEl.appendChild(messageEl);

  // Finally, attach the form to #root
  rootEl.appendChild(formEl);

  // Function to show messages
  function showMessage(msg: string, isError = false) {
    messageEl.textContent = msg;
    messageEl.style.color = isError ? "red" : "green";
  }

  // Helper: populate modelName <select> for a given LLM
  function populateModelSelect(llmValue: string) {
    modelNameSelect.innerHTML = ""; // clear
    const models = modelOptions[llmValue] || [];
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.label;
      modelNameSelect.appendChild(option);
    });
  }

  // Default config
  const defaultConfig: LLMConfig = {
    llm: "claude",
    apiKey: "",
    modelName: "claude-3-5-sonnet-20241022",
    options: {
      baseURL: "https://api.anthropic.com",
    },
  };

  // 5) Load from chrome.storage and set form fields
  chrome.storage.sync.get(["llmConfig"], (result) => {
    const storedConfig: LLMConfig = result.llmConfig || {};
    const config: LLMConfig = { ...defaultConfig, ...storedConfig };

    llmSelect.value = config.llm;
    baseURLInput.value = config.options.baseURL;
    // Populate model <select>, then set selection
    populateModelSelect(config.llm);
    modelNameSelect.value = config.modelName;
    apiKeyInput.value = config.apiKey;
  });

  // 6) If LLM changes, update baseURL + re-populate modelName
  llmSelect.addEventListener("change", () => {
    if (llmSelect.value === "openai") {
      baseURLInput.value = "https://api.openai.com/v1";
    } else {
      baseURLInput.value = "https://api.anthropic.com";
    }
    populateModelSelect(llmSelect.value);
    modelNameSelect.value = modelOptions[llmSelect.value][0]?.value || "";
  });

  // 7) Handle form submission
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();

    // Simple validation
    if (!llmSelect.value || !baseURLInput.value || !modelNameSelect.value || !apiKeyInput.value) {
      showMessage("Please fill all fields.", true);
      return;
    }

    const newConfig: LLMConfig = {
      llm: llmSelect.value,
      apiKey: apiKeyInput.value,
      modelName: modelNameSelect.value,
      options: {
        baseURL: baseURLInput.value,
      },
    };

    chrome.storage.sync.set({ llmConfig: newConfig }, () => {
      showMessage("Save Success!", false);
    });
  });
});
