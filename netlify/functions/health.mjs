/**
 * Netlify Function: /api/health
 */

const PROVIDERS = ['DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'MOONSHOT_API_KEY', 'ZHIPU_API_KEY', 'QWEN_API_KEY'];

export default async (req, context) => {
  const providers = {};
  for (const key of PROVIDERS) {
    const name = key.replace('_API_KEY', '').toLowerCase();
    providers[name] = !!process.env[key];
  }

  return new Response(JSON.stringify({ status: 'ok', providers }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: "/api/health"
};
