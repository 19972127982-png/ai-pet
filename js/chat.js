/**
 * Chat UI Manager - handles message display, input, and chat interaction
 */

export class ChatManager {
  constructor({ onSend }) {
    this.messagesContainer = document.getElementById('chat-messages');
    this.inputField = document.getElementById('input-field');
    this.sendBtn = document.getElementById('send-btn');
    this.onSend = onSend;
    this.typingIndicator = null;

    this._bindEvents();
  }

  /**
   * Bind input events
   */
  _bindEvents() {
    // Send button click
    this.sendBtn.addEventListener('click', () => this._handleSend());

    // Enter key press
    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });
  }

  /**
   * Handle send action
   */
  _handleSend() {
    const text = this.inputField.value.trim();
    if (!text) return;

    this.inputField.value = '';
    this.inputField.focus();

    if (this.onSend) {
      this.onSend(text);
    }
  }

  /**
   * Add a message to the chat UI
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message text
   * @param {object} options - { animate, timestamp }
   */
  addMessage(role, content, options = {}) {
    const { animate = true, timestamp = new Date() } = options;

    const messageEl = document.createElement('div');
    messageEl.className = `message message--${role}`;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message__bubble';
    bubbleEl.textContent = content;

    const timeEl = document.createElement('span');
    timeEl.className = 'message__time';
    timeEl.textContent = this._formatTime(timestamp);

    messageEl.appendChild(bubbleEl);
    messageEl.appendChild(timeEl);

    if (!animate) {
      messageEl.style.animation = 'none';
    }

    this.messagesContainer.appendChild(messageEl);
    this._scrollToBottom();

    return messageEl;
  }

  /**
   * Add message with typewriter effect
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Full message text
   * @param {object} options - { speed }
   * @returns {Promise} Resolves when typing is complete
   */
  addMessageTyping(role, content, options = {}) {
    const { speed = 40 } = options;

    return new Promise((resolve) => {
      const messageEl = document.createElement('div');
      messageEl.className = `message message--${role}`;

      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'message__bubble';
      bubbleEl.textContent = '';

      const timeEl = document.createElement('span');
      timeEl.className = 'message__time';
      timeEl.textContent = this._formatTime(new Date());

      messageEl.appendChild(bubbleEl);
      messageEl.appendChild(timeEl);
      this.messagesContainer.appendChild(messageEl);

      let index = 0;
      const typeChar = () => {
        if (index < content.length) {
          bubbleEl.textContent += content[index];
          index++;
          this._scrollToBottom();
          setTimeout(typeChar, speed);
        } else {
          resolve();
        }
      };

      typeChar();
    });
  }

  /**
   * Create an empty message bubble for streaming content into
   * @param {string} role - 'user' or 'assistant'
   * @returns {object} { element, appendText(chunk), finish() }
   */
  createStreamMessage(role) {
    const messageEl = document.createElement('div');
    messageEl.className = `message message--${role}`;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message__bubble';
    bubbleEl.textContent = '';

    const timeEl = document.createElement('span');
    timeEl.className = 'message__time';
    timeEl.textContent = this._formatTime(new Date());

    messageEl.appendChild(bubbleEl);
    messageEl.appendChild(timeEl);
    this.messagesContainer.appendChild(messageEl);
    this._scrollToBottom();

    return {
      element: messageEl,
      appendText: (chunk) => {
        bubbleEl.textContent += chunk;
        this._scrollToBottom();
      },
      getText: () => bubbleEl.textContent,
      finish: () => {
        // Nothing special needed for now
      }
    };
  }

  /**
   * Show typing indicator (three dots)
   */
  showTyping() {
    if (this.typingIndicator) return;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__dot"></span>
    `;

    this.typingIndicator = indicator;
    this.messagesContainer.appendChild(indicator);
    this._scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  hideTyping() {
    if (this.typingIndicator) {
      this.typingIndicator.remove();
      this.typingIndicator = null;
    }
  }

  /**
   * Load chat history into UI
   * @param {Array} messages - Array of { role, content, timestamp }
   */
  loadHistory(messages) {
    this.messagesContainer.innerHTML = '';

    if (messages.length === 0) {
      return;
    }

    messages.forEach(msg => {
      this.addMessage(msg.role, msg.content, {
        animate: false,
        timestamp: new Date(msg.timestamp)
      });
    });

    this._scrollToBottom();
  }

  /**
   * Clear all messages from UI
   */
  clear() {
    this.messagesContainer.innerHTML = '';
  }

  /**
   * Scroll chat to bottom
   */
  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    });
  }

  /**
   * Format timestamp to HH:MM
   */
  _formatTime(date) {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
