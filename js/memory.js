/**
 * Memory Manager - Extracts and maintains a summary of key user information
 * from chat history, updated periodically via LLM
 */

import { LLMClient } from './llm-client.js';
import { storage } from './storage.js';

const SUMMARY_PROMPT = `你是一个记忆整理助手。请从以下猫咪和主人的对话历史中，提取关于主人的关键信息。

对话历史:
{chatHistory}

请提取以下类型的信息（如果对话中有的话）:
- 主人的称呼/名字
- 职业或身份（学生/上班族等）
- 兴趣爱好
- 近期发生的重要事件
- 情绪状态和模式
- 生活习惯（作息等）
- 其他重要的个人信息

用简洁的要点形式返回，每条一行，格式如:
- 主人叫小明，是一个大学生
- 最近在准备期末考试，压力比较大
- 喜欢打游戏和看动漫
- 经常深夜来聊天，可能作息不太规律

如果对话内容太少无法提取有意义的信息，返回: (暂无足够信息)`;

/**
 * Memory manager for maintaining user info summary
 */
export class MemoryManager {
  constructor(llmClient) {
    this.llm = llmClient;
    this.UPDATE_INTERVAL = 10; // Update every 10 interactions
  }

  /**
   * Check if memory summary needs updating and update if so
   * @returns {boolean} Whether an update was performed
   */
  async maybeUpdateSummary() {
    const petState = storage.getPetState();
    const lastUpdate = storage.getMemorySummary().lastUpdate || 0;
    const interactionsSinceUpdate = petState.total_interactions - lastUpdate;

    if (interactionsSinceUpdate < this.UPDATE_INTERVAL) {
      return false;
    }

    await this.updateSummary();
    return true;
  }

  /**
   * Force update the memory summary
   */
  async updateSummary() {
    try {
      const history = storage.getChatHistory();

      if (history.length < 4) {
        // Not enough conversation to summarize
        return;
      }

      // Format recent history for the prompt
      const recentHistory = history.slice(-40); // Last 40 messages
      const formatted = recentHistory
        .map(msg => {
          const role = msg.role === 'user' ? '主人' : '猫咪';
          return `${role}: ${msg.content}`;
        })
        .join('\n');

      const prompt = SUMMARY_PROMPT.replace('{chatHistory}', formatted);

      // Call LLM for summary
      const response = await this.llm.sendMessage(
        [{ role: 'user', content: prompt }],
        { max_tokens: 300, temperature: 0.3 }
      );

      // Save summary
      const petState = storage.getPetState();
      storage.saveMemorySummary({
        text: response.trim(),
        lastUpdate: petState.total_interactions,
        updatedAt: new Date().toISOString(),
      });

      console.log('[Memory] Summary updated:', response.trim().slice(0, 100) + '...');
    } catch (error) {
      console.warn('[Memory] Summary update failed (non-critical):', error.message);
    }
  }

  /**
   * Get the current memory summary text
   * @returns {string} Summary text or empty string
   */
  getSummaryText() {
    const summary = storage.getMemorySummary();
    return summary.text || '';
  }
}
