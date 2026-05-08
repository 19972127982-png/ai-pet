/**
 * LLM Provider Base Class
 * All providers must implement the chat() and chatStream() methods.
 */

export class LLMProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error(`${this.constructor.name}: API key is required`);
    }
    this.apiKey = apiKey;
  }

  /**
   * Send a chat request and return the full response
   * @param {Array} messages - [{ role: 'user'|'assistant'|'system', content: string }]
   * @param {object} options - { model, max_tokens, temperature }
   * @returns {Promise<string>} The assistant's response text
   */
  async chat(messages, options = {}) {
    throw new Error('chat() must be implemented by subclass');
  }

  /**
   * Send a chat request with streaming response
   * @param {Array} messages - [{ role: 'user'|'assistant'|'system', content: string }]
   * @param {object} options - { model, max_tokens, temperature }
   * @returns {AsyncGenerator<string>} Yields text chunks
   */
  async *chatStream(messages, options = {}) {
    throw new Error('chatStream() must be implemented by subclass');
  }
}
