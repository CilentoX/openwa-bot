const { getConfig } = require('./config-manager');

/**
 * Build the base API URL dynamically.
 * Priority:
 *   1. OPENWA_API_URL env var (Docker internal network - direct connection)
 *   2. SQLite config 'openwa_url' (user-configured via dashboard)
 *   3. Fallback default
 *
 * The returned URL always ends with /api
 */
async function getApiUrl() {
  // Priority 1: Environment variable (Docker internal network)
  if (process.env.OPENWA_API_URL) {
    let url = process.env.OPENWA_API_URL.trim().replace(/\/$/, '');
    if (!url.endsWith('/api')) {
      url += '/api';
    }
    return url;
  }

  // Priority 2: SQLite config (user-configured)
  let openwaUrl = await getConfig('openwa_url');
  let url = (openwaUrl || 'http://openwa-api:2785').trim();
  url = url.replace(/\/$/, '');
  if (!url.endsWith('/api')) {
    url += '/api';
  }
  return url;
}

/** Make authenticated requests to OpenWA Gateway */
async function openwaRequest(routePath, options = {}) {
  const baseUrl = await getApiUrl();
  const url = `${baseUrl}/${routePath.replace(/^\//, '')}`;

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'OpenWA-Bot/1.0.0',
    ...options.headers
  };

  // Get API key from env var or SQLite config
  let apiKey = process.env.OPENWA_API_KEY || null;
  if (!apiKey) {
    apiKey = await getConfig('api_key');
  }

  if (apiKey) {
    headers['X-API-Key'] = apiKey.trim();
  }

  console.log(`📡 [OpenWA] ${options.method || 'GET'} ${url} | Key: ${apiKey ? apiKey.substring(0, 12) + '...' : 'NONE'}`);

  const fetchOptions = { ...options, headers };

  try {
    const response = await fetch(url, fetchOptions);

    if (response.status === 204) {
      return { success: true };
    }

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { rawResponse: text };
      }
    }

    if (!response.ok) {
      const err = new Error(data.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.details = data;
      throw err;
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    const wrapped = new Error(`Conexão falhou: ${error.message}`);
    wrapped.status = 502;
    wrapped.details = { originalError: error.message, url };
    throw wrapped;
  }
}

/** Send text message via OpenWA API */
async function sendTextMessage(sessionId, chatId, text) {
  try {
    const resData = await openwaRequest(`sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId, text })
    });
    return { success: true, data: resData };
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem (Sessão: ${sessionId}, Chat: ${chatId}): ${error.message}`);
    return { success: false, error: error.message || error };
  }
}

/** Ensure the internal webhook is registered for a given session */
async function ensureWebhookRegistered(sessionId) {
  if (!sessionId) return;

  const targetUrl = process.env.BOT_WEBHOOK_URL || 'http://openwa-bot:3000/webhook';

  try {
    // 1. Get current webhooks for this session
    const webhooks = await openwaRequest(`sessions/${sessionId}/webhooks`);
    
    // 2. Check if already exists and is active
    const exists = Array.isArray(webhooks) && webhooks.some(w => w.url === targetUrl && w.active);
    
    if (!exists) {
      console.log(`🔗 [Webhook] Registrar webhook automático: ${targetUrl} na sessão ${sessionId}...`);
      await openwaRequest(`sessions/${sessionId}/webhooks`, {
        method: 'POST',
        body: JSON.stringify({
          url: targetUrl,
          events: ['message.received'],
          retryCount: 3
        })
      });
      console.log(`✅ [Webhook] Webhook registrado com sucesso!`);
    }
  } catch (error) {
    console.error(`⚠️ [Webhook] Não foi possível verificar/registrar o webhook automático para a sessão ${sessionId}: ${error.message}`);
  }
}

module.exports = {
  getApiUrl,
  openwaRequest,
  sendTextMessage,
  ensureWebhookRegistered
};

