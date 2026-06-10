// === Q&A (AUTO-RESPONSES) MODULE ===

import { state } from './state.js';
import { showFeedback, escapeHtml } from './utils.js';

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

export async function loadQna() {
  try {
    const response = await fetch('/api/qna');
    if (!response.ok) throw new Error('Não foi possível carregar as auto-respostas.');
    state.allQnas = await response.json();
    renderQnaTable(state.allQnas);
  } catch (err) {
    console.error('Erro ao carregar Q&A:', err);
  }
}

export function renderQnaTable(qnas) {
  if (!qnaTableBody) return;
  qnaTableBody.innerHTML = '';

  const filterText = qnaSearchInput ? qnaSearchInput.value.trim().toLowerCase() : '';
  const filtered = qnas.filter(q => 
    q.question.toLowerCase().includes(filterText) || 
    q.answer.toLowerCase().includes(filterText)
  );

  if (filtered.length === 0) {
    if (qnaEmpty) qnaEmpty.style.display = 'block';
    return;
  }
  if (qnaEmpty) qnaEmpty.style.display = 'none';

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

function resetQnaForm() {
  if (qnaIdInput) qnaIdInput.value = '';
  if (qnaQuestionInput) qnaQuestionInput.value = '';
  if (qnaMatchTypeSelect) qnaMatchTypeSelect.value = 'contains';
  if (qnaPriorityInput) qnaPriorityInput.value = 0;
  if (qnaAnswerInput) qnaAnswerInput.value = '';
  if (qnaEnabledInput) qnaEnabledInput.checked = true;
  if (qnaFormTitle) qnaFormTitle.textContent = '💬 Nova Regra de Auto-Resposta (Q&A)';
  if (btnCancelQna) btnCancelQna.style.display = 'none';
}

export function initQnaPanel() {
  // Preset templates handler
  document.querySelectorAll('.btn-qna-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateKey = btn.getAttribute('data-template');
      const data = qnaTemplates[templateKey];
      if (data) {
        if (qnaQuestionInput) qnaQuestionInput.value = data.question;
        if (qnaMatchTypeSelect) qnaMatchTypeSelect.value = data.match_type;
        if (qnaPriorityInput) qnaPriorityInput.value = data.priority;
        if (qnaAnswerInput) qnaAnswerInput.value = data.answer;
        if (qnaEnabledInput) qnaEnabledInput.checked = true;
      }
    });
  });

  if (qnaSearchInput) {
    qnaSearchInput.addEventListener('input', () => {
      renderQnaTable(state.allQnas);
    });
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

  // Window global CRUD actions
  window.editQna = function(id) {
    const qna = state.allQnas.find(q => q.id === id);
    if (!qna) return;

    if (qnaIdInput) qnaIdInput.value = qna.id;
    if (qnaQuestionInput) qnaQuestionInput.value = qna.question;
    if (qnaMatchTypeSelect) qnaMatchTypeSelect.value = qna.match_type || 'contains';
    if (qnaPriorityInput) qnaPriorityInput.value = qna.priority || 0;
    if (qnaAnswerInput) qnaAnswerInput.value = qna.answer || '';
    if (qnaEnabledInput) qnaEnabledInput.checked = qna.enabled === 1;

    if (qnaFormTitle) qnaFormTitle.textContent = '✏️ Editar Regra Q&A';
    if (btnCancelQna) btnCancelQna.style.display = 'inline-flex';
    if (qnaQuestionInput) qnaQuestionInput.focus();
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
}
