/**
 * AI Pet - Main Application Entry Point
 */

import { storage } from './storage.js';
import { ChatManager } from './chat.js';
import { CatController } from './cat.js';
import { LLMClient } from './llm-client.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { PersonalityEngine } from './personality.js';
import { MemoryManager } from './memory.js';
import { PanelManager, showToast } from './panels.js';

// ===== Fallback responses (when LLM is unavailable) =====
const FALLBACK_RESPONSES = [
  '喵~ 今天过得怎么样？',
  '嗯嗯，我在听呢~',
  '有你陪着真好呀！',
  '（伸了个懒腰）继续说嘛~',
  '喵呜... 这样啊~',
  '（蹭蹭你的手）',
  '今天有什么开心的事吗？',
  '我刚才差点睡着了...才没有！',
  '喵？你说什么？我在认真听哦！',
  '（歪头看着你）嗯？',
  '好想吃小鱼干... 啊不是，我在听你说话呢！',
  '跟你聊天好开心~',
];

function getRandomFallback() {
  const index = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
  return FALLBACK_RESPONSES[index];
}

// ===== App =====
class App {
  constructor() {
    this.cat = new CatController();
    this.chat = new ChatManager({ onSend: (text) => this.handleUserMessage(text) });
    this.petState = storage.getPetState();
    this.isProcessing = false;
    this.llmAvailable = false;

    // Initialize LLM client
    const settings = storage.getSettings();
    this.llm = new LLMClient({
      proxyUrl: settings.proxy_url || '',
      provider: settings.provider || 'deepseek',
    });

    // Initialize personality engine and memory manager
    this.personality = new PersonalityEngine(this.llm);
    this.memory = new MemoryManager(this.llm);

    // Initialize panels
    this.panels = new PanelManager({
      onSettingsSave: ({ provider, proxyUrl }) => {
        this.llm.configure({ provider, proxyUrl: proxyUrl || '' });
        // Re-check health with new settings
        this._checkHealth();
      },
      onReset: () => {
        // Will reload page, nothing extra needed
      },
    });

    // Bind input state management
    this._bindInputState();

    this._init();
  }

  /**
   * Initialize the app
   */
  async _init() {
    // Set pet name in header
    document.getElementById('pet-name').textContent = this.petState.name;

    // Load chat history
    const history = storage.getChatHistory();
    if (history.length > 0) {
      this.chat.loadHistory(history);
      document.getElementById('chat-empty').classList.add('chat-empty--hidden');
    }

    // Check LLM availability
    await this._checkHealth();

    // Show welcome / returning greeting
    if (this.petState.total_interactions === 0) {
      setTimeout(() => {
        this.cat.showSpeech('你好呀！我是小橘~', 4000);
        this.cat.setMood('happy');
      }, 800);
    } else {
      setTimeout(() => {
        const greetings = [
          '你回来啦！喵~',
          '又见面了！今天好吗？',
          '喵呜~ 想你了！',
          '（开心地摇尾巴）你来啦！',
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        this.cat.showSpeech(greeting, 3000);
        this.cat.setMood('happy');
      }, 500);
    }
  }

  /**
   * Check backend health
   */
  async _checkHealth() {
    const health = await this.llm.checkHealth();
    this.llmAvailable = health.status === 'ok';

    if (!this.llmAvailable) {
      console.warn('[App] LLM server not available, using fallback responses');
    }
  }

  /**
   * Bind send button enable/disable based on input content
   */
  _bindInputState() {
    const input = document.getElementById('input-field');
    const sendBtn = document.getElementById('send-btn');

    input.addEventListener('input', () => {
      if (input.value.trim()) {
        sendBtn.disabled = false;
        sendBtn.classList.remove('send-btn--disabled');
      } else {
        sendBtn.disabled = true;
        sendBtn.classList.add('send-btn--disabled');
      }
    });

    // Handle mobile keyboard - resize viewport
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        document.documentElement.style.setProperty(
          '--vh',
          `${window.visualViewport.height * 0.01}px`
        );
      });
    }
  }

  /**
   * Build messages array with dynamic system prompt
   */
  _buildMessages(userText) {
    const petState = storage.getPetState();
    const memorySummary = this.memory.getSummaryText();
    const systemPrompt = buildSystemPrompt(petState, memorySummary);

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add chat history (last 20 messages for context window)
    const history = storage.getChatHistory();
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current user message
    messages.push({ role: 'user', content: userText });

    return messages;
  }

  /**
   * Handle user sending a message
   */
  async handleUserMessage(text) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Hide empty state
    document.getElementById('chat-empty').classList.add('chat-empty--hidden');

    // Add user message to UI and storage
    this.chat.addMessage('user', text);
    storage.addMessage({ role: 'user', content: text });
    storage.incrementInteractions();

    // Show thinking state
    this.cat.hideSpeech();
    this.chat.showTyping();
    this.cat.startTalking();

    let response = '';

    try {
      if (this.llmAvailable) {
        response = await this._streamLLMResponse(text);
      } else {
        // Try to reconnect
        await this._checkHealth();

        if (this.llmAvailable) {
          response = await this._streamLLMResponse(text);
        } else {
          await this._delay(800 + Math.random() * 800);
          response = getRandomFallback();
          this.chat.hideTyping();
          await this.chat.addMessageTyping('assistant', response, { speed: 50 });
          showToast('后端未连接，使用离线回复', 'error');
        }
      }
    } catch (error) {
      console.error('[App] LLM Error:', error.message);
      this.chat.hideTyping();
      response = getRandomFallback();
      await this.chat.addMessageTyping('assistant', response, { speed: 50 });
      showToast('AI 回复失败: ' + error.message, 'error');
    }

    // Save assistant message
    storage.addMessage({ role: 'assistant', content: response });

    // Update cat state
    this.cat.stopTalking();
    this.cat.setMood('happy');
    this.cat.showSpeech(
      response.length > 20 ? response.slice(0, 20) + '...' : response,
      2000
    );

    this.isProcessing = false;

    // Post-response tasks (async, non-blocking)
    this._postResponseTasks(text, response);
  }

  /**
   * Tasks that run after response (personality evolution, memory update)
   */
  async _postResponseTasks(userMessage, assistantResponse) {
    if (!this.llmAvailable) return;

    try {
      await this.personality.analyzeAndEvolve(userMessage, assistantResponse);
      await this.memory.maybeUpdateSummary();
    } catch (error) {
      console.warn('[App] Post-response tasks error:', error.message);
    }
  }

  /**
   * Stream LLM response with real-time UI updates
   */
  async _streamLLMResponse(userText) {
    const messages = this._buildMessages(userText);

    this.chat.hideTyping();
    const streamMsg = this.chat.createStreamMessage('assistant');

    const fullText = await this.llm.sendMessageStream(
      messages,
      { max_tokens: 256, temperature: 0.85 },
      (chunk) => {
        streamMsg.appendText(chunk);
      }
    );

    streamMsg.finish();
    return fullText;
  }

  /**
   * Utility: delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== Start App =====
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
