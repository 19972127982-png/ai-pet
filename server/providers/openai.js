/**
 * OpenAI-Compatible LLM Provider
 * Works with: OpenAI, DeepSeek, Moonshot (Kimi), Zhipu (GLM), Qwen, and any OpenAI-compatible API
 */

import { LLMProvider } from './base.js';

export class OpenAICompatibleProvider extends LLMProvider {
  /**
   * @param {string} apiKey - API key
   * @param {object} config - { baseUrl, defaultModel, name }
   */
  constructor(apiKey, config = {}) {
    super(apiKey);
    this.baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.defaultModel = config.defaultModel || 'gpt-4o-mini';
    this.name = config.name || 'OpenAI-Compatible';
  }

  /**
   * Non-streaming chat
   */
  async chat(messages, options = {}) {
    const { model = this.defaultModel, max_tokens = 512, temperature = 0.8 } = options;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens,
        temperature,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Streaming chat - yields text chunks
   */
  async *chatStream(messages, options = {}) {
    const { model = this.defaultModel, max_tokens = 512, temperature = 0.8 } = options;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens,
        temperature,
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error (${response.status}): ${error}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;

          try {
            const event = JSON.parse(data);
            const content = event.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  }
}
