/**
 * LLM Client - Frontend module for communicating with the backend proxy
 */

export class LLMClient {
  constructor({ proxyUrl = '', provider = 'deepseek' } = {}) {
    // If no proxyUrl specified, use relative path (works on Netlify and local with proxy)
    // If running locally with separate server, use http://localhost:3001
    this.proxyUrl = proxyUrl || '';
    this.provider = provider;
  }

  /**
   * Update client configuration
   */
  configure({ proxyUrl, provider }) {
    if (proxyUrl !== undefined) this.proxyUrl = proxyUrl;
    if (provider !== undefined) this.provider = provider;
  }

  /**
   * Send a non-streaming chat request
   * @param {Array} messages - [{ role, content }]
   * @param {object} options - { model, max_tokens, temperature }
   * @returns {Promise<string>} Response text
   */
  async sendMessage(messages, options = {}) {
    const response = await fetch(`${this.proxyUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        provider: this.provider,
        options,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.content;
  }

  /**
   * Send a streaming chat request
   * @param {Array} messages - [{ role, content }]
   * @param {object} options - { model, max_tokens, temperature }
   * @param {function} onChunk - Callback for each text chunk: (text) => void
   * @returns {Promise<string>} Full response text when complete
   */
  async sendMessageStream(messages, options = {}, onChunk) {
    const response = await fetch(`${this.proxyUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        provider: this.provider,
        options,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          if (data === '[DONE]') {
            return fullText;
          }

          try {
            const event = JSON.parse(data);

            if (event.error) {
              throw new Error(event.error);
            }

            if (event.text) {
              fullText += event.text;
              if (onChunk) {
                onChunk(event.text);
              }
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) {
              throw e; // Re-throw non-parse errors
            }
          }
        }
      }
    }

    return fullText;
  }

  /**
   * Check if the backend server is healthy
   * @returns {Promise<object>} { status, providers }
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.proxyUrl}/api/health`);
      if (!response.ok) throw new Error('Server not available');
      return await response.json();
    } catch (e) {
      return { status: 'offline', providers: {} };
    }
  }
}
