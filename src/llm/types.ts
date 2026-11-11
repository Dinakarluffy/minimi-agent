export interface FunctionCallItem {
  name: string;
  args: Record<string, any>;
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
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMClientInterface {
  generate(contents: ContentItem[], systemInstruction?: string): Promise<LLMResponse>;
}
