// === CONFIGURATION PANEL MODULE ===

import { state } from './state.js';
import { showFeedback, escapeHtml } from './utils.js';
import { fetchSessions } from './sessions.js';

const configForm = document.getElementById('config-form');
const configApiKey = document.getElementById('config-api-key');
const configDefaultSession = document.getElementById('config-default-session');
const configBotName = document.getElementById('config-bot-name');
const configBotPort = document.getElementById('config-bot-port');
const configFeedback = document.getElementById('config-feedback');
const toggleApiKeyVisibility = document.getElementById('toggle-api-key-visibility');
const statusSessionsCount = document.getElementById('status-sessions-count');
const btnTestConnection = document.getElementById('btn-test-connection');
const appTitleName = document.getElementById('app-title-name');

export async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Não foi possível ler as configurações.');
    const data = await response.json();

    if (configApiKey) configApiKey.value = data.apiKey || '';
    if (configDefaultSession) configDefaultSession.value = data.defaultSessionId || '';
    if (configBotName) configBotName.value = data.botName || '';
    if (configBotPort) configBotPort.value = data.port || 3000;

    // Update UI displays
    if (data.botName && appTitleName) {
      appTitleName.innerHTML = `${escapeHtml(data.botName)} <span class="accent-text">Console</span>`;
    }
  } catch (err) {
    console.error('Erro ao ler config:', err);
  }
}

export async function testIntegration() {
  const connectionDot = document.getElementById('connection-dot');
  const connectionText = document.getElementById('connection-text');
  const statusHealthDisplay = document.getElementById('status-health-display');

  if (connectionDot) {
    connectionDot.className = 'status-dot checking';
    connectionText.textContent = 'Verificando...';
  }

  try {
    // 1. Health check proxy call
    const healthRes = await fetch('/api/health');
    if (!healthRes.ok) throw new Error('Gateway Offline');
    const healthData = await healthRes.json();

    if (statusHealthDisplay) {
      statusHealthDisplay.textContent = healthData.status || 'OK';
      statusHealthDisplay.className = 'text-green';
    }

    // 2. Fetch sessions proxy call
    const sessionsRes = await fetch('/api/sessions');
    if (sessionsRes.ok) {
      const sessions = await sessionsRes.json();
      if (statusSessionsCount) statusSessionsCount.textContent = sessions.length;
    } else {
      if (statusSessionsCount) statusSessionsCount.textContent = 'Erro ao listar';
    }

    if (connectionDot) {
      connectionDot.className = 'status-dot online';
      connectionText.textContent = 'Online';
    }
  } catch (err) {
    if (statusHealthDisplay) {
      statusHealthDisplay.textContent = 'Desconectado';
      statusHealthDisplay.className = 'text-red';
    }
    if (statusSessionsCount) statusSessionsCount.textContent = '-';
    if (connectionDot) {
      connectionDot.className = 'status-dot offline';
      connectionText.textContent = 'Offline';
    }
  }
}

// Set up event listeners
export function initConfigPanel() {
  // Toggle API Key eye button
  if (toggleApiKeyVisibility && configApiKey) {
    toggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = configApiKey.type === 'password';
      configApiKey.type = isPassword ? 'text' : 'password';
      toggleApiKeyVisibility.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  // Save configuration
  if (configForm) {
    configForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const response = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: configApiKey.value.trim(),
            defaultSessionId: configDefaultSession.value.trim(),
            botName: configBotName.value.trim(),
            port: Number(configBotPort.value)
          })
        });

        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error || 'Erro ao salvar configurações.');

        showFeedback(configFeedback, 'Configurações salvas no SQLite com sucesso!');
        await loadConfig();
        await testIntegration();
        await fetchSessions();
      } catch (err) {
        showFeedback(configFeedback, err.message, true);
      }
    });
  }

  if (btnTestConnection) {
    btnTestConnection.addEventListener('click', testIntegration);
  }
}
