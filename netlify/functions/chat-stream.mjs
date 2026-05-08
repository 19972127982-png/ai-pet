/**
 * Netlify Function: /api/chat
 * Handles both streaming and non-streaming chat requests
 * Supports: DeepSeek, OpenAI, Claude, Moonshot, Zhipu, Qwen
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

// Claude has a different API format
async function callClaude(messages, options, apiKey, config) {
  let systemPrompt = '';
  const chatMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += msg.content + '\n';
    } else {
      chatMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const body = {
    model: options.model || config.defaultModel,
    max_tokens: options.max_tokens || 512,
    temperature: options.temperature || 0.8,
    stream: true,
    messages: chatMessages,
  };
  if (systemPrompt.trim()) body.system = systemPrompt.trim();

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  return response;
}

// OpenAI-compatible providers
async function callOpenAICompatible(messages, options, apiKey, config) {
  const body = {
    model: options.model || config.defaultModel,
    max_tokens: options.max_tokens || 512,
    temperature: options.temperature || 0.8,
    stream: true,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  return response;
}

export default async (req, context) => {
  // Only accept POST
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
      return new Response(JSON.stringify({
        error: `Unknown provider: ${provider}. Available: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const apiKey = process.env[config.envKey];
    if (!apiKey) {
      return new Response(JSON.stringify({ error: `${config.envKey} not configured` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Call the appropriate provider
    let upstreamResponse;
    if (config.isClaude) {
      upstreamResponse = await callClaude(messages, options, apiKey, config);
    } else {
      upstreamResponse = await callOpenAICompatible(messages, options, apiKey, config);
    }

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      return new Response(JSON.stringify({ error: `Provider error (${upstreamResponse.status}): ${errorText.slice(0, 200)}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response back as SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process upstream stream in background
    (async () => {
      try {
        const reader = upstreamResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              let text = '';

              if (config.isClaude) {
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  text = event.delta.text;
                }
              } else {
                text = event.choices?.[0]?.delta?.content || '';
              }

              if (text) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch (e) {
              // skip
            }
          }
        }

        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: "/api/chat/stream"
};
