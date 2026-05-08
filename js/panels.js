/**
 * Panels - Settings and Status panel logic
 */

import { storage } from './storage.js';

// ===== Toast Notifications =====

let toastTimeout = null;

export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');

  // Clear previous
  toast.classList.remove('toast--visible', 'toast--error', 'toast--success');
  if (toastTimeout) clearTimeout(toastTimeout);

  // Set content and style
  toastText.textContent = message;
  if (type === 'error') toast.classList.add('toast--error');
  if (type === 'success') toast.classList.add('toast--success');

  // Show
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  // Auto hide
  toastTimeout = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, 3000);
}

// ===== Panel Manager =====

export class PanelManager {
  constructor({ onSettingsSave, onReset }) {
    this.onSettingsSave = onSettingsSave;
    this.onReset = onReset;

    this._bindEvents();
  }

  _bindEvents() {
    // Settings panel
    document.getElementById('btn-settings').addEventListener('click', () => this.openSettings());
    document.getElementById('close-settings').addEventListener('click', () => this.closeSettings());
    document.getElementById('btn-save-settings').addEventListener('click', () => this._saveSettings());
    document.getElementById('btn-clear-history').addEventListener('click', () => this._clearHistory());
    document.getElementById('btn-reset-pet').addEventListener('click', () => this._resetPet());

    // Status panel
    document.getElementById('btn-status').addEventListener('click', () => this.openStatus());
    document.getElementById('close-status').addEventListener('click', () => this.closeStatus());

    // Close on overlay click
    document.getElementById('panel-settings').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeSettings();
    });
    document.getElementById('panel-status').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeStatus();
    });
  }

  // ===== Settings Panel =====

  openSettings() {
    const settings = storage.getSettings();
    const petState = storage.getPetState();

    // Populate form
    document.getElementById('setting-name').value = petState.name;
    document.getElementById('setting-provider').value = settings.provider || 'deepseek';
    document.getElementById('setting-proxy').value = settings.proxy_url || '';

    // Show panel
    document.getElementById('panel-settings').classList.add('panel-overlay--visible');
  }

  closeSettings() {
    document.getElementById('panel-settings').classList.remove('panel-overlay--visible');
  }

  _saveSettings() {
    const name = document.getElementById('setting-name').value.trim();
    const provider = document.getElementById('setting-provider').value;
    const proxyUrl = document.getElementById('setting-proxy').value.trim();

    // Save pet name
    if (name) {
      storage.updatePetState({ name });
      document.getElementById('pet-name').textContent = name;
    }

    // Save settings
    storage.saveSettings({
      provider,
      proxy_url: proxyUrl,
      max_history: 50,
    });

    // Notify app
    if (this.onSettingsSave) {
      this.onSettingsSave({ provider, proxyUrl });
    }

    this.closeSettings();
    showToast('设置已保存', 'success');
  }

  _clearHistory() {
    if (confirm('确定要清除所有对话记忆吗？猫咪会忘掉你们之前的对话。')) {
      storage.clearChatHistory();
      // Clear chat UI
      document.getElementById('chat-messages').innerHTML = '';
      document.getElementById('chat-empty').style.display = 'flex';
      this.closeSettings();
      showToast('对话记忆已清除', 'success');
    }
  }

  _resetPet() {
    if (confirm('确定要重置宠物吗？所有数据（性格、记忆、对话）都会消失，重新开始养成。')) {
      if (confirm('真的确定吗？这个操作不可撤销！')) {
        storage.clearAll();
        if (this.onReset) this.onReset();
        this.closeSettings();
        showToast('宠物已重置，刷新页面开始新旅程', 'success');
        setTimeout(() => location.reload(), 1500);
      }
    }
  }

  // ===== Status Panel =====

  openStatus() {
    this._updateStatusPanel();
    document.getElementById('panel-status').classList.add('panel-overlay--visible');
  }

  closeStatus() {
    document.getElementById('panel-status').classList.remove('panel-overlay--visible');
  }

  _updateStatusPanel() {
    const petState = storage.getPetState();
    const memorySummary = storage.getMemorySummary();
    const { personality, total_interactions, current_mood } = petState;

    // Growth stage
    let stage = '初识';
    if (total_interactions >= 150) stage = '挚友';
    else if (total_interactions >= 50) stage = '亲密';
    else if (total_interactions >= 10) stage = '熟悉';
    document.getElementById('status-stage').textContent = stage;

    // Stats
    document.getElementById('status-interactions').textContent = total_interactions;

    // Mood
    const moodMap = {
      neutral: '平静',
      happy: '开心',
      sad: '低落',
      excited: '兴奋',
      sleepy: '犯困',
      clingy: '撒娇',
    };
    document.getElementById('status-mood').textContent = moodMap[current_mood] || '平静';

    // Personality bars
    this._updateTraitBar('trait-energy', personality.energy);
    this._updateTraitBar('trait-attachment', personality.attachment);
    this._updateTraitBar('trait-sharpness', personality.sharpness);

    // Memory
    const memoryEl = document.getElementById('status-memory');
    if (memorySummary.text) {
      memoryEl.textContent = memorySummary.text;
    } else {
      memoryEl.textContent = '还没有足够的对话来形成记忆...';
    }

    // Update panel title with pet name
    document.querySelector('#panel-status .panel__title').textContent = `${petState.name}的状态`;
  }

  /**
   * Update a trait bar visualization
   * value: -1 to +1, bar shows position relative to center
   */
  _updateTraitBar(id, value) {
    const fill = document.getElementById(id);
    // Convert -1~+1 to percentage position
    // Center is 50%, value maps to fill position
    const percent = ((value + 1) / 2) * 100; // 0-100
    const center = 50;

    if (value >= 0) {
      // Fill from center to right
      fill.style.left = `${center}%`;
      fill.style.width = `${percent - center}%`;
    } else {
      // Fill from left to center
      fill.style.left = `${percent}%`;
      fill.style.width = `${center - percent}%`;
    }
  }
}
