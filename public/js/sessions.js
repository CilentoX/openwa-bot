// === SESSIONS LIFE-CYCLE MODULE ===

import { state } from './state.js';
import { showFeedback, escapeHtml } from './utils.js';
import { loadConfig } from './config.js';
import { fetchContacts } from './chat.js';

const sessionSelect = document.getElementById('session-select');
const infoSessionName = document.getElementById('info-session-name');
const infoSessionPhone = document.getElementById('info-session-phone');
const infoSessionPushname = document.getElementById('info-session-pushname');
const infoSessionStatus = document.getElementById('info-session-status');
const infoSessionConnectedAt = document.getElementById('info-session-connected-at');
const groupsList = document.getElementById('groups-list');
const groupSearch = document.getElementById('group-search');
const webhookForm = document.getElementById('webhook-form');
const webhookUrlInput = document.getElementById('webhook-url');
const btnRegisterWebhook = document.getElementById('btn-register-webhook');
const webhookFeedback = document.getElementById('webhook-feedback');

const createSessionForm = document.getElementById('create-session-form');
const newSessionNameInput = document.getElementById('new-session-name');
const createSessionFeedback = document.getElementById('create-session-feedback');

const btnSessionSetDefault = document.getElementById('btn-session-set-default');
const btnSessionStart = document.getElementById('btn-session-start');
const btnSessionStop = document.getElementById('btn-session-stop');
const btnSessionDelete = document.getElementById('btn-session-delete');
const sessionActionFeedback = document.getElementById('session-action-feedback');
const btnRefreshQr = document.getElementById('btn-refresh-qr');

const sendChatIdInput = document.getElementById('send-chat-id');
const sendTextInput = document.getElementById('send-text');

let qrCodeLoading = false;

// Fetch available sessions from OpenWA
export async function fetchSessions() {
  try {
    const response = await fetch('/api/sessions');
    if (!response.ok) {
      let errMsg = 'Falha ao listar sessões.';
      try {
        const errData = await response.json();
        errMsg = errData.message || (errData.details && typeof errData.details === 'object' ? (errData.details.message || JSON.stringify(errData.details)) : errData.details) || errData.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    const sessions = await response.json();
    
    if (!sessionSelect) return;
    sessionSelect.innerHTML = '';
    
    if (sessions.length === 0) {
      sessionSelect.innerHTML = '<option value="">Nenhuma sessão ativa encontrada</option>';
      return;
    }
    
    sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      option.textContent = `${session.name} (${session.status})`;
      
      if (session.id === state.currentSessionId) {
        option.selected = true;
      }
      sessionSelect.appendChild(option);
    });
    
    // If no active session was selected previously, select the first one
    if (!state.currentSessionId && sessions.length > 0) {
      state.currentSessionId = sessions[0].id;
      sessionSelect.value = state.currentSessionId;
      handleSessionChange();
    }
  } catch (error) {
    console.error('Erro ao carregar sessões:', error);
    if (sessionSelect) {
      sessionSelect.innerHTML = `<option value="">Erro: ${error.message}</option>`;
    }
  }
}

export async function fetchSessionQR(sessionId) {
  if (!sessionId || qrCodeLoading) return;
  const qrContainer = document.getElementById('qr-code-container');
  if (!qrContainer) return;
  
  qrCodeLoading = true;
  try {
    const response = await fetch(`/api/sessions/${sessionId}/qr`);
    if (!response.ok) {
      throw new Error('QR Code expirado ou indisponível no gateway. Aguardando nova tentativa...');
    }
    const data = await response.json();
    if (data.qrCode) {
      qrContainer.innerHTML = `<img src="${data.qrCode}" alt="WhatsApp QR Code" style="max-width: 100%; height: auto; display: block; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">`;
    } else {
      qrContainer.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;">Sem imagem de QR. Recarregando...</div>`;
    }
  } catch (err) {
    console.warn('Erro ao carregar QR code:', err.message);
    qrContainer.innerHTML = `<div style="color:var(--color-red);font-size:0.8rem;text-align:center;padding:12px;">${err.message}</div>`;
  } finally {
    qrCodeLoading = false;
  }
}

// Fetch Details of selected session
export async function fetchSessionDetails(sessionId) {
  if (!sessionId) return;
  
  try {
    const response = await fetch(`/api/sessions/${sessionId}`);
    if (!response.ok) throw new Error('Falha ao carregar detalhes.');
    const session = await response.json();
    
    if (infoSessionName) infoSessionName.textContent = session.name || '-';
    if (infoSessionPhone) infoSessionPhone.textContent = session.phone ? `+${session.phone}` : '-';
    if (infoSessionPushname) infoSessionPushname.textContent = session.pushName || '-';
    
    // Status formatting
    if (infoSessionStatus) {
      infoSessionStatus.textContent = (session.status || 'unknown').toUpperCase();
      if (session.status === 'connected' || session.status === 'ready') {
        infoSessionStatus.className = 'info-value text-green';
      } else if (session.status === 'disconnected') {
        infoSessionStatus.className = 'info-value text-red';
      } else {
        infoSessionStatus.className = 'info-value text-yellow';
      }
    }
    
    if (infoSessionConnectedAt) {
      if (session.connectedAt) {
        const date = new Date(session.connectedAt);
        infoSessionConnectedAt.textContent = date.toLocaleString('pt-BR');
      } else {
        infoSessionConnectedAt.textContent = 'Não conectada';
      }
    }

    // Dynamic QR Code Card Display
    const qrCard = document.getElementById('qr-code-card');
    if (session.status === 'qr_ready') {
      if (qrCard) qrCard.style.display = 'block';
      fetchSessionQR(sessionId);
    } else {
      if (qrCard) {
        qrCard.style.display = 'none';
        const qrContainer = document.getElementById('qr-code-container');
        if (qrContainer) qrContainer.innerHTML = '';
      }
    }
  } catch (error) {
    console.error('Erro ao carregar detalhes da sessão:', error);
    if (infoSessionName) infoSessionName.textContent = 'Erro';
    if (infoSessionStatus) {
      infoSessionStatus.textContent = error.message;
      infoSessionStatus.className = 'info-value text-red';
    }
  }
}

// Fetch groups for selected session
export async function fetchSessionGroups(sessionId) {
  if (!sessionId) {
    state.activeGroups = [];
    renderGroups([]);
    return;
  }
  
  try {
    const response = await fetch(`/api/sessions/${sessionId}/groups`);
    if (!response.ok) throw new Error('Não foi possível carregar grupos.');
    state.activeGroups = await response.json();
    renderGroups(state.activeGroups);
  } catch (error) {
    console.error('Erro ao carregar grupos:', error);
    if (groupsList) {
      groupsList.innerHTML = `
        <div class="no-groups-placeholder">
          <p class="text-red">Erro ao carregar grupos.</p>
          <p class="placeholder-sub">${escapeHtml(error.message)}</p>
        </div>
      `;
    }
    state.activeGroups = [];
  }
}

// Render groups list in Sidebar
export function renderGroups(groups) {
  if (!groupsList) return;
  groupsList.innerHTML = '';
  
  const filterText = groupSearch ? groupSearch.value.trim().toLowerCase() : '';
  const filtered = groups.filter(g => 
    (g.name && g.name.toLowerCase().includes(filterText)) || 
    (g.id && g.id.toLowerCase().includes(filterText))
  );
  
  if (filtered.length === 0) {
    groupsList.innerHTML = `
      <div class="no-groups-placeholder">
        <p>Nenhum grupo encontrado.</p>
        ${groups.length > 0 ? '<p class="placeholder-sub">Tente alterar o filtro de pesquisa.</p>' : ''}
      </div>
    `;
    return;
  }
  
  filtered.forEach(group => {
    const btn = document.createElement('button');
    btn.className = 'group-item-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <span class="group-item-name">${escapeHtml(group.name || 'Sem nome')}</span>
      <span class="group-item-jid">${group.id}</span>
    `;
    
    btn.addEventListener('click', () => {
      if (sendChatIdInput) sendChatIdInput.value = group.id;
      if (sendTextInput) sendTextInput.focus();
      btn.style.borderColor = 'var(--color-green)';
      setTimeout(() => {
        btn.style.borderColor = '';
      }, 1000);
    });
    
    groupsList.appendChild(btn);
  });
}

// Handle session change dropdown
export function handleSessionChange() {
  if (!sessionSelect) return;
  state.currentSessionId = sessionSelect.value;
  
  // Clear details first
  if (infoSessionName) infoSessionName.textContent = 'Carregando...';
  if (infoSessionStatus) {
    infoSessionStatus.textContent = '---';
    infoSessionStatus.className = 'info-value';
  }
  
  if (!state.currentSessionId) {
    if (infoSessionName) infoSessionName.textContent = '-';
    if (infoSessionPhone) infoSessionPhone.textContent = '-';
    if (infoSessionPushname) infoSessionPushname.textContent = '-';
    if (infoSessionConnectedAt) infoSessionConnectedAt.textContent = '-';
    return;
  }
  
  fetchSessionDetails(state.currentSessionId);
  fetchSessionGroups(state.currentSessionId);
  fetchContacts();
}

export function initSessionsPanel() {
  if (sessionSelect) {
    sessionSelect.addEventListener('change', handleSessionChange);
  }

  // Create Session Handler
  if (createSessionForm) {
    createSessionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = newSessionNameInput.value.trim();
      if (!name) return;

      try {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Erro ao criar sessão.');
        }

        showFeedback(createSessionFeedback, `Sessão "${name}" criada com sucesso!`);
        newSessionNameInput.value = '';
        state.currentSessionId = data.id || name;
        await fetchSessions();
        handleSessionChange();
      } catch (err) {
        showFeedback(createSessionFeedback, err.message, true);
      }
    });
  }

  // Register Webhook for selected session
  if (webhookForm) {
    webhookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentSessionId) {
        showFeedback(webhookFeedback, 'Nenhuma sessão ativa selecionada.', true);
        return;
      }
      
      btnRegisterWebhook.disabled = true;
      btnRegisterWebhook.innerHTML = '<span class="spinner"></span> Registrando...';
      
      const url = webhookUrlInput.value.trim();
      
      try {
        const response = await fetch(`/api/sessions/${state.currentSessionId}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        const resData = await response.json();
        
        if (!response.ok) {
          throw new Error(resData.error || 'Erro ao registrar webhook.');
        }
        
        showFeedback(webhookFeedback, `Sucesso! Webhook cadastrado para sessão: ${state.currentSessionId}`);
      } catch (error) {
        showFeedback(webhookFeedback, error.message, true);
      } finally {
        btnRegisterWebhook.disabled = false;
        btnRegisterWebhook.innerHTML = '<span>Registrar Webhook</span>';
      }
    });
  }

  // Session Control Actions
  if (btnSessionSetDefault) {
    btnSessionSetDefault.addEventListener('click', async () => {
      if (!state.currentSessionId) return;
      try {
        const response = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultSessionId: state.currentSessionId })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao definir sessão padrão.');

        showFeedback(sessionActionFeedback, 'Esta sessão foi definida como a padrão do Bot!');
        loadConfig();
      } catch (err) {
        showFeedback(sessionActionFeedback, err.message, true);
      }
    });
  }

  if (btnSessionStart) {
    btnSessionStart.addEventListener('click', async () => {
      if (!state.currentSessionId) return;
      try {
        btnSessionStart.disabled = true;
        const response = await fetch(`/api/sessions/${state.currentSessionId}/start`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || 'Erro ao iniciar sessão.');
        showFeedback(sessionActionFeedback, 'Comando de iniciar enviado com sucesso!');
        await fetchSessionDetails(state.currentSessionId);
      } catch (err) {
        showFeedback(sessionActionFeedback, err.message, true);
      } finally {
        btnSessionStart.disabled = false;
      }
    });
  }

  if (btnSessionStop) {
    btnSessionStop.addEventListener('click', async () => {
      if (!state.currentSessionId) return;
      try {
        btnSessionStop.disabled = true;
        const response = await fetch(`/api/sessions/${state.currentSessionId}/stop`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || 'Erro ao parar sessão.');
        showFeedback(sessionActionFeedback, 'Comando de parar enviado com sucesso!');
        await fetchSessionDetails(state.currentSessionId);
      } catch (err) {
        showFeedback(sessionActionFeedback, err.message, true);
      } finally {
        btnSessionStop.disabled = false;
      }
    });
  }

  if (btnSessionDelete) {
    btnSessionDelete.addEventListener('click', async () => {
      if (!state.currentSessionId) return;
      if (!confirm(`Deseja realmente excluir a sessão "${state.currentSessionId}" permanentemente?`)) return;

      try {
        btnSessionDelete.disabled = true;
        const response = await fetch(`/api/sessions/${state.currentSessionId}`, { method: 'DELETE' });
        if (!response.ok) {
          let errMsg = 'Erro ao excluir sessão.';
          try {
            const errData = await response.json();
            errMsg = errData.message || errData.error || errMsg;
          } catch (_) {}
          throw new Error(errMsg);
        }
        showFeedback(sessionActionFeedback, 'Sessão excluída com sucesso!');
        state.currentSessionId = '';
        await fetchSessions();
      } catch (err) {
        showFeedback(sessionActionFeedback, err.message, true);
      } finally {
        btnSessionDelete.disabled = false;
      }
    });
  }

  if (btnRefreshQr) {
    btnRefreshQr.addEventListener('click', () => {
      if (state.currentSessionId) fetchSessionQR(state.currentSessionId);
    });
  }

  if (groupSearch) {
    groupSearch.addEventListener('input', () => {
      renderGroups(state.activeGroups);
    });
  }
}
