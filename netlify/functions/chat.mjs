/**
 * Netlify Function: /api/chat (non-streaming)
 * Used for personality analysis and memory summarization
 */

const PROVIDER_CONFIGS = {
  deepseek: {
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
  },
  openai: {
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
  },
  claude: {
    envKey: 'CLAUDE_API_KEY',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-20250514',
    isClaude: true,
  },
  moonshot: {
    envKey: 'MOONSHOT_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'moonshot-v1-8k',
  },
  zhipu: {
    envKey: 'ZHIPU_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-flash',
  },
  qwen: {
    envKey: 'QWEN_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-turbo',
  },
};

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messages, provider = 'deepseek', options = {} } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env[config.envKey];
    if (!apiKey) {
      return new Response(JSON.stringify({ error: `${config.envKey} not configured` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let responseText;

    if (config.isClaude) {
      // Claude API
      let systemPrompt = '';
      const chatMessages = [];
      for (const msg of messages) {
        if (msg.role === 'system') systemPrompt += msg.content + '\n';
        else chatMessages.push({ role: msg.role, content: msg.content });
      }

      const body = {
        model: options.model || config.defaultModel,
        max_tokens: options.max_tokens || 512,
        temperature: options.temperature || 0.8,
        messages: chatMessages,
      };
      if (systemPrompt.trim()) body.system = systemPrompt.trim();

      const res = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude error (${res.status}): ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      responseText = data.content[0].text;
    } else {
      // OpenAI-compatible
      const res = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.model || config.defaultModel,
          max_tokens: options.max_tokens || 512,
          temperature: options.temperature || 0.8,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Provider error (${res.status}): ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      responseText = data.choices[0].message.content;
    }

    return new Response(JSON.stringify({ content: responseText }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: "/api/chat"
};
