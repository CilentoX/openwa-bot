// === COMMANDS PANEL MODULE ===

import { state } from './state.js';
import { showFeedback, escapeHtml, fileToBase64 } from './utils.js';

const commandForm = document.getElementById('command-form');
const commandIdInput = document.getElementById('command-id');
const commandTriggerInput = document.getElementById('command-trigger');
const commandTypeSelect = document.getElementById('command-type');
const commandResponseInput = document.getElementById('command-response');
const commandResponseGroup = document.getElementById('command-response-group');
const commandImageUrlInput = document.getElementById('command-image-url');
const commandImageFileInput = document.getElementById('command-image-file');
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

export async function loadCommands() {
  try {
    const response = await fetch('/api/commands');
    if (!response.ok) throw new Error('Não foi possível carregar os comandos.');
    state.allCommands = await response.json();
    renderCommandsTable(state.allCommands);
  } catch (err) {
    console.error('Erro ao carregar comandos:', err);
  }
}

export function renderCommandsTable(commands) {
  if (!commandsTableBody) return;
  commandsTableBody.innerHTML = '';

  const filterText = commandSearchInput ? commandSearchInput.value.trim().toLowerCase() : '';
  const filtered = commands.filter(c => 
    c.trigger.toLowerCase().includes(filterText) || 
    (c.description && c.description.toLowerCase().includes(filterText)) ||
    (c.response && c.response.toLowerCase().includes(filterText))
  );

  if (filtered.length === 0) {
    if (commandsEmpty) commandsEmpty.style.display = 'block';
    return;
  }
  if (commandsEmpty) commandsEmpty.style.display = 'none';

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

function resetCommandForm() {
  if (commandIdInput) commandIdInput.value = '';
  if (commandTriggerInput) {
    commandTriggerInput.value = '';
    commandTriggerInput.removeAttribute('disabled');
  }
  if (commandTypeSelect) commandTypeSelect.value = 'static';
  if (commandResponseInput) commandResponseInput.value = '';
  if (commandImageUrlInput) commandImageUrlInput.value = '';
  if (commandResponseGroup) commandResponseGroup.style.display = 'block';
  if (commandDescriptionInput) commandDescriptionInput.value = '';
  if (commandEnabledInput) commandEnabledInput.checked = true;
  if (commandFormTitle) commandFormTitle.textContent = '🤖 Criar Novo Comando';
  if (btnCancelCommand) btnCancelCommand.style.display = 'none';
}

export function initCommandsPanel() {
  // File upload handler
  if (commandImageFileInput) {
    commandImageFileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        try {
          const base64 = await fileToBase64(e.target.files[0]);
          if (commandImageUrlInput) commandImageUrlInput.value = base64;
        } catch (err) {
          console.error('Erro ao converter imagem:', err);
          alert('Erro ao carregar imagem do computador.');
        }
      }
    });
  }

  // Preset templates handler
  document.querySelectorAll('.btn-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateKey = btn.getAttribute('data-template');
      const data = commandTemplates[templateKey];
      if (data) {
        if (commandTriggerInput) commandTriggerInput.value = data.trigger;
        if (commandTypeSelect) {
          commandTypeSelect.value = data.type;
          commandTypeSelect.dispatchEvent(new Event('change'));
        }
        if (commandResponseInput) commandResponseInput.value = data.response;
        if (commandDescriptionInput) commandDescriptionInput.value = data.description;
        if (commandEnabledInput) commandEnabledInput.checked = true;
      }
    });
  });

  // Type select change listener (hide/show response input)
  if (commandTypeSelect) {
    commandTypeSelect.addEventListener('change', () => {
      if (commandTypeSelect.value === 'dynamic') {
        if (commandResponseGroup) commandResponseGroup.style.display = 'none';
      } else {
        if (commandResponseGroup) commandResponseGroup.style.display = 'block';
      }
    });
  }

  // Filter commands typing search box
  if (commandSearchInput) {
    commandSearchInput.addEventListener('input', () => {
      renderCommandsTable(state.allCommands);
    });
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
        image_url: commandImageUrlInput.value.trim() || null,
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
    const cmd = state.allCommands.find(c => c.id === id);
    if (!cmd) return;

    if (commandIdInput) commandIdInput.value = cmd.id;
    if (commandTriggerInput) commandTriggerInput.value = cmd.trigger;
    if (commandTypeSelect) commandTypeSelect.value = cmd.type || 'static';
    if (commandResponseInput) commandResponseInput.value = cmd.response || '';
    if (commandImageUrlInput) commandImageUrlInput.value = cmd.image_url || '';
    if (commandDescriptionInput) commandDescriptionInput.value = cmd.description || '';
    if (commandEnabledInput) commandEnabledInput.checked = cmd.enabled === 1;

    // Trigger select type display updates
    if (cmd.type === 'dynamic') {
      if (commandResponseGroup) commandResponseGroup.style.display = 'none';
    } else {
      if (commandResponseGroup) commandResponseGroup.style.display = 'block';
    }

    if (commandFormTitle) commandFormTitle.textContent = '✏️ Editar Comando';
    if (btnCancelCommand) btnCancelCommand.style.display = 'inline-flex';
    if (commandTriggerInput) commandTriggerInput.focus();
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
}
