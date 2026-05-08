/**
 * Claude (Anthropic) LLM Provider
 * Uses the Messages API with streaming support
 */

import { LLMProvider } from './base.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export class ClaudeProvider extends LLMProvider {
  constructor(apiKey) {
    super(apiKey);
  }

  /**
   * Non-streaming chat
   */
  async chat(messages, options = {}) {
    const { model = 'claude-sonnet-4-20250514', max_tokens = 512, temperature = 0.8 } = options;

    const { systemPrompt, chatMessages } = this._separateSystem(messages);

    const body = {
      model,
      max_tokens,
      temperature,
      messages: chatMessages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Streaming chat - yields text chunks
   */
  async *chatStream(messages, options = {}) {
    const { model = 'claude-sonnet-4-20250514', max_tokens = 512, temperature = 0.8 } = options;

    const { systemPrompt, chatMessages } = this._separateSystem(messages);

    const body = {
      model,
      max_tokens,
      temperature,
      stream: true,
      messages: chatMessages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error (${response.status}): ${error}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta?.text) {
              yield event.delta.text;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  /**
   * Separate system message from chat messages
   * (Anthropic uses a separate `system` field)
   */
  _separateSystem(messages) {
    let systemPrompt = '';
    const chatMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n';
      } else {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }

    return { systemPrompt: systemPrompt.trim(), chatMessages };
  }
}
