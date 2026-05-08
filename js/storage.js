/**
 * Storage Manager - localStorage CRUD for pet state, chat history, and settings
 */

const STORAGE_KEYS = {
  PET_STATE: 'ai_pet_state',
  CHAT_HISTORY: 'ai_pet_chat_history',
  SETTINGS: 'ai_pet_settings',
  MEMORY_SUMMARY: 'ai_pet_memory_summary'
};

const DEFAULT_PET_STATE = {
  name: '小橘',
  created_at: new Date().toISOString(),
  total_interactions: 0,
  personality: {
    energy: 0,      // -1(安静) ~ +1(活泼)
    attachment: 0,  // -1(独立) ~ +1(粘人)
    sharpness: 0    // -1(温柔) ~ +1(毒舌)
  },
  current_mood: 'neutral',
  mood_intensity: 0.5
};

const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  proxy_url: '',
  max_history: 50
};

class StorageManager {
  /**
   * Get pet state from localStorage
   * @returns {object} Pet state object
   */
  getPetState() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PET_STATE);
      if (data) {
        return JSON.parse(data);
      }
      // Initialize with defaults
      this.savePetState(DEFAULT_PET_STATE);
      return { ...DEFAULT_PET_STATE };
    } catch (e) {
      console.error('[Storage] Failed to get pet state:', e);
      return { ...DEFAULT_PET_STATE };
    }
  }

  /**
   * Save pet state to localStorage
   * @param {object} state - Pet state object
   */
  savePetState(state) {
    try {
      localStorage.setItem(STORAGE_KEYS.PET_STATE, JSON.stringify(state));
    } catch (e) {
      console.error('[Storage] Failed to save pet state:', e);
    }
  }

  /**
   * Update specific fields of pet state
   * @param {object} updates - Partial state to merge
   */
  updatePetState(updates) {
    const current = this.getPetState();
    const updated = { ...current, ...updates };
    this.savePetState(updated);
    return updated;
  }

  /**
   * Get chat history
   * @returns {Array} Array of message objects
   */
  getChatHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (e) {
      console.error('[Storage] Failed to get chat history:', e);
      return [];
    }
  }

  /**
   * Save entire chat history
   * @param {Array} messages - Array of message objects
   */
  saveChatHistory(messages) {
    try {
      const settings = this.getSettings();
      // Trim to max history length
      const trimmed = messages.slice(-settings.max_history);
      localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('[Storage] Failed to save chat history:', e);
    }
  }

  /**
   * Add a single message to chat history
   * @param {object} message - { role, content, timestamp }
   */
  addMessage(message) {
    const history = this.getChatHistory();
    history.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    });
    this.saveChatHistory(history);
    return history;
  }

  /**
   * Get settings
   * @returns {object} Settings object
   */
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
      return { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.error('[Storage] Failed to get settings:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings
   * @param {object} settings - Settings object
   */
  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('[Storage] Failed to save settings:', e);
    }
  }

  /**
   * Clear all pet data (reset)
   */
  clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEYS.PET_STATE);
      localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    } catch (e) {
      console.error('[Storage] Failed to clear data:', e);
    }
  }

  /**
   * Clear only chat history
   */
  clearChatHistory() {
    try {
      localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
    } catch (e) {
      console.error('[Storage] Failed to clear chat history:', e);
    }
  }

  /**
   * Increment interaction count
   */
  incrementInteractions() {
    const state = this.getPetState();
    state.total_interactions += 1;
    this.savePetState(state);
    return state.total_interactions;
  }

  /**
   * Get memory summary
   * @returns {object} { text, lastUpdate, updatedAt }
   */
  getMemorySummary() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMORY_SUMMARY);
      if (data) {
        return JSON.parse(data);
      }
      return { text: '', lastUpdate: 0, updatedAt: null };
    } catch (e) {
      console.error('[Storage] Failed to get memory summary:', e);
      return { text: '', lastUpdate: 0, updatedAt: null };
    }
  }

  /**
   * Save memory summary
   * @param {object} summary - { text, lastUpdate, updatedAt }
   */
  saveMemorySummary(summary) {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMORY_SUMMARY, JSON.stringify(summary));
    } catch (e) {
      console.error('[Storage] Failed to save memory summary:', e);
    }
  }
}

export const storage = new StorageManager();
export { DEFAULT_PET_STATE, DEFAULT_SETTINGS };
