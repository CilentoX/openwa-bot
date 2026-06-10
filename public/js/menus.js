// === INTERACTIVE MENUS (URA) MODULE ===

import { state } from './state.js';
import { showFeedback, escapeHtml, fileToBase64 } from './utils.js';

const menuForm = document.getElementById('menu-form');
const btnCancelMenu = document.getElementById('btn-cancel-menu');
const menuFeedback = document.getElementById('menu-feedback');

export async function loadMenus() {
  try {
    const response = await fetch('/api/menus');
    if (!response.ok) throw new Error('Não foi possível carregar os menus.');
    state.allMenusList = await response.json();
    
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
  const nonLeafMenus = state.allMenusList.filter(m => m.is_leaf !== 1);
  
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
  
  const roots = state.allMenusList.filter(m => !m.parent_id);
  
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
  const children = state.allMenusList.filter(m => m.parent_id === node.id);
  
  div.innerHTML = `
    <div class="tree-node" id="node-${node.id}">
      <div class="tree-node-header">
        <div class="tree-node-title">
          <span>🌳</span>
          <strong>${escapeHtml(node.name)}</strong>
          <span class="tree-node-badge">Acionador: "${escapeHtml(node.trigger_option)}"</span>
          ${node.image_url ? '<span class="tree-node-badge" style="background: #3b82f6;">📷 Com Imagem</span>' : ''}
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

export function initMenusPanel() {
  const menuImageFileInput = document.getElementById('menu-image-file');
  const menuImageUrlInput = document.getElementById('menu-image-url');

  if (menuImageFileInput) {
    menuImageFileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        try {
          const base64 = await fileToBase64(e.target.files[0]);
          if (menuImageUrlInput) menuImageUrlInput.value = base64;
        } catch (err) {
          console.error('Erro ao converter imagem:', err);
          alert('Erro ao carregar imagem do computador.');
        }
      }
    });
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
        image_url: document.getElementById('menu-image-url').value.trim() || null,
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

  // Window global URA actions
  window.editMenu = function(id) {
    const menu = state.allMenusList.find(m => m.id === id);
    if (!menu) return;
    
    const menuIdInput = document.getElementById('menu-id');
    const menuNameInput = document.getElementById('menu-name');
    const menuParentIdSelect = document.getElementById('menu-parent-id');
    const menuTriggerInput = document.getElementById('menu-trigger-option');
    const menuMessageText = document.getElementById('menu-message-text');
    const menuImageUrlInput = document.getElementById('menu-image-url');
    const menuIsLeaf = document.getElementById('menu-is-leaf');
    const menuEnabled = document.getElementById('menu-enabled');
    const menuFormTitle = document.getElementById('menu-form-title');
    
    if (menuIdInput) menuIdInput.value = menu.id;
    if (menuNameInput) menuNameInput.value = menu.name;
    if (menuParentIdSelect) menuParentIdSelect.value = menu.parent_id || '';
    if (menuTriggerInput) menuTriggerInput.value = menu.trigger_option;
    if (menuMessageText) menuMessageText.value = menu.message_text;
    if (menuImageUrlInput) menuImageUrlInput.value = menu.image_url || '';
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
}
