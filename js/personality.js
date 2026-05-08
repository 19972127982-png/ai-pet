/**
 * Personality Engine - Analyzes conversations and evolves cat personality over time
 */

import { LLMClient } from './llm-client.js';
import { storage } from './storage.js';

const ANALYSIS_PROMPT = `你是一个性格分析系统。分析以下对话，判断猫咪的性格应该如何微调。

当前性格参数（范围 -1 到 +1）:
- energy（活泼度）: {energy}
- attachment（粘人度）: {attachment}
- sharpness（毒舌度）: {sharpness}

本轮对话:
用户: "{userMessage}"
猫咪: "{assistantResponse}"

根据用户的说话方式和互动内容，返回性格微调值。
规则:
- 用户话多/热情/使用感叹号 → energy 微增
- 用户话少/安静/深夜聊天 → energy 微减
- 用户表达依赖/想念/经常来聊天 → attachment 微增
- 用户很忙/回复简短/长时间不来 → attachment 微减
- 用户幽默/吐槽/开玩笑 → sharpness 微增
- 用户伤心/脆弱/需要安慰 → sharpness 微减
- 每个维度调整范围: -0.03 到 +0.03
- 大多数情况只需调整 1-2 个维度，不需要每次都调整全部

仅返回 JSON，不要其他文字:
{"energy": 0, "attachment": 0, "sharpness": 0}`;

/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Personality evolution engine
 */
export class PersonalityEngine {
  constructor(llmClient) {
    this.llm = llmClient;
  }

  /**
   * Analyze a conversation turn and evolve personality
   * This runs asynchronously after each conversation, not blocking the UI
   * @param {string} userMessage - What the user said
   * @param {string} assistantResponse - What the cat replied
   * @returns {object|null} The personality delta applied, or null if skipped
   */
  async analyzeAndEvolve(userMessage, assistantResponse) {
    try {
      const petState = storage.getPetState();
      const { energy, attachment, sharpness } = petState.personality;

      // Build analysis prompt
      const prompt = ANALYSIS_PROMPT
        .replace('{energy}', energy.toFixed(2))
        .replace('{attachment}', attachment.toFixed(2))
        .replace('{sharpness}', sharpness.toFixed(2))
        .replace('{userMessage}', userMessage.slice(0, 200))
        .replace('{assistantResponse}', assistantResponse.slice(0, 200));

      // Call LLM for analysis (non-streaming, short response)
      const response = await this.llm.sendMessage(
        [{ role: 'user', content: prompt }],
        { max_tokens: 60, temperature: 0.3 }
      );

      // Parse JSON response
      const delta = this._parseResponse(response);
      if (!delta) return null;

      // Apply delta to personality
      const newPersonality = {
        energy: clamp(energy + delta.energy, -1, 1),
        attachment: clamp(attachment + delta.attachment, -1, 1),
        sharpness: clamp(sharpness + delta.sharpness, -1, 1),
      };

      // Save updated personality
      storage.updatePetState({ personality: newPersonality });

      console.log('[Personality] Evolved:', {
        delta,
        new: newPersonality,
      });

      return delta;
    } catch (error) {
      console.warn('[Personality] Analysis failed (non-critical):', error.message);
      return null;
    }
  }

  /**
   * Parse the LLM response into personality delta
   */
  _parseResponse(response) {
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[^}]+\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and clamp each value
      const delta = {
        energy: clamp(Number(parsed.energy) || 0, -0.05, 0.05),
        attachment: clamp(Number(parsed.attachment) || 0, -0.05, 0.05),
        sharpness: clamp(Number(parsed.sharpness) || 0, -0.05, 0.05),
      };

      // Skip if all zeros (no change needed)
      if (delta.energy === 0 && delta.attachment === 0 && delta.sharpness === 0) {
        return null;
      }

      return delta;
    } catch (e) {
      console.warn('[Personality] Failed to parse response:', response);
      return null;
    }
  }
}
