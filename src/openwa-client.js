const { getConfig } = require('./config-manager');

/** Build the base API URL dynamically (always ends with /api) */
async function getApiUrl() {
  let openwaUrl = await getConfig('openwa_url');
  let url = (openwaUrl || 'https://openwa.qwertyatlas.online').trim();
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

  const apiKey = await getConfig('api_key');
  if (apiKey) {
    headers['x-api-key'] = apiKey;
    headers['X-API-Key'] = apiKey;
  }

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
    wrapped.details = { originalError: error.message };
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

module.exports = {
  getApiUrl,
  openwaRequest,
  sendTextMessage
};
