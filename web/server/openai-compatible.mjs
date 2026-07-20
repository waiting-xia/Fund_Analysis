const BLOCKED_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding']);

function cleanUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('MODEL_ENDPOINT_INVALID');
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function resolveChatCompletionsUrl(env = process.env) {
  const explicit = env.OPENAI_CHAT_COMPLETIONS_URL?.trim();
  if (explicit) return cleanUrl(explicit);
  const base = cleanUrl(env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

function parseExtraHeaders(raw) {
  if (!raw?.trim()) return {};
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('OPENAI_EXTRA_HEADERS_JSON_INVALID'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('OPENAI_EXTRA_HEADERS_JSON_INVALID');
  const headers = {};
  for (const [name, value] of Object.entries(parsed)) {
    const normalized = name.trim().toLowerCase();
    if (!normalized || BLOCKED_HEADERS.has(normalized) || typeof value !== 'string' || /[\r\n]/.test(name + value)) {
      throw new Error('OPENAI_EXTRA_HEADERS_JSON_INVALID');
    }
    headers[name] = value;
  }
  return headers;
}

export function getOpenAICompatibleConfig(env = process.env) {
  const apiKey = env.OPENAI_API_KEY?.trim() || '';
  const endpoint = resolveChatCompletionsUrl(env);
  const model = env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini';
  const authHeader = env.OPENAI_AUTH_HEADER?.trim() || 'Authorization';
  const authScheme = env.OPENAI_AUTH_SCHEME === undefined ? 'Bearer' : env.OPENAI_AUTH_SCHEME.trim();
  if (!authHeader || /[\r\n:]/.test(authHeader) || BLOCKED_HEADERS.has(authHeader.toLowerCase())) throw new Error('OPENAI_AUTH_HEADER_INVALID');
  const timeout = Number(env.OPENAI_TIMEOUT_MS || 90_000);
  return {
    apiKey,
    endpoint,
    model,
    authHeader,
    authScheme,
    extraHeaders: parseExtraHeaders(env.OPENAI_EXTRA_HEADERS_JSON),
    timeoutMs: Number.isFinite(timeout) ? Math.max(5_000, Math.min(timeout, 300_000)) : 90_000,
  };
}

function responseText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : '').join('').trim();
  }
  return '';
}

export async function createChatCompletion(messages, env = process.env, fetchImpl = fetch) {
  const config = getOpenAICompatibleConfig(env);
  if (!config.apiKey) throw new Error('AI_SERVICE_NOT_CONFIGURED');
  const authValue = config.authScheme ? `${config.authScheme} ${config.apiKey}` : config.apiKey;
  const response = await fetchImpl(config.endpoint, {
    method: 'POST',
    headers: { ...config.extraHeaders, [config.authHeader]: authValue, 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.model, messages }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const upstream = payload?.error?.message || payload?.message;
    const error = new Error(`MODEL_HTTP_${response.status}`);
    error.upstreamMessage = typeof upstream === 'string' ? upstream.slice(0, 300) : '';
    throw error;
  }
  const content = responseText(payload);
  if (!content) throw new Error('MODEL_RESPONSE_INVALID');
  return { content, model: payload?.model || config.model, endpoint: config.endpoint };
}

export function modelStatus(env = process.env) {
  try {
    const config = getOpenAICompatibleConfig(env);
    const url = new URL(config.endpoint);
    return {
      configured: Boolean(config.apiKey),
      protocol: 'openai-chat-completions',
      model: config.model,
      providerHost: url.host,
      endpointPath: url.pathname,
      authHeader: config.authHeader,
      extraHeaders: Object.keys(config.extraHeaders),
    };
  } catch (error) {
    return { configured: false, protocol: 'openai-chat-completions', error: error instanceof Error ? error.message : 'MODEL_CONFIG_INVALID' };
  }
}
