document.addEventListener('DOMContentLoaded', () => {
  // === TAB NAVIGATION ===
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      // Update buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update panes
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `tab-${tabId}`) {
          pane.classList.add('active');
        }
      });

      // Load tab-specific data
      if (tabId === 'config') {
        loadConfig();
        testIntegration();
      } else if (tabId === 'commands') {
        loadCommands();
      } else if (tabId === 'qna') {
        loadQna();
      } else if (tabId === 'stats') {
        loadStats();
      }
    });
  });

  // === GLOBAL STATE ===
  let messageIds = new Set();
  let activeGroups = [];
  let currentSessionId = '';
  let allCommands = [];
  let allQnas = [];

  // === HELPERS ===
  function showFeedback(element, text, isError = false) {
    if (!element) return;
    element.textContent = text;
    element.className = 'feedback-message ' + (isError ? 'feedback-error' : 'feedback-success');
    element.style.display = 'block';
    
    setTimeout(() => {
      element.style.display = 'none';
    }, 5000);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // === 1. CONFIGURATION TAB ===
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

  // Toggle API Key eye button
  if (toggleApiKeyVisibility) {
    toggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = configApiKey.type === 'password';
      configApiKey.type = isPassword ? 'text' : 'password';
      toggleApiKeyVisibility.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  // Load configuration from database
  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) throw new Error('Não foi possível ler as configurações.');
      const data = await response.json();

      configApiKey.value = data.apiKey || '';
      configDefaultSession.value = data.defaultSessionId || '';
      configBotName.value = data.botName || '';
      configBotPort.value = data.port || 3000;

      // Update UI displays
      if (data.botName) {
        appTitleName.innerHTML = `${escapeHtml(data.botName)} <span class="accent-text">Console</span>`;
      }
    } catch (err) {
      console.error('Erro ao ler config:', err);
    }
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

  // Test OpenWA integration
  async function testIntegration() {
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
        statusSessionsCount.textContent = sessions.length;
      } else {
        statusSessionsCount.textContent = 'Erro ao listar';
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
      statusSessionsCount.textContent = '-';
      if (connectionDot) {
        connectionDot.className = 'status-dot offline';
        connectionText.textContent = 'Offline';
      }
    }
  }

  if (btnTestConnection) {
    btnTestConnection.addEventListener('click', testIntegration);
  }


  // === 2. COMMANDS TAB ===
  const commandForm = document.getElementById('command-form');
  const commandIdInput = document.getElementById('command-id');
  const commandTriggerInput = document.getElementById('command-trigger');
  const commandTypeSelect = document.getElementById('command-type');
  const commandResponseInput = document.getElementById('command-response');
  const commandResponseGroup = document.getElementById('command-response-group');
  const commandDescriptionInput = document.getElementById('command-description');
  const commandEnabledInput = document.getElementById('command-enabled');
  const commandFormTitle = document.getElementById('command-form-title');
  const btnCancelCommand = document.getElementById('btn-cancel-command');
  const commandSearchInput = document.getElementById('command-search');
  const commandsTableBody = document.getElementById('commands-table-body');
  const commandsEmpty = document.getElementById('commands-empty');
  const commandFeedback = document.getElementById('command-feedback');

  // Toggle visibility of response textarea based on command type (dynamic triggers don't need fixed response)
  if (commandTypeSelect) {
    commandTypeSelect.addEventListener('change', () => {
      if (commandTypeSelect.value === 'dynamic') {
        commandResponseGroup.style.display = 'none';
      } else {
        commandResponseGroup.style.display = 'block';
      }
    });
  }

  // Load commands list
  async function loadCommands() {
    try {
      const response = await fetch('/api/commands');
      if (!response.ok) throw new Error('Não foi possível carregar os comandos.');
      allCommands = await response.json();
      renderCommandsTable(allCommands);
    } catch (err) {
      console.error('Erro ao carregar comandos:', err);
    }
  }

  // Render commands table
  function renderCommandsTable(commands) {
    if (!commandsTableBody) return;
    commandsTableBody.innerHTML = '';

    const filterText = commandSearchInput ? commandSearchInput.value.trim().toLowerCase() : '';
    const filtered = commands.filter(c => 
      c.trigger.toLowerCase().includes(filterText) || 
      (c.description && c.description.toLowerCase().includes(filterText)) ||
      (c.response && c.response.toLowerCase().includes(filterText))
    );

    if (filtered.length === 0) {
      commandsEmpty.style.display = 'block';
      return;
    }
    commandsEmpty.style.display = 'none';

    filtered.forEach(cmd => {
      const tr = document.createElement('tr');

      const isEnabled = cmd.enabled === 1;
      const statusBadge = isEnabled 
        ? `<span class="badge badge-success" style="cursor:pointer;" onclick="toggleCommandStatus(${cmd.id})">Ativo</span>`
        : `<span class="badge badge-danger" style="cursor:pointer;" onclick="toggleCommandStatus(${cmd.id})">Inativo</span>`;

      const typeBadge = cmd.type === 'dynamic'
        ? '<span class="badge badge-warning">Dinâmico</span>'
        : '<span class="badge badge-info">Estático</span>';

      tr.innerHTML = `
        <td><strong>${escapeHtml(cmd.trigger)}</strong></td>
        <td>${typeBadge}</td>
        <td><span class="info-label">${escapeHtml(cmd.description || '-')}</span></td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-table-action btn-table-edit" onclick="editCommand(${cmd.id})">✏️ Editar</button>
            <button class="btn-table-action btn-table-delete" onclick="deleteCommand(${cmd.id})">❌ Excluir</button>
          </div>
        </td>
      `;
      commandsTableBody.appendChild(tr);
    });
  }

  // Filter commands typing search box
  if (commandSearchInput) {
    commandSearchInput.addEventListener('input', () => {
      renderCommandsTable(allCommands);
    });
  }

  // Reset/Cancel Command edit state
  function resetCommandForm() {
    commandIdInput.value = '';
    commandTriggerInput.value = '';
    commandTriggerInput.removeAttribute('disabled');
    commandTypeSelect.value = 'static';
    commandResponseInput.value = '';
    commandResponseGroup.style.display = 'block';
    commandDescriptionInput.value = '';
    commandEnabledInput.checked = true;
    commandFormTitle.textContent = '🤖 Criar Novo Comando';
    btnCancelCommand.style.display = 'none';
  }

  if (btnCancelCommand) {
    btnCancelCommand.addEventListener('click', resetCommandForm);
  }

  // Submit create/edit command
  if (commandForm) {
    commandForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = commandIdInput.value;
      const payload = {
        trigger: commandTriggerInput.value.trim(),
        type: commandTypeSelect.value,
        response: commandTypeSelect.value === 'static' ? commandResponseInput.value : '',
        description: commandDescriptionInput.value.trim(),
        enabled: commandEnabledInput.checked ? 1 : 0
      };

      try {
        let response;
        if (id) {
          // Edit
          response = await fetch(`/api/commands/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          // Create
          response = await fetch('/api/commands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao salvar o comando.');

        showFeedback(commandFeedback, id ? 'Comando atualizado com sucesso!' : 'Comando criado com sucesso!');
        resetCommandForm();
        await loadCommands();
      } catch (err) {
        showFeedback(commandFeedback, err.message, true);
      }
    });
  }

  // Expose CRUD actions globally so HTML inline events can access them
  window.editCommand = function(id) {
    const cmd = allCommands.find(c => c.id === id);
    if (!cmd) return;

    commandIdInput.value = cmd.id;
    commandTriggerInput.value = cmd.trigger;
    commandTypeSelect.value = cmd.type || 'static';
    commandResponseInput.value = cmd.response || '';
    commandDescriptionInput.value = cmd.description || '';
    commandEnabledInput.checked = cmd.enabled === 1;

    // Trigger select type display updates
    if (cmd.type === 'dynamic') {
      commandResponseGroup.style.display = 'none';
    } else {
      commandResponseGroup.style.display = 'block';
    }

    commandFormTitle.textContent = '✏️ Editar Comando';
    btnCancelCommand.style.display = 'inline-flex';
    commandTriggerInput.focus();
  };

  window.toggleCommandStatus = async function(id) {
    try {
      const response = await fetch(`/api/commands/${id}/toggle`, { method: 'PATCH' });
      if (!response.ok) throw new Error('Não foi possível alternar o status do comando.');
      await loadCommands();
    } catch (err) {
      alert(err.message);
    }
  };

  window.deleteCommand = async function(id) {
    if (!confirm('Deseja realmente excluir este comando?')) return;
    try {
      const response = await fetch(`/api/commands/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir comando.');
      await loadCommands();
    } catch (err) {
      alert(err.message);
    }
  };


  // === 3. Q&A (AUTO-RESPONSES) TAB ===
  const qnaForm = document.getElementById('qna-form');
  const qnaIdInput = document.getElementById('qna-id');
  const qnaQuestionInput = document.getElementById('qna-question');
  const qnaMatchTypeSelect = document.getElementById('qna-match-type');
  const qnaPriorityInput = document.getElementById('qna-priority');
  const qnaAnswerInput = document.getElementById('qna-answer');
  const qnaEnabledInput = document.getElementById('qna-enabled');
  const qnaFormTitle = document.getElementById('qna-form-title');
  const btnCancelQna = document.getElementById('btn-cancel-qna');
  const qnaSearchInput = document.getElementById('qna-search');
  const qnaTableBody = document.getElementById('qna-table-body');
  const qnaEmpty = document.getElementById('qna-empty');
  const qnaFeedback = document.getElementById('qna-feedback');

  // Load Qna list
  async function loadQna() {
    try {
      const response = await fetch('/api/qna');
      if (!response.ok) throw new Error('Não foi possível carregar as auto-respostas.');
      allQnas = await response.json();
      renderQnaTable(allQnas);
    } catch (err) {
      console.error('Erro ao carregar Q&A:', err);
    }
  }

  // Render Qna table
  function renderQnaTable(qnas) {
    if (!qnaTableBody) return;
    qnaTableBody.innerHTML = '';

    const filterText = qnaSearchInput ? qnaSearchInput.value.trim().toLowerCase() : '';
    const filtered = qnas.filter(q => 
      q.question.toLowerCase().includes(filterText) || 
      q.answer.toLowerCase().includes(filterText)
    );

    if (filtered.length === 0) {
      qnaEmpty.style.display = 'block';
      return;
    }
    qnaEmpty.style.display = 'none';

    filtered.forEach(q => {
      const tr = document.createElement('tr');

      const isEnabled = q.enabled === 1;
      const statusBadge = isEnabled 
        ? `<span class="badge badge-success" style="cursor:pointer;" onclick="toggleQnaStatus(${q.id})">Ativo</span>`
        : `<span class="badge badge-danger" style="cursor:pointer;" onclick="toggleQnaStatus(${q.id})">Inativo</span>`;

      let matchTypeText = 'Contém';
      let matchTypeBadge = 'badge-info';
      if (q.match_type === 'exact') {
        matchTypeText = 'Igual';
        matchTypeBadge = 'badge-success';
      } else if (q.match_type === 'regex') {
        matchTypeText = 'Regex';
        matchTypeBadge = 'badge-warning';
      }

      tr.innerHTML = `
        <td><strong>${escapeHtml(q.question)}</strong></td>
        <td><span class="badge ${matchTypeBadge}">${matchTypeText}</span></td>
        <td><span class="bold">${q.priority || 0}</span></td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-table-action btn-table-edit" onclick="editQna(${q.id})">✏️ Editar</button>
            <button class="btn-table-action btn-table-delete" onclick="deleteQna(${q.id})">❌ Excluir</button>
          </div>
        </td>
      `;
      qnaTableBody.appendChild(tr);
    });
  }

  if (qnaSearchInput) {
    qnaSearchInput.addEventListener('input', () => {
      renderQnaTable(allQnas);
    });
  }

  // Reset Qna Form
  function resetQnaForm() {
    qnaIdInput.value = '';
    qnaQuestionInput.value = '';
    qnaMatchTypeSelect.value = 'contains';
    qnaPriorityInput.value = 0;
    qnaAnswerInput.value = '';
    qnaEnabledInput.checked = true;
    qnaFormTitle.textContent = '💬 Nova Regra de Auto-Resposta (Q&A)';
    btnCancelQna.style.display = 'none';
  }

  if (btnCancelQna) {
    btnCancelQna.addEventListener('click', resetQnaForm);
  }

  // Submit create/edit Q&A rule
  if (qnaForm) {
    qnaForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = qnaIdInput.value;
      const payload = {
        question: qnaQuestionInput.value.trim(),
        match_type: qnaMatchTypeSelect.value,
        priority: Number(qnaPriorityInput.value) || 0,
        answer: qnaAnswerInput.value,
        enabled: qnaEnabledInput.checked ? 1 : 0
      };

      try {
        let response;
        if (id) {
          response = await fetch(`/api/qna/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          response = await fetch('/api/qna', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao salvar regra Q&A.');

        showFeedback(qnaFeedback, id ? 'Regra Q&A atualizada com sucesso!' : 'Regra Q&A criada com sucesso!');
        resetQnaForm();
        await loadQna();
      } catch (err) {
        showFeedback(qnaFeedback, err.message, true);
      }
    });
  }

  window.editQna = function(id) {
    const qna = allQnas.find(q => q.id === id);
    if (!qna) return;

    qnaIdInput.value = qna.id;
    qnaQuestionInput.value = qna.question;
    qnaMatchTypeSelect.value = qna.match_type || 'contains';
    qnaPriorityInput.value = qna.priority || 0;
    qnaAnswerInput.value = qna.answer || '';
    qnaEnabledInput.checked = qna.enabled === 1;

    qnaFormTitle.textContent = '✏️ Editar Regra Q&A';
    btnCancelQna.style.display = 'inline-flex';
    qnaQuestionInput.focus();
  };

  window.toggleQnaStatus = async function(id) {
    try {
      const response = await fetch(`/api/qna/${id}/toggle`, { method: 'PATCH' });
      if (!response.ok) throw new Error('Não foi possível alternar o status do Q&A.');
      await loadQna();
    } catch (err) {
      alert(err.message);
    }
  };

  window.deleteQna = async function(id) {
    if (!confirm('Deseja realmente excluir esta regra Q&A?')) return;
    try {
      const response = await fetch(`/api/qna/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir Q&A.');
      await loadQna();
    } catch (err) {
      alert(err.message);
    }
  };


  // === 4. MONITOR TAB ===
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
  const sendForm = document.getElementById('send-form');
  const sendChatIdInput = document.getElementById('send-chat-id');
  const sendTextInput = document.getElementById('send-text');
  const btnSendMessage = document.getElementById('btn-send-message');
  const sendFeedback = document.getElementById('send-feedback');
  const messagesFeed = document.getElementById('messages-feed');
  const btnClearFeed = document.getElementById('btn-clear-feed');
  const statReceived = document.getElementById('stat-received');
  const statSent = document.getElementById('stat-sent');

  // Fetch available sessions from OpenWA
  async function fetchSessions() {
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
      
      sessionSelect.innerHTML = '';
      
      if (sessions.length === 0) {
        sessionSelect.innerHTML = '<option value="">Nenhuma sessão ativa encontrada</option>';
        return;
      }
      
      sessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.id;
        option.textContent = `${session.name} (${session.status})`;
        
        if (session.id === currentSessionId) {
          option.selected = true;
        }
        sessionSelect.appendChild(option);
      });
      
      // If no active session was selected previously, select the first one
      if (!currentSessionId && sessions.length > 0) {
        currentSessionId = sessions[0].id;
        sessionSelect.value = currentSessionId;
        handleSessionChange();
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
      sessionSelect.innerHTML = `<option value="">Erro: ${error.message}</option>`;
    }
  }

  // Fetch Details of selected session
  async function fetchSessionDetails(sessionId) {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Falha ao carregar detalhes.');
      const session = await response.json();
      
      infoSessionName.textContent = session.name || '-';
      infoSessionPhone.textContent = session.phone ? `+${session.phone}` : '-';
      infoSessionPushname.textContent = session.pushName || '-';
      
      // Status formatting
      infoSessionStatus.textContent = (session.status || 'unknown').toUpperCase();
      if (session.status === 'connected' || session.status === 'ready') {
        infoSessionStatus.className = 'info-value text-green';
      } else if (session.status === 'disconnected') {
        infoSessionStatus.className = 'info-value text-red';
      } else {
        infoSessionStatus.className = 'info-value text-yellow';
      }
      
      if (session.connectedAt) {
        const date = new Date(session.connectedAt);
        infoSessionConnectedAt.textContent = date.toLocaleString('pt-BR');
      } else {
        infoSessionConnectedAt.textContent = 'Não conectada';
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes da sessão:', error);
      infoSessionName.textContent = 'Erro';
      infoSessionStatus.textContent = error.message;
      infoSessionStatus.className = 'info-value text-red';
    }
  }

  // Fetch groups for selected session
  async function fetchSessionGroups(sessionId) {
    if (!sessionId) {
      activeGroups = [];
      renderGroups([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/groups`);
      if (!response.ok) throw new Error('Não foi possível carregar grupos.');
      activeGroups = await response.json();
      renderGroups(activeGroups);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
      groupsList.innerHTML = `
        <div class="no-groups-placeholder">
          <p class="text-red">Erro ao carregar grupos.</p>
          <p class="placeholder-sub">${escapeHtml(error.message)}</p>
        </div>
      `;
      activeGroups = [];
    }
  }

  // Render groups list in Sidebar
  function renderGroups(groups) {
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
        sendChatIdInput.value = group.id;
        sendTextInput.focus();
        btn.style.borderColor = 'var(--color-green)';
        setTimeout(() => {
          btn.style.borderColor = '';
        }, 1000);
      });
      
      groupsList.appendChild(btn);
    });
  }

  // Register Webhook for selected session
  if (webhookForm) {
    webhookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentSessionId) {
        showFeedback(webhookFeedback, 'Nenhuma sessão ativa selecionada.', true);
        return;
      }
      
      btnRegisterWebhook.disabled = true;
      btnRegisterWebhook.innerHTML = '<span class="spinner"></span> Registrando...';
      
      const url = webhookUrlInput.value.trim();
      
      try {
        const response = await fetch(`/api/sessions/${currentSessionId}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        const resData = await response.json();
        
        if (!response.ok) {
          throw new Error(resData.error || 'Erro ao registrar webhook.');
        }
        
        showFeedback(webhookFeedback, `Sucesso! Webhook cadastrado para sessão: ${currentSessionId}`);
      } catch (error) {
        showFeedback(webhookFeedback, error.message, true);
      } finally {
        btnRegisterWebhook.disabled = false;
        btnRegisterWebhook.innerHTML = '<span>Registrar Webhook</span>';
      }
    });
  }

  // Send Test Message from selected session
  if (sendForm) {
    sendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentSessionId) {
        showFeedback(sendFeedback, 'Nenhuma sessão ativa selecionada.', true);
        return;
      }
      
      btnSendMessage.disabled = true;
      btnSendMessage.innerHTML = '<span class="spinner"></span> Enviando...';
      
      let chatId = sendChatIdInput.value.trim();
      const text = sendTextInput.value;
      
      if (chatId && !chatId.includes('@')) {
        const cleanNum = chatId.replace(/\D/g, '');
        chatId = `${cleanNum}@c.us`;
      }
      
      try {
        const response = await fetch(`/api/sessions/${currentSessionId}/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, text })
        });
        
        const resData = await response.json();
        
        if (!response.ok) {
          throw new Error(resData.error || 'Falha ao enviar mensagem.');
        }
        
        showFeedback(sendFeedback, 'Mensagem enviada com sucesso!');
        sendTextInput.value = '';
        await fetchMessages();
        await updateStats();
      } catch (error) {
        showFeedback(sendFeedback, error.message, true);
      } finally {
        btnSendMessage.disabled = false;
        btnSendMessage.innerHTML = '<span>Enviar via OpenWA</span>';
      }
    });
  }

  // Polling message history
  async function fetchMessages() {
    if (!messagesFeed) return;
    try {
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Erro ao buscar feed.');
      const messages = await response.json();
      
      if (messages.length === 0) {
        if (!messagesFeed.querySelector('.no-messages-placeholder')) {
          messagesFeed.innerHTML = `
            <div class="no-messages-placeholder">
              <div class="placeholder-icon">📡</div>
              <p>Nenhuma mensagem recebida ou enviada ainda.</p>
              <p class="placeholder-sub">Aguardando eventos do webhook do OpenWA...</p>
            </div>
          `;
        }
        return;
      }
      
      const placeholder = messagesFeed.querySelector('.no-messages-placeholder');
      if (placeholder) {
        messagesFeed.innerHTML = '';
      }
      
      messages.forEach(msg => {
        const uniqueId = `${msg.timestamp}-${msg.from}-${msg.body.substring(0, 10)}`;
        if (!messageIds.has(uniqueId)) {
          messageIds.add(uniqueId);
          
          const isOutgoing = msg.direction === 'outgoing';
          const msgContainer = document.createElement('div');
          msgContainer.className = `msg-bubble-container ${isOutgoing ? 'msg-outgoing' : 'msg-incoming'}`;
          
          const date = new Date(msg.timestamp);
          const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          msgContainer.innerHTML = `
            <div class="msg-bubble">
              <div class="msg-jid">${isOutgoing ? 'Bot' : msg.from}</div>
              <div class="msg-text">${escapeHtml(msg.body)}</div>
            </div>
            <div class="msg-meta">
              <span>${timeStr}</span>
              ${msg.command ? `<span class="badge badge-info" style="margin-left:8px;">${msg.command}</span>` : ''}
            </div>
          `;
          
          messagesFeed.appendChild(msgContainer);
          messagesFeed.scrollTop = messagesFeed.scrollHeight;
        }
      });
    } catch (error) {
      console.error('Erro ao atualizar feed de mensagens:', error);
    }
  }

  // Delete message history
  if (btnClearFeed) {
    btnClearFeed.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/messages', { method: 'DELETE' });
        if (response.ok) {
          messagesFeed.innerHTML = `
            <div class="no-messages-placeholder">
              <div class="placeholder-icon">📡</div>
              <p>Histórico limpo no servidor.</p>
            </div>
          `;
          messageIds.clear();
        }
      } catch (error) {
        console.error('Erro ao limpar feed:', error);
        messagesFeed.innerHTML = '';
        messageIds.clear();
      }
    });
  }

  // Update stats on side widgets
  async function updateStats() {
    try {
      const response = await fetch('/api/bot-stats');
      if (response.ok) {
        const data = await response.json();
        if (statReceived) statReceived.textContent = data.stats.received;
        if (statSent) statSent.textContent = data.stats.sent;
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  }

  // Handle session change dropdown
  function handleSessionChange() {
    currentSessionId = sessionSelect.value;
    if (!currentSessionId) return;
    
    // Clear details first
    if (infoSessionName) infoSessionName.textContent = 'Carregando...';
    if (infoSessionStatus) {
      infoSessionStatus.textContent = '---';
      infoSessionStatus.className = 'info-value';
    }
    
    fetchSessionDetails(currentSessionId);
    fetchSessionGroups(currentSessionId);
  }

  if (sessionSelect) {
    sessionSelect.addEventListener('change', handleSessionChange);
  }
  
  if (groupSearch) {
    groupSearch.addEventListener('input', () => {
      renderGroups(activeGroups);
    });
  }


  // === 5. STATISTICS TAB ===
  const statsReceivedBig = document.getElementById('stats-received-big');
  const statsSentBig = document.getElementById('stats-sent-big');
  const statsTotalBig = document.getElementById('stats-total-big');
  const topCommandsList = document.getElementById('top-commands-list');
  const btnPurgeLogs = document.getElementById('btn-purge-logs');
  const purgeFeedback = document.getElementById('purge-feedback');

  async function loadStats() {
    try {
      const response = await fetch('/api/bot-stats');
      if (!response.ok) throw new Error('Não foi possível carregar estatísticas.');
      const data = await response.json();

      // Set numbers
      if (statsReceivedBig) statsReceivedBig.textContent = data.stats.received || 0;
      if (statsSentBig) statsSentBig.textContent = data.stats.sent || 0;
      if (statsTotalBig) statsTotalBig.textContent = data.messageCount || 0;

      // Draw top commands
      if (topCommandsList) {
        topCommandsList.innerHTML = '';
        if (data.topCommands && data.topCommands.length > 0) {
          const maxCount = data.topCommands[0].count || 1;

          data.topCommands.forEach(cmd => {
            const pct = Math.round((cmd.count / maxCount) * 100);
            const item = document.createElement('div');
            item.className = 'top-list-item';
            item.innerHTML = `
              <div class="top-list-header">
                <span>${escapeHtml(cmd.command)}</span>
                <span>${cmd.count}x</span>
              </div>
              <div class="top-list-bar-container">
                <div class="top-list-bar" style="width: ${pct}%"></div>
              </div>
            `;
            topCommandsList.appendChild(item);
          });
        } else {
          topCommandsList.innerHTML = '<div class="no-data-placeholder">Nenhum comando utilizado ainda.</div>';
        }
      }
    } catch (err) {
      console.error('Erro ao ler estatísticas:', err);
    }
  }

  if (btnPurgeLogs) {
    btnPurgeLogs.addEventListener('click', async () => {
      if (!confirm('Esta ação limpará todo o histórico de mensagens local do SQLite permanentemente. Deseja continuar?')) return;
      try {
        const response = await fetch('/api/messages', { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao limpar logs.');

        showFeedback(purgeFeedback, 'Histórico de mensagens do SQLite foi totalmente limpo!');
        messageIds.clear();
        if (messagesFeed) {
          messagesFeed.innerHTML = `
            <div class="no-messages-placeholder">
              <div class="placeholder-icon">📡</div>
              <p>Histórico limpo no servidor.</p>
            </div>
          `;
        }
        await loadStats();
      } catch (err) {
        showFeedback(purgeFeedback, err.message, true);
      }
    });
  }


  // === INITIALIZATION ===
  loadConfig();
  fetchSessions().then(() => {
    updateStats();
    fetchMessages();
    
    // Continuous polling
    setInterval(fetchSessions, 10000); // Poll session list every 10s
    setInterval(() => {
      if (currentSessionId) {
        fetchSessionDetails(currentSessionId);
      }
    }, 5000); // Poll active session status every 5s
    
    setInterval(fetchMessages, 2000); // Poll messages feed every 2s
    setInterval(updateStats, 5000); // Poll stats every 5s
  });
});
