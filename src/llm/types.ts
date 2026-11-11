export interface FunctionCallItem {
  name: string;
  args: Record<string, any>;
  id?: string;
  thoughtSignature?: string;
}

export interface ContentPart {
  text?: string;
  functionCall?: FunctionCallItem;
  functionResponse?: {
    name: string;
    response: Record<string, any>;
  };
}

export interface ContentItem {
  role: "user" | "model";
  parts: ContentPart[];
}

export interface LLMResponse {
  text?: string;
  functionCalls?: FunctionCallItem[];
  modelParts?: any[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMGenerateOptions {
  disableTools?: boolean;
}

export interface LLMClientInterface {
  generate(
    contents: ContentItem[],
    systemInstruction?: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse>;
}
