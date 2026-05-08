/**
 * AI Pet Backend Proxy Server
 * Forwards chat requests to LLM APIs (Claude / OpenAI / DeepSeek / Moonshot / Zhipu / Qwen)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClaudeProvider } from './providers/claude.js';
import { OpenAICompatibleProvider } from './providers/openai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ===== Middleware =====
app.use(cors({
  origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(','),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '100kb' }));

// ===== Simple rate limiting (in-memory) =====
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const timestamps = rateLimitMap.get(ip).filter(t => now - t < RATE_LIMIT_WINDOW);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

  if (timestamps.length > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  next();
}

// ===== Provider Factory =====
// Supported providers and their configurations
const PROVIDER_CONFIGS = {
  claude: {
    type: 'claude',
    envKey: 'CLAUDE_API_KEY',
  },
  openai: {
    type: 'openai-compatible',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    name: 'OpenAI',
  },
  deepseek: {
    type: 'openai-compatible',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    name: 'DeepSeek',
  },
  moonshot: {
    type: 'openai-compatible',
    envKey: 'MOONSHOT_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    name: 'Moonshot (Kimi)',
  },
  zhipu: {
    type: 'openai-compatible',
    envKey: 'ZHIPU_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    name: 'Zhipu (GLM)',
  },
  qwen: {
    type: 'openai-compatible',
    envKey: 'QWEN_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    name: 'Qwen (通义千问)',
  },
};

function getProvider(providerName) {
  const config = PROVIDER_CONFIGS[providerName];
  if (!config) {
    throw new Error(`Unknown provider: ${providerName}. Available: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`);
  }

  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    throw new Error(`${config.envKey} not configured in .env`);
  }

  if (config.type === 'claude') {
    return new ClaudeProvider(apiKey);
  }

  return new OpenAICompatibleProvider(apiKey, {
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    name: config.name,
  });
}

// ===== Routes =====

// Health check
app.get('/api/health', (req, res) => {
  const providers = {};
  for (const [name, config] of Object.entries(PROVIDER_CONFIGS)) {
    providers[name] = !!process.env[config.envKey];
  }
  res.json({ status: 'ok', providers });
});

// Non-streaming chat
app.post('/api/chat', rateLimit, async (req, res) => {
  try {
    const { messages, provider = 'claude', options = {} } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const llm = getProvider(provider);
    const response = await llm.chat(messages, options);

    res.json({ content: response });
  } catch (error) {
    console.error('[Chat Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Streaming chat (SSE)
app.post('/api/chat/stream', rateLimit, async (req, res) => {
  try {
    const { messages, provider = 'claude', options = {} } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const llm = getProvider(provider);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Stream response chunks
    for await (const chunk of llm.chatStream(messages, options)) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    // Signal completion
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Stream Error]', error.message);

    // If headers already sent, send error as SSE event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🐱 AI Pet Server running on http://localhost:${PORT}`);
  const available = Object.entries(PROVIDER_CONFIGS)
    .filter(([_, config]) => !!process.env[config.envKey])
    .map(([name]) => name);
  console.log(`   Available providers: ${available.length > 0 ? available.join(', ') : '(none - configure .env)'}`);
});
