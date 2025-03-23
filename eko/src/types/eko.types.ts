import { LLMProvider } from './llm.types';
import { Tool } from './action.types';



export interface OpenaiConfig {
  llm: 'openai';
  apiKey: string;
  modelName?: string;
}

export type LLMConfig = OpenaiConfig | LLMProvider;

export interface EkoConfig {
  workingWindowId?: number,
}

export interface EkoInvokeParam {
  tools?: Array<string> | Array<Tool<any, any>>;
}
