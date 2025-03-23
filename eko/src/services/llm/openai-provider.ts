import {
  LLMProvider,
  LLMParameters,
  LLMResponse,
  Message,
  LLMStreamHandler,
  ToolCall,
} from '../../types/llm.types';

/**
 * This interface helps us handle partial accumulation of tool call data
 * during streaming responses.
 */
interface PartialToolUse {
  id: string;
  name: string;
  accumulatedJson: string;
}

/**
 * Refactored OpenaiProvider that uses plain fetch() calls (no 'openai' library).
 */
export class OpenaiProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string = 'https://api.openai.com/v1/chat/completions';

  constructor(apiKey: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel ?? 'gpt-4o';

    // Warn if running in a browser environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      console.warn(`
        ⚠️ Security Warning:
        DO NOT use API Keys in browser/frontend code!
        This will expose your credentials and may lead to unauthorized usage.
      `);
    }
  }

  /**
   * Constructs the JSON payload for the OpenAI Chat Completion endpoint,
   * mirroring your existing buildParams logic.
   */
  private buildParams(messages: Message[], params: LLMParameters, stream: boolean) {
    let tools: any[] | undefined;
    if (params.tools && params.tools.length > 0) {
      tools = params.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }));
    }

    let tool_choice: any;
    if (params.toolChoice) {
      if (params.toolChoice.type === 'auto') {
        tool_choice = 'auto';
      } else if (params.toolChoice.type === 'tool') {
        if (params.toolChoice.name) {
          tool_choice = {
            type: 'function',
            function: { name: params.toolChoice.name },
          };
        } else {
          tool_choice = 'required';
        }
      }
    }

    const _messages: any[] = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Handling assistant messages that have structured content
      if (message.role === 'assistant' && typeof message.content !== 'string') {
        let _content: any[] | undefined;
        let _tool_calls: any[] | undefined;

        for (let j = 0; j < message.content.length; j++) {
          // Cast to 'any' to avoid TS unknown-type errors
          const content = message.content[j] as any;
          if (content.type === 'text') {
            if (!_content) {
              _content = [];
            }
            _content.push(content);
          } else if (content.type === 'tool_use') {
            if (!_tool_calls) {
              _tool_calls = [];
            }
            _tool_calls.push({
              id: content.id,
              type: 'function',
              function: {
                name: content.name,
                arguments:
                  typeof content.input === 'string'
                    ? content.input
                    : JSON.stringify(content.input),
              },
            });
          }
        }

        _messages.push({
          role: 'assistant',
          content: _content,
          tool_calls: _tool_calls,
        });

      } else if (message.role === 'user' && typeof message.content !== 'string') {
        // Handling user messages that may have images, etc.
        for (let j = 0; j < message.content.length; j++) {
          // Cast to 'any' to avoid TS unknown-type errors
          const content = message.content[j] as any;
          if (content.type === 'text') {
            _messages.push({
              role: 'user',
              content: content.text,
            });
          } else if (content.type === 'image') {
            _messages.push({
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${content.source.media_type};base64,${content.source.data}`,
                  },
                },
              ],
            });
          } else if (content.type === 'tool_result') {
            const toolResultContent: any[] = [];
            if (content.content === 'string') {
              toolResultContent.push({ type: 'text', text: content.content });
            } else {
              for (let k = 0; k < content.content.length; k++) {
                const item = content.content[k];
                if (item.type === 'text') {
                  toolResultContent.push({ ...item });
                } else if (item.type === 'image') {
                  toolResultContent.push({
                    type: 'image_url',
                    image_url: {
                      url: `data:${item.source.media_type};base64,${item.source.data}`,
                    },
                  });
                }
              }
            }

            const hasImage = toolResultContent.some(s => s.type === 'image_url');
            if (hasImage) {
              // The note: "OpenAI does not support images returned by the tool"
              _messages.push({
                role: 'tool',
                content: 'ok',
                tool_call_id: content.tool_call_id || content.tool_use_id,
              });
              _messages.push({
                role: 'user',
                content: toolResultContent,
              });
            } else {
              _messages.push({
                role: 'tool',
                content: toolResultContent,
                tool_call_id: content.tool_call_id || content.tool_use_id,
              });
            }
          }
        }
      } else {
        // Fallback: no transformation needed
        _messages.push(message);
      }
    }

    return {
      model: params.model || this.defaultModel,
      messages: _messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens ?? 4096,
      stream: stream,
      tools,
      tool_choice,
    };
  }

  /**
   * 1) Non-streaming Chat Completions request
   */
  async generateText(messages: Message[], params: LLMParameters): Promise<LLMResponse> {
    const requestBody = this.buildParams(messages, params, false);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${await response.text()}`);
    }

    const json = await response.json();

    let textContent: string | null = null;
    let toolCalls: ToolCall[] = [];
    let stop_reason: string | null = null;

    for (let i = 0; i < json.choices.length; i++) {
      const choice = json.choices[i];
      const message = choice.message;

      if (message.content) {
        textContent = (textContent ?? '') + message.content;
      }
      if (message.tool_calls) {
        for (let j = 0; j < message.tool_calls.length; j++) {
          const tool_call = message.tool_calls[j];
          toolCalls.push({
            id: tool_call.id,
            name: tool_call.function.name,
            input: JSON.parse(tool_call.function.arguments),
          });
        }
      }
      if (choice.finish_reason) {
        stop_reason = choice.finish_reason;
      }
    }

    const content: unknown[] = [];
    if (textContent) {
      content.push({
        type: 'text',
        text: textContent,
      });
    }
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
        });
      }
    }

    return {
      textContent,
      content,
      toolCalls,
      stop_reason,
    };
  }

  /**
   * 2) Streaming Chat Completions request
   */
  async generateStream(
    messages: Message[],
    params: LLMParameters,
    handler: LLMStreamHandler
  ): Promise<void> {
    const requestBody = this.buildParams(messages, params, true);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      handler.onError?.(new Error(`OpenAI API Error: ${await response.text()}`));
      return;
    }

    if (!response.body) {
      handler.onError?.(new Error(`No response body received for streaming.`));
      return;
    }

    handler.onStart?.();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let textContent: string | null = null;
    let toolCalls: ToolCall[] = [];
    let stop_reason: string | null = null;
    let currentToolUse: PartialToolUse | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Typically, SSE lines are separated by newlines
        const lines = chunk.split('\n').map(line => line.trim());

        for (const line of lines) {
          if (!line || line.startsWith(':')) {
            // Skip empty or comment lines
            continue;
          }
          if (line === '[DONE]' || line === 'data: [DONE]') {
            // The server says streaming is complete
            break;
          }

          const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
          let parsed: any;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            continue; // Skip invalid JSON
          }

          if (!parsed.choices || !parsed.choices.length) continue;

          for (const choice of parsed.choices) {
            if (choice.delta?.content) {
              if (textContent == null) {
                textContent = '';
              }
              textContent += choice.delta.content;
              handler.onContent?.(choice.delta.content);
            }

            // Accumulate tool call fragments
            if (choice.delta?.tool_calls && choice.delta.tool_calls.length > 0) {
              const tool_call = choice.delta.tool_calls[0];
              if (!currentToolUse) {
                currentToolUse = {
                  id: tool_call.id || '',
                  name: tool_call.function?.name || '',
                  accumulatedJson: tool_call.function?.arguments || '',
                };
              } else {
                if (tool_call.id) {
                  currentToolUse.id = tool_call.id;
                }
                if (tool_call.function?.name) {
                  currentToolUse.name = tool_call.function?.name;
                }
                currentToolUse.accumulatedJson += tool_call.function?.arguments || '';
              }
            }

            if (choice.finish_reason) {
              stop_reason = choice.finish_reason;
              // If we have a partially built tool call, finalize it
              if (currentToolUse) {
                const completeToolCall: ToolCall = {
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input: JSON.parse(currentToolUse.accumulatedJson),
                };
                toolCalls.push(completeToolCall);
                handler.onToolUse?.(completeToolCall);
                currentToolUse = null;
              }
            }
          }
        }
      }

      // Final assembly of the content
      const content: unknown[] = [];
      if (textContent) {
        content.push({ type: 'text', text: textContent });
      }
      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.input,
          });
        }
      }

      handler.onComplete?.({
        textContent,
        content,
        toolCalls,
        stop_reason,
      });
    } catch (error) {
      handler.onError?.(error as Error);
    }
  }
}
