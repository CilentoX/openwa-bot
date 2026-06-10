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
      } else if (tabId === 'menus') {
        loadMenus();
      } else if (tabId === 'stats') {
        loadStats();
        loadAnalyticsCharts();
      }
    });
  });

  // === GLOBAL STATE ===
  let conversations = {};
  let currentChatId = '';
  let unreadCounts = {};
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

  // Preset Templates for Commands
  const commandTemplates = {
    ping: {
      trigger: '!ping',
      type: 'static',
      response: 'pong! 🏓',
      description: 'Teste simples de ping/pong'
    },
    help: {
      trigger: '!help',
      type: 'static',
      response: 'Olá! Como posso ajudar você?\n\nDigite *!menu* para ver opções.\nDigite *!hora* para ver a hora do servidor.',
      description: 'Menu de ajuda principal'
    },
    hora: {
      trigger: '!hora',
      type: 'dynamic',
      response: '',
      description: 'Exibe a hora atual do servidor'
    },
    menu: {
      trigger: '!menu',
      type: 'static',
      response: '📋 *MENU PRINCIPAL*\n\n1️⃣ - Ver status do sistema\n2️⃣ - Falar com suporte\n3️⃣ - Informações da empresa',
      description: 'Menu numérico interativo'
    }
  };

  document.querySelectorAll('.btn-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateKey = btn.getAttribute('data-template');
      const data = commandTemplates[templateKey];
      if (data) {
        commandTriggerInput.value = data.trigger;
        commandTypeSelect.value = data.type;
        commandTypeSelect.dispatchEvent(new Event('change'));
        commandResponseInput.value = data.response;
        commandDescriptionInput.value = data.description;
        commandEnabledInput.checked = true;
      }
    });
  });

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

  // Preset Templates for Q&A
  const qnaTemplates = {
    oi: {
      question: 'oi, ola, olá, bom dia, boa tarde, boa noite',
      match_type: 'contains',
      priority: 1,
      answer: 'Olá! Seja muito bem-vindo! Como posso ajudar você hoje? 😊'
    },
    preco: {
      question: 'preço, valor, quanto custa, tabela',
      match_type: 'contains',
      priority: 2,
      answer: 'Nossos planos iniciam a partir de R$ 99/mês. Gostaria que um especialista entrasse em contato para apresentar uma proposta personalizada?'
    },
    horario: {
      question: 'horario, horário, funciona, aberto, fechado',
      match_type: 'contains',
      priority: 1,
      answer: 'Nosso horário de atendimento é de Segunda a Sexta, das 09:00 às 18:00 (horário de Brasília). 🕒'
    },
    atendente: {
      question: 'atendente, falar com humano, suporte, ajuda',
      match_type: 'contains',
      priority: 3,
      answer: 'Entendido! Estou transferindo você para um de nossos atendentes humanos. Por favor, aguarde um instante... 🧑‍💻'
    }
  };

  document.querySelectorAll('.btn-qna-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateKey = btn.getAttribute('data-template');
      const data = qnaTemplates[templateKey];
      if (data) {
        qnaQuestionInput.value = data.question;
        qnaMatchTypeSelect.value = data.match_type;
        qnaPriorityInput.value = data.priority;
        qnaAnswerInput.value = data.answer;
        qnaEnabledInput.checked = true;
      }
    });
  });

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

  // Session Control Elements
  const createSessionForm = document.getElementById('create-session-form');
  const newSessionNameInput = document.getElementById('new-session-name');
  const createSessionFeedback = document.getElementById('create-session-feedback');
  
  const btnSessionSetDefault = document.getElementById('btn-session-set-default');
  const btnSessionStart = document.getElementById('btn-session-start');
  const btnSessionStop = document.getElementById('btn-session-stop');
  const btnSessionDelete = document.getElementById('btn-session-delete');
  const sessionActionFeedback = document.getElementById('session-action-feedback');
  const btnRefreshQr = document.getElementById('btn-refresh-qr');

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

  let qrCodeLoading = false;
  async function fetchSessionQR(sessionId) {
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

  // Media elements
  const sendMsgType = document.getElementById('send-msg-type');
  const sendTextGroup = document.getElementById('send-text-group');
  const sendMediaGroup = document.getElementById('send-media-group');
  const fileDropZone = document.getElementById('file-drop-zone');
  const fileTypeInfo = document.getElementById('file-type-info');
  const mediaFileInput = document.getElementById('media-file-input');
  const filePreviewBox = document.getElementById('file-preview-box');
  const previewFilename = document.getElementById('preview-filename');
  const previewContent = document.getElementById('preview-content');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const sendCaptionGroup = document.getElementById('send-caption-group');
  const sendCaptionInput = document.getElementById('send-caption');
  const sendFilenameGroup = document.getElementById('send-filename-group');
  const sendFilenameInput = document.getElementById('send-filename');

  let selectedMedia = null;

  if (sendMsgType) {
    sendMsgType.addEventListener('change', () => {
      const type = sendMsgType.value;
      removeSelectedFile();

      if (type === 'text') {
        sendTextGroup.style.display = 'block';
        sendTextInput.required = true;
        sendMediaGroup.style.display = 'none';
        sendCaptionGroup.style.display = 'none';
        sendFilenameGroup.style.display = 'none';
      } else {
        sendTextGroup.style.display = 'none';
        sendTextInput.required = false;
        sendMediaGroup.style.display = 'block';

        if (type === 'image' || type === 'video' || type === 'document') {
          sendCaptionGroup.style.display = 'block';
        } else {
          sendCaptionGroup.style.display = 'none';
        }

        if (type === 'document') {
          sendFilenameGroup.style.display = 'block';
        } else {
          sendFilenameGroup.style.display = 'none';
        }

        if (type === 'image') {
          fileTypeInfo.textContent = 'Formatos suportados: PNG, JPG, JPEG, WebP';
          mediaFileInput.accept = 'image/*';
        } else if (type === 'audio') {
          fileTypeInfo.textContent = 'Formatos suportados: MP3, OGG, WAV, AAC, Opus';
          mediaFileInput.accept = 'audio/*';
        } else if (type === 'video') {
          fileTypeInfo.textContent = 'Formatos suportados: MP4, WebM';
          mediaFileInput.accept = 'video/*';
        } else if (type === 'document') {
          fileTypeInfo.textContent = 'Formatos suportados: PDF, DOCX, XLSX, ZIP, etc.';
          mediaFileInput.accept = '*/*';
        } else if (type === 'sticker') {
          fileTypeInfo.textContent = 'Formatos recomendados: PNG ou WebP quadrado (máx. 1MB)';
          mediaFileInput.accept = 'image/*';
        }
      }
    });
  }

  function removeSelectedFile() {
    selectedMedia = null;
    if (mediaFileInput) mediaFileInput.value = '';
    if (filePreviewBox) filePreviewBox.style.display = 'none';
    if (previewContent) previewContent.innerHTML = '';
  }

  if (btnRemoveFile) {
    btnRemoveFile.addEventListener('click', removeSelectedFile);
  }

  if (fileDropZone) {
    fileDropZone.addEventListener('click', () => mediaFileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      fileDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        fileDropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      fileDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        fileDropZone.classList.remove('dragover');
      }, false);
    });

    fileDropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    });
  }

  if (mediaFileInput) {
    mediaFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  function handleFileSelect(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const dataUrl = e.target.result;
      const base64Data = dataUrl.split(',')[1];

      selectedMedia = {
        base64: base64Data,
        mimetype: file.type || 'application/octet-stream',
        filename: file.name
      };

      if (previewFilename) {
        previewFilename.textContent = `${file.name} (${formatBytes(file.size)})`;
      }

      if (sendFilenameInput) {
        sendFilenameInput.value = file.name;
      }

      if (previewContent) {
        previewContent.innerHTML = '';
        if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = dataUrl;
          previewContent.appendChild(img);
        } else if (file.type.startsWith('video/')) {
          const video = document.createElement('video');
          video.src = dataUrl;
          video.controls = true;
          previewContent.appendChild(video);
        } else if (file.type.startsWith('audio/')) {
          const audio = document.createElement('audio');
          audio.src = dataUrl;
          audio.controls = true;
          previewContent.appendChild(audio);
        } else {
          const div = document.createElement('div');
          div.style.fontSize = '2rem';
          div.style.textAlign = 'center';
          div.innerHTML = '📄<br><span style="font-size:0.75rem;color:var(--text-secondary)">Sem prévia disponível</span>';
          previewContent.appendChild(div);
        }
      }

      if (filePreviewBox) {
        filePreviewBox.style.display = 'block';
      }
    };

    reader.readAsDataURL(file);
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Send Test Message from selected session
  if (sendForm) {
    sendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentSessionId) {
        showFeedback(sendFeedback, 'Nenhuma sessão ativa selecionada.', true);
        return;
      }

      let chatId = sendChatIdInput.value.trim();
      if (chatId && !chatId.includes('@')) {
        const cleanNum = chatId.replace(/\D/g, '');
        chatId = `${cleanNum}@c.us`;
      }

      const type = sendMsgType.value;
      btnSendMessage.disabled = true;
      btnSendMessage.innerHTML = '<span class="spinner"></span> Enviando...';

      try {
        let endpoint = `/api/sessions/${currentSessionId}/messages/send`;
        let payload = { chatId };

        if (type === 'text') {
          endpoint = `/api/sessions/${currentSessionId}/messages/send-text`;
          payload.text = sendTextInput.value;
        } else {
          if (!selectedMedia) {
            throw new Error('Por favor, selecione ou arraste um arquivo para enviar.');
          }

          if (type === 'image') endpoint = `/api/sessions/${currentSessionId}/messages/send-image`;
          else if (type === 'audio') endpoint = `/api/sessions/${currentSessionId}/messages/send-audio`;
          else if (type === 'video') endpoint = `/api/sessions/${currentSessionId}/messages/send-video`;
          else if (type === 'document') endpoint = `/api/sessions/${currentSessionId}/messages/send-document`;
          else if (type === 'sticker') endpoint = `/api/sessions/${currentSessionId}/messages/send-sticker`;

          payload.base64 = selectedMedia.base64;
          payload.mimetype = selectedMedia.mimetype;
          payload.filename = (type === 'document' ? sendFilenameInput.value.trim() : '') || selectedMedia.filename;

          if (type === 'image' || type === 'video' || type === 'document') {
            payload.caption = sendCaptionInput.value.trim();
          }
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (!response.ok) {
          throw new Error(resData.message || resData.error || 'Falha ao enviar mensagem.');
        }

        showFeedback(sendFeedback, 'Mensagem/Mídia enviada com sucesso!');
        sendTextInput.value = '';
        if (sendCaptionInput) sendCaptionInput.value = '';
        if (sendFilenameInput) sendFilenameInput.value = '';
        removeSelectedFile();

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

  // Fetch messages from server and group by conversation
  async function fetchMessages() {
    try {
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Erro ao buscar feed.');
      const messages = await response.json();
      
      conversations = {};
      messages.forEach(msg => {
        const jid = msg.from;
        if (!conversations[jid]) {
          conversations[jid] = [];
        }
        conversations[jid].push(msg);
      });
      
      renderSidebarChats();
      if (currentChatId) {
        renderActiveChatMessages();
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  }

  // Render left sidebar conversation list
  const chatListContainer = document.getElementById('chat-list-container');
  function renderSidebarChats() {
    if (!chatListContainer) return;
    chatListContainer.innerHTML = '';
    
    const sortedJids = Object.keys(conversations).sort((a, b) => {
      const msgsA = conversations[a];
      const msgsB = conversations[b];
      const lastA = msgsA[msgsA.length - 1];
      const lastB = msgsB[msgsB.length - 1];
      return (lastB?.timestamp || 0) - (lastA?.timestamp || 0);
    });
    
    if (sortedJids.length === 0) {
      chatListContainer.innerHTML = `
        <div class="no-chats-placeholder" style="padding:20px; text-align:center; color:var(--text-muted); font-size:0.8rem;">
          Sem conversas ativas.
        </div>
      `;
      return;
    }
    
    sortedJids.forEach(jid => {
      const msgs = conversations[jid];
      const lastMsg = msgs[msgs.length - 1];
      const unreadCount = unreadCounts[jid] || 0;
      
      const chatItem = document.createElement('button');
      chatItem.type = 'button';
      chatItem.className = `chat-item ${jid === currentChatId ? 'active' : ''}`;
      
      const isGroup = jid.includes('@g.us');
      const avatar = isGroup ? '👥' : '👤';
      const displayName = jid.split('@')[0];
      
      chatItem.innerHTML = `
        <div class="chat-item-avatar">${avatar}</div>
        <div class="chat-item-details">
          <div class="chat-item-name" title="${jid}">${escapeHtml(displayName)}</div>
          <div class="chat-item-lastmsg">${escapeHtml(lastMsg ? lastMsg.body : '')}</div>
        </div>
        <div class="chat-item-badge-container">
          ${unreadCount > 0 ? `<span class="chat-item-badge">${unreadCount}</span>` : ''}
        </div>
      `;
      
      chatItem.addEventListener('click', () => {
        selectConversation(jid);
      });
      
      chatListContainer.appendChild(chatItem);
    });
  }

  // Select active conversation JID
  function selectConversation(jid) {
    currentChatId = jid;
    unreadCounts[jid] = 0;
    
    renderSidebarChats();
    
    const screenHeader = document.getElementById('chat-screen-header');
    const replyBar = document.getElementById('chat-reply-bar');
    const headerTitle = document.getElementById('chat-header-title');
    
    if (screenHeader) screenHeader.style.display = 'flex';
    if (replyBar) replyBar.style.display = 'block';
    if (headerTitle) {
      headerTitle.textContent = jid.split('@')[0];
      headerTitle.title = jid;
    }
    
    renderActiveChatMessages();
    
    if (sendChatIdInput) {
      sendChatIdInput.value = jid;
    }
  }

  // Render bubbles for active chat JID
  function renderActiveChatMessages() {
    if (!messagesFeed) return;
    
    if (!currentChatId) {
      messagesFeed.innerHTML = `
        <div class="no-messages-placeholder">
          <div class="placeholder-icon">💬</div>
          <p>Selecione um contato ou grupo na barra lateral para visualizar a conversa em tempo real.</p>
        </div>
      `;
      return;
    }
    
    const msgs = conversations[currentChatId] || [];
    messagesFeed.innerHTML = '';
    
    if (msgs.length === 0) {
      messagesFeed.innerHTML = `
        <div class="no-messages-placeholder">
          <div class="placeholder-icon">📡</div>
          <p>Nenhuma mensagem nesta conversa ainda.</p>
        </div>
      `;
      return;
    }
    
    msgs.forEach(msg => {
      const isOutgoing = msg.direction === 'outgoing';
      const msgContainer = document.createElement('div');
      msgContainer.className = `msg-bubble-container ${isOutgoing ? 'msg-outgoing' : 'msg-incoming'}`;
      
      const date = new Date(msg.timestamp);
      const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      msgContainer.innerHTML = `
        <div class="msg-bubble">
          <div class="msg-jid">${isOutgoing ? 'Bot' : msg.from.split('@')[0]}</div>
          <div class="msg-text">${escapeHtml(msg.body)}</div>
        </div>
        <div class="msg-meta">
          <span>${timeStr}</span>
          ${msg.command ? `<span class="badge badge-info" style="margin-left:8px;">${msg.command}</span>` : ''}
        </div>
      `;
      
      messagesFeed.appendChild(msgContainer);
    });
    
    messagesFeed.scrollTop = messagesFeed.scrollHeight;
  }

  // Delete message history
  if (btnClearFeed) {
    btnClearFeed.addEventListener('click', async () => {
      if (!confirm('Deseja realmente limpar o histórico do feed de mensagens?')) return;
      try {
        const response = await fetch('/api/messages', { method: 'DELETE' });
        if (response.ok) {
          conversations = {};
          currentChatId = '';
          unreadCounts = {};
          renderSidebarChats();
          renderActiveChatMessages();
          
          const screenHeader = document.getElementById('chat-screen-header');
          const replyBar = document.getElementById('chat-reply-bar');
          if (screenHeader) screenHeader.style.display = 'none';
          if (replyBar) replyBar.style.display = 'none';
        }
      } catch (error) {
        console.error('Erro ao limpar feed:', error);
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

  // --- Create Session Handler ---
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
        currentSessionId = data.id || name;
        await fetchSessions();
        handleSessionChange();
      } catch (err) {
        showFeedback(createSessionFeedback, err.message, true);
      }
    });
  }

  // --- Session Control Actions ---
  if (btnSessionSetDefault) {
    btnSessionSetDefault.addEventListener('click', async () => {
      if (!currentSessionId) return;
      try {
        const response = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultSessionId: currentSessionId })
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
      if (!currentSessionId) return;
      try {
        btnSessionStart.disabled = true;
        const response = await fetch(`/api/sessions/${currentSessionId}/start`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || 'Erro ao iniciar sessão.');
        showFeedback(sessionActionFeedback, 'Comando de iniciar enviado com sucesso!');
        await fetchSessionDetails(currentSessionId);
      } catch (err) {
        showFeedback(sessionActionFeedback, err.message, true);
      } finally {
        btnSessionStart.disabled = false;
      }
    });
  }

  if (btnSessionStop) {
    btnSessionStop.addEventListener('click', async () => {
      if (!currentSessionId) return;
      try {
        btnSessionStop.disabled = true;
        const response = await fetch(`/api/sessions/${currentSessionId}/stop`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || 'Erro ao parar sessão.');
        showFeedback(sessionActionFeedback, 'Comando de parar enviado com sucesso!');
        await fetchSessionDetails(currentSessionId);
      } catch (err) {
        showFeedback(sessionActionFeedback, err.message, true);
      } finally {
        btnSessionStop.disabled = false;
      }
    });
  }

  if (btnSessionDelete) {
    btnSessionDelete.addEventListener('click', async () => {
      if (!currentSessionId) return;
      if (!confirm(`Deseja realmente excluir a sessão "${currentSessionId}" permanentemente?`)) return;

      try {
        btnSessionDelete.disabled = true;
        const response = await fetch(`/api/sessions/${currentSessionId}`, { method: 'DELETE' });
        if (!response.ok) {
          let errMsg = 'Erro ao excluir sessão.';
          try {
            const errData = await response.json();
            errMsg = errData.message || errData.error || errMsg;
          } catch (_) {}
          throw new Error(errMsg);
        }
        showFeedback(sessionActionFeedback, 'Sessão excluída com sucesso!');
        currentSessionId = '';
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
      if (currentSessionId) fetchSessionQR(currentSessionId);
    });
  }

  // Handle session change dropdown
  function handleSessionChange() {
    currentSessionId = sessionSelect.value;
    
    // Clear details first
    if (infoSessionName) infoSessionName.textContent = 'Carregando...';
    if (infoSessionStatus) {
      infoSessionStatus.textContent = '---';
      infoSessionStatus.className = 'info-value';
    }
    
    if (!currentSessionId) {
      if (infoSessionName) infoSessionName.textContent = '-';
      if (infoSessionPhone) infoSessionPhone.textContent = '-';
      if (infoSessionPushname) infoSessionPushname.textContent = '-';
      if (infoSessionConnectedAt) infoSessionConnectedAt.textContent = '-';
      return;
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


  // === REAL-TIME EVENTS CONNECTION (SSE) ===
  let eventSource = null;
  function connectMessageStream() {
    if (eventSource) {
      eventSource.close();
    }
    
    console.log('🔌 Conectando ao Stream de Mensagens (SSE)...');
    eventSource = new EventSource('/api/messages/stream');
    
    eventSource.onopen = () => {
      console.log('✅ Conectado ao Stream de Mensagens!');
    };
    
    eventSource.onerror = (e) => {
      console.warn('⚠️ Erro no Stream de Mensagens (SSE). Tentando reconectar...');
      setTimeout(connectMessageStream, 5000);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleIncomingStreamMessage(msg);
      } catch (err) {
        console.error('Erro ao processar mensagem do stream:', err);
      }
    };
  }

  function handleIncomingStreamMessage(msg) {
    const jid = msg.from;
    if (!conversations[jid]) {
      conversations[jid] = [];
    }
    conversations[jid].push(msg);

    if (jid === currentChatId) {
      const isOutgoing = msg.direction === 'outgoing';
      const msgContainer = document.createElement('div');
      msgContainer.className = `msg-bubble-container ${isOutgoing ? 'msg-outgoing' : 'msg-incoming'}`;
      
      const date = new Date(msg.timestamp);
      const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      msgContainer.innerHTML = `
        <div class="msg-bubble">
          <div class="msg-jid">${isOutgoing ? 'Bot' : msg.from.split('@')[0]}</div>
          <div class="msg-text">${escapeHtml(msg.body)}</div>
        </div>
        <div class="msg-meta">
          <span>${timeStr}</span>
          ${msg.command ? `<span class="badge badge-info" style="margin-left:8px;">${msg.command}</span>` : ''}
        </div>
      `;
      
      const placeholder = messagesFeed.querySelector('.no-messages-placeholder');
      if (placeholder) {
        messagesFeed.innerHTML = '';
      }
      
      messagesFeed.appendChild(msgContainer);
      messagesFeed.scrollTop = messagesFeed.scrollHeight;
    } else {
      unreadCounts[jid] = (unreadCounts[jid] || 0) + 1;
    }

    renderSidebarChats();
    updateStats();
  }

  // === QUICK REPLY HANDLER ===
  const chatReplyForm = document.getElementById('chat-reply-form');
  const chatReplyInput = document.getElementById('chat-reply-input');

  if (chatReplyForm) {
    chatReplyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentChatId || !currentSessionId) return;

      const text = chatReplyInput.value.trim();
      if (!text) return;

      chatReplyInput.disabled = true;
      try {
        const response = await fetch(`/api/sessions/${currentSessionId}/messages/send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: currentChatId, text })
        });
        
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.message || resData.error || 'Falha ao enviar resposta.');
        }
        
        chatReplyInput.value = '';
        await fetchMessages();
      } catch (err) {
        alert(err.message);
      } finally {
        chatReplyInput.disabled = false;
        chatReplyInput.focus();
      }
    });
  }

  // === INTERACTIVE MENUS (URA) CONTROLLER ===
  let allMenusList = [];
  const menuForm = document.getElementById('menu-form');
  const btnCancelMenu = document.getElementById('btn-cancel-menu');
  const menuFeedback = document.getElementById('menu-feedback');

  async function loadMenus() {
    try {
      const response = await fetch('/api/menus');
      if (!response.ok) throw new Error('Não foi possível carregar os menus.');
      allMenusList = await response.json();
      
      populateMenuParentSelect();
      renderMenuTree();
    } catch (err) {
      console.error('Erro ao carregar menus:', err);
    }
  }

  function populateMenuParentSelect() {
    const parentSelect = document.getElementById('menu-parent-id');
    if (!parentSelect) return;
    
    parentSelect.innerHTML = '<option value="">[Nenhum - Root Menu]</option>';
    const nonLeafMenus = allMenusList.filter(m => m.is_leaf !== 1);
    
    nonLeafMenus.forEach(menu => {
      const option = document.createElement('option');
      option.value = menu.id;
      option.textContent = `${menu.name} (Gatilho: ${menu.trigger_option})`;
      parentSelect.appendChild(option);
    });
  }

  function renderMenuTree() {
    const treeContainer = document.getElementById('menu-tree-container');
    if (!treeContainer) return;
    treeContainer.innerHTML = '';
    
    const roots = allMenusList.filter(m => !m.parent_id);
    
    if (roots.length === 0) {
      treeContainer.innerHTML = `
        <div class="no-data-placeholder">
          Nenhum menu ou URA cadastrado ainda. Use o formulário à esquerda para começar!
        </div>
      `;
      return;
    }
    
    roots.forEach(root => {
      treeContainer.appendChild(buildNodeHTML(root));
    });
  }

  function buildNodeHTML(node) {
    const div = document.createElement('div');
    div.className = 'tree-node-wrapper';
    
    const isEnabled = node.enabled === 1;
    const isLeaf = node.is_leaf === 1;
    const children = allMenusList.filter(m => m.parent_id === node.id);
    
    div.innerHTML = `
      <div class="tree-node" id="node-${node.id}">
        <div class="tree-node-header">
          <div class="tree-node-title">
            <span>🌳</span>
            <strong>${escapeHtml(node.name)}</strong>
            <span class="tree-node-badge">Acionador: "${escapeHtml(node.trigger_option)}"</span>
            ${isLeaf ? '<span class="tree-node-badge badge-leaf">Finalizador (Leaf)</span>' : ''}
            ${!isEnabled ? '<span class="tree-node-badge badge-disabled">Inativo</span>' : ''}
          </div>
          <div class="tree-node-actions">
            <button type="button" class="btn-table-action btn-table-edit" onclick="editMenu(${node.id})">✏️ Editar</button>
            <button type="button" class="btn-table-action" onclick="toggleMenuStatus(${node.id})">
              ${isEnabled ? '⏸️ Desativar' : '▶️ Ativar'}
            </button>
            <button type="button" class="btn-table-action btn-table-delete" onclick="deleteMenu(${node.id})">❌ Excluir</button>
          </div>
        </div>
        <div class="tree-node-message">${escapeHtml(node.message_text)}</div>
        
        ${children.length > 0 ? `
          <div class="tree-children" id="children-of-${node.id}">
          </div>
        ` : ''}
      </div>
    `;
    
    if (children.length > 0) {
      const childrenContainer = div.querySelector(`#children-of-${node.id}`);
      children.forEach(child => {
        childrenContainer.appendChild(buildNodeHTML(child));
      });
    }
    
    return div;
  }

  function resetMenuForm() {
    const menuIdInput = document.getElementById('menu-id');
    const menuFormTitle = document.getElementById('menu-form-title');
    
    if (menuIdInput) menuIdInput.value = '';
    if (menuForm) menuForm.reset();
    const menuEnabled = document.getElementById('menu-enabled');
    if (menuEnabled) menuEnabled.checked = true;
    if (menuFormTitle) menuFormTitle.textContent = '🌳 Criar Novo Menu / Submenu';
    if (btnCancelMenu) btnCancelMenu.style.display = 'none';
  }

  if (btnCancelMenu) {
    btnCancelMenu.addEventListener('click', resetMenuForm);
  }

  if (menuForm) {
    menuForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('menu-id').value;
      const payload = {
        name: document.getElementById('menu-name').value.trim(),
        parent_id: document.getElementById('menu-parent-id').value || null,
        trigger_option: document.getElementById('menu-trigger-option').value.trim(),
        message_text: document.getElementById('menu-message-text').value,
        is_leaf: document.getElementById('menu-is-leaf').checked ? 1 : 0,
        enabled: document.getElementById('menu-enabled').checked ? 1 : 0
      };
      
      try {
        let response;
        if (id) {
          response = await fetch(`/api/menus/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          response = await fetch('/api/menus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao salvar menu.');
        
        showFeedback(menuFeedback, id ? 'Menu atualizado com sucesso!' : 'Menu criado com sucesso!');
        resetMenuForm();
        await loadMenus();
      } catch (err) {
        showFeedback(menuFeedback, err.message, true);
      }
    });
  }

  window.editMenu = function(id) {
    const menu = allMenusList.find(m => m.id === id);
    if (!menu) return;
    
    const menuIdInput = document.getElementById('menu-id');
    const menuNameInput = document.getElementById('menu-name');
    const menuParentIdSelect = document.getElementById('menu-parent-id');
    const menuTriggerInput = document.getElementById('menu-trigger-option');
    const menuMessageText = document.getElementById('menu-message-text');
    const menuIsLeaf = document.getElementById('menu-is-leaf');
    const menuEnabled = document.getElementById('menu-enabled');
    const menuFormTitle = document.getElementById('menu-form-title');
    
    if (menuIdInput) menuIdInput.value = menu.id;
    if (menuNameInput) menuNameInput.value = menu.name;
    if (menuParentIdSelect) menuParentIdSelect.value = menu.parent_id || '';
    if (menuTriggerInput) menuTriggerInput.value = menu.trigger_option;
    if (menuMessageText) menuMessageText.value = menu.message_text;
    if (menuIsLeaf) menuIsLeaf.checked = menu.is_leaf === 1;
    if (menuEnabled) menuEnabled.checked = menu.enabled === 1;
    
    if (menuFormTitle) menuFormTitle.textContent = '✏️ Editar Menu / Submenu';
    if (btnCancelMenu) btnCancelMenu.style.display = 'inline-flex';
    
    if (menuNameInput) menuNameInput.focus();
  };

  window.toggleMenuStatus = async function(id) {
    try {
      const response = await fetch(`/api/menus/${id}/toggle`, { method: 'PATCH' });
      if (!response.ok) throw new Error('Não foi possível alterar status.');
      await loadMenus();
    } catch (err) {
      alert(err.message);
    }
  };

  window.deleteMenu = async function(id) {
    if (!confirm('Excluir este menu e submenus recursivamente?')) return;
    try {
      const response = await fetch(`/api/menus/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir.');
      await loadMenus();
    } catch (err) {
      alert(err.message);
    }
  };

  // === CHART.JS ANALYTICS DASHBOARDS ===
  let historyChartInstance = null;
  let directionChartInstance = null;

  async function loadAnalyticsCharts() {
    try {
      const response = await fetch('/api/bot-stats/history');
      if (!response.ok) throw new Error('Erro ao obter histórico.');
      const data = await response.json();
      
      renderHistoryChart(data.history);
      renderDirectionChart(data.directionStats);
    } catch (err) {
      console.error('Erro ao renderizar gráficos:', err);
    }
  }

  function renderHistoryChart(historyData) {
    const ctx = document.getElementById('messagesHistoryChart');
    if (!ctx) return;
    
    const periods = [...new Set(historyData.map(h => h.period))];
    
    const incomingCounts = periods.map(p => {
      const found = historyData.find(h => h.period === p && h.direction === 'incoming');
      return found ? found.count : 0;
    });
    
    const outgoingCounts = periods.map(p => {
      const found = historyData.find(h => h.period === p && h.direction === 'outgoing');
      return found ? found.count : 0;
    });
    
    if (historyChartInstance) {
      historyChartInstance.destroy();
    }
    
    historyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: periods,
        datasets: [
          {
            label: 'Recebidas (Entrada)',
            data: incomingCounts,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          },
          {
            label: 'Enviadas (Saída)',
            data: outgoingCounts,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#e2e8f0' }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', stepSize: 1 }
          }
        }
      }
    });
  }

  function renderDirectionChart(directionStats) {
    const ctx = document.getElementById('messagesDirectionChart');
    if (!ctx) return;
    
    const incoming = directionStats.find(d => d.direction === 'incoming')?.count || 0;
    const outgoing = directionStats.find(d => d.direction === 'outgoing')?.count || 0;
    
    if (directionChartInstance) {
      directionChartInstance.destroy();
    }
    
    directionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Recebidas', 'Enviadas'],
        datasets: [
          {
            data: [incoming, outgoing],
            backgroundColor: ['#06b6d4', '#10b981'],
            borderColor: 'rgba(18, 24, 36, 0.8)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#e2e8f0' }
          }
        }
      }
    });
  }

  // === INITIALIZATION ===
  loadConfig();
  fetchSessions().then(() => {
    updateStats();
    fetchMessages();
    connectMessageStream();
    
    // Continuous polling
    setInterval(fetchSessions, 10000); // Poll session list every 10s
    setInterval(() => {
      if (currentSessionId) {
        fetchSessionDetails(currentSessionId);
      }
    }, 5000); // Poll active session status every 5s
  });
});
