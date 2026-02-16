export interface AgentConfig {
    geminiApiKey: string;
    groqApiKey?: string;
    contextFilePath: string;
    systemPrompt?: string;
}

export interface AIResponse {
    text: string;
    usage?: {
        promptTokens: number;
        responseTokens: number;
    };
}
