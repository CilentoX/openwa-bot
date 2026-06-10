// === CHAT & REAL-TIME EVENTS MODULE ===

import { state } from './state.js';
import { showFeedback, escapeHtml, formatBytes } from './utils.js';
import { updateStats } from './stats.js';

// DOM Elements - Chat Tab
const chatListContainer = document.getElementById('chat-list-container');
const messagesFeed = document.getElementById('messages-feed');
const chatScreenHeader = document.getElementById('chat-screen-header');
const chatHeaderTitle = document.getElementById('chat-header-title');
const chatHeaderStatus = document.getElementById('chat-header-status');
const btnArchiveActiveChat = document.getElementById('btn-archive-active-chat');
const btnUnarchiveActiveChat = document.getElementById('btn-unarchive-active-chat');
const chatReplyBar = document.getElementById('chat-reply-bar');
const chatReplyForm = document.getElementById('chat-reply-form');
const chatReplyInput = document.getElementById('chat-reply-input');
const chatContactSearch = document.getElementById('chat-contact-search');
const chatMyPushname = document.getElementById('chat-my-pushname');

// Filters State
let chatActiveFilter = 'active'; // 'active' | 'archived'

// DOM Elements - Send Test Form (Monitor Tab)
const sendForm = document.getElementById('send-form');
const sendChatIdInput = document.getElementById('send-chat-id');
const sendTextInput = document.getElementById('send-text');
const btnSendMessage = document.getElementById('btn-send-message');
const sendFeedback = document.getElementById('send-feedback');
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

// Clean / reset local message cache
export function clearCachedMessages() {
  state.conversations = {};
  state.currentChatId = '';
  state.unreadCounts = {};
  renderSidebarChats();
  renderActiveChatMessages();
  if (chatScreenHeader) chatScreenHeader.style.display = 'none';
  if (chatReplyBar) chatReplyBar.style.display = 'none';
}

// Fetch messages from server and group by conversation JID
export async function fetchMessages() {
  try {
    const response = await fetch('/api/messages');
    if (!response.ok) throw new Error('Erro ao buscar feed.');
    const messages = await response.json();
    
    state.conversations = {};
    messages.forEach(msg => {
      const jid = msg.from;
      if (!state.conversations[jid]) {
        state.conversations[jid] = [];
      }
      state.conversations[jid].push(msg);
    });
    
    renderSidebarChats();
    if (state.currentChatId) {
      renderActiveChatMessages();
    }
  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
  }
}

// Fetch contacts map from Session ID
export async function fetchContacts() {
  if (!state.currentSessionId) return;
  try {
    const response = await fetch(`/api/sessions/${state.currentSessionId}/contacts`);
    if (response.ok) {
      const contactsList = await response.json();
      state.contactsMap = {};
      if (Array.isArray(contactsList)) {
        contactsList.forEach(c => {
          if (c.id) {
            state.contactsMap[c.id] = c.name || c.pushName || c.formattedName || c.id.split('@')[0];
          }
        });
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar contatos:', err);
  }
}

// Fetch archived chat JIDs from SQLite
export async function fetchArchivedChats() {
  try {
    const response = await fetch('/api/archived-chats');
    if (response.ok) {
      const archivedJidsList = await response.json();
      state.archivedJids = new Set(archivedJidsList);
    }
  } catch (err) {
    console.error('Erro ao carregar JIDs arquivados:', err);
  }
}

// Archive a conversation
export async function archiveChat(jid) {
  if (!jid) return;
  try {
    const response = await fetch(`/api/archived-chats/${encodeURIComponent(jid)}/archive`, {
      method: 'POST'
    });
    if (response.ok) {
      state.archivedJids.add(jid);
      updateActiveChatHeader();
      renderSidebarChats();
    } else {
      console.error('Erro ao chamar endpoint de arquivar');
    }
  } catch (err) {
    console.error('Erro ao arquivar chat:', err);
  }
}

// Unarchive a conversation
export async function unarchiveChat(jid) {
  if (!jid) return;
  try {
    const response = await fetch(`/api/archived-chats/${encodeURIComponent(jid)}/unarchive`, {
      method: 'POST'
    });
    if (response.ok) {
      state.archivedJids.delete(jid);
      updateActiveChatHeader();
      renderSidebarChats();
    } else {
      console.error('Erro ao chamar endpoint de desarquivar');
    }
  } catch (err) {
    console.error('Erro ao desarquivar chat:', err);
  }
}

// Render left sidebar conversation list with filters and real names
export function renderSidebarChats() {
  if (!chatListContainer) return;
  chatListContainer.innerHTML = '';
  
  const sortedJids = Object.keys(state.conversations).sort((a, b) => {
    const msgsA = state.conversations[a];
    const msgsB = state.conversations[b];
    const lastA = msgsA[msgsA.length - 1];
    const lastB = msgsB[msgsB.length - 1];
    return (lastB?.timestamp || 0) - (lastA?.timestamp || 0);
  });

  // Filter based on active vs archived
  let filteredJids = sortedJids.filter(jid => {
    const isArchived = state.archivedJids.has(jid);
    if (chatActiveFilter === 'active') {
      return !isArchived;
    } else {
      return isArchived;
    }
  });

  // Filter based on search input
  const searchText = chatContactSearch ? chatContactSearch.value.trim().toLowerCase() : '';
  if (searchText) {
    filteredJids = filteredJids.filter(jid => {
      const contactName = (state.contactsMap[jid] || jid.split('@')[0]).toLowerCase();
      return contactName.includes(searchText) || jid.toLowerCase().includes(searchText);
    });
  }
  
  if (filteredJids.length === 0) {
    chatListContainer.innerHTML = `
      <div class="no-chats-placeholder" style="padding:20px; text-align:center; color:var(--text-muted); font-size:0.8rem;">
        ${chatActiveFilter === 'active' ? 'Sem conversas ativas.' : 'Sem conversas arquivadas.'}
      </div>
    `;
    return;
  }
  
  filteredJids.forEach(jid => {
    const msgs = state.conversations[jid];
    const lastMsg = msgs[msgs.length - 1];
    const unreadCount = state.unreadCounts[jid] || 0;
    
    const chatItem = document.createElement('button');
    chatItem.type = 'button';
    chatItem.className = `chat-item ${jid === state.currentChatId ? 'active' : ''}`;
    
    const isGroup = jid.includes('@g.us');
    const avatar = isGroup ? '👥' : '👤';
    const displayName = state.contactsMap[jid] || jid.split('@')[0];
    
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

// Update Archive/Unarchive buttons dynamically on the Header
function updateActiveChatHeader() {
  if (!state.currentChatId) return;
  const isArchived = state.archivedJids.has(state.currentChatId);

  if (btnArchiveActiveChat && btnUnarchiveActiveChat) {
    if (isArchived) {
      btnArchiveActiveChat.style.display = 'none';
      btnUnarchiveActiveChat.style.display = 'inline-flex';
    } else {
      btnArchiveActiveChat.style.display = 'inline-flex';
      btnUnarchiveActiveChat.style.display = 'none';
    }
  }
}

// Select active conversation JID
export function selectConversation(jid) {
  state.currentChatId = jid;
  state.unreadCounts[jid] = 0;
  
  renderSidebarChats();
  
  if (chatScreenHeader) chatScreenHeader.style.display = 'flex';
  if (chatReplyBar) chatReplyBar.style.display = 'block';
  if (chatHeaderTitle) {
    const displayName = state.contactsMap[jid] || jid.split('@')[0];
    chatHeaderTitle.textContent = displayName;
    chatHeaderTitle.title = jid;
  }
  
  updateActiveChatHeader();
  renderActiveChatMessages();
  
  if (sendChatIdInput) {
    sendChatIdInput.value = jid;
  }
}

// Render message bubbles inside feed
export function renderActiveChatMessages() {
  if (!messagesFeed) return;
  
  if (!state.currentChatId) {
    messagesFeed.innerHTML = `
      <div class="no-messages-placeholder">
        <div class="placeholder-icon">💬</div>
        <h2>OpenWA Web</h2>
        <p>Selecione uma conversa ao lado para começar.</p>
      </div>
    `;
    return;
  }
  
  const msgs = state.conversations[state.currentChatId] || [];
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
    const senderName = isOutgoing ? 'Bot' : (state.contactsMap[msg.from] || msg.from.split('@')[0]);

    msgContainer.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-jid">${escapeHtml(senderName)}</div>
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

// SSE Connection for Real-Time stream
let eventSource = null;
export function connectMessageStream() {
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
  if (!state.conversations[jid]) {
    state.conversations[jid] = [];
  }
  state.conversations[jid].push(msg);

  if (jid === state.currentChatId) {
    const isOutgoing = msg.direction === 'outgoing';
    const msgContainer = document.createElement('div');
    msgContainer.className = `msg-bubble-container ${isOutgoing ? 'msg-outgoing' : 'msg-incoming'}`;
    
    const date = new Date(msg.timestamp);
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const senderName = isOutgoing ? 'Bot' : (state.contactsMap[msg.from] || msg.from.split('@')[0]);

    msgContainer.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-jid">${escapeHtml(senderName)}</div>
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
    // Only increment unread counts if chat is active (not archived) or we are in archived view
    const isArchived = state.archivedJids.has(jid);
    if ((chatActiveFilter === 'active' && !isArchived) || (chatActiveFilter === 'archived' && isArchived)) {
      state.unreadCounts[jid] = (state.unreadCounts[jid] || 0) + 1;
    }
  }

  renderSidebarChats();
  updateStats();
}

// Media Files Send Test Functions
function removeSelectedFile() {
  selectedMedia = null;
  if (mediaFileInput) mediaFileInput.value = '';
  if (filePreviewBox) filePreviewBox.style.display = 'none';
  if (previewContent) previewContent.innerHTML = '';
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

// Initialize Chat Panel Actions
export function initChatPanel() {
  // Filters Active / Archived Tab Clicks
  const btnFilterActive = document.getElementById('btn-filter-active');
  const btnFilterArchived = document.getElementById('btn-filter-archived');

  if (btnFilterActive && btnFilterArchived) {
    btnFilterActive.addEventListener('click', () => {
      chatActiveFilter = 'active';
      btnFilterActive.classList.add('active');
      btnFilterArchived.classList.remove('active');
      renderSidebarChats();
    });

    btnFilterArchived.addEventListener('click', () => {
      chatActiveFilter = 'archived';
      btnFilterArchived.classList.add('active');
      btnFilterActive.classList.remove('active');
      renderSidebarChats();
    });
  }

  // Sidebar contact search typing
  if (chatContactSearch) {
    chatContactSearch.addEventListener('input', () => {
      renderSidebarChats();
    });
  }

  // Archive / Unarchive header buttons click
  if (btnArchiveActiveChat) {
    btnArchiveActiveChat.addEventListener('click', () => {
      archiveChat(state.currentChatId);
    });
  }

  if (btnUnarchiveActiveChat) {
    btnUnarchiveActiveChat.addEventListener('click', () => {
      unarchiveChat(state.currentChatId);
    });
  }

  // Quick Reply Submitting
  if (chatReplyForm) {
    chatReplyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentChatId || !state.currentSessionId) return;

      const text = chatReplyInput.value.trim();
      if (!text) return;

      chatReplyInput.disabled = true;
      try {
        const response = await fetch(`/api/sessions/${state.currentSessionId}/messages/send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: state.currentChatId, text })
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

  // Set up Monitor Tab Send Media / Test Form
  if (sendMsgType) {
    sendMsgType.addEventListener('change', () => {
      const type = sendMsgType.value;
      removeSelectedFile();

      if (type === 'text') {
        if (sendTextGroup) sendTextGroup.style.display = 'block';
        if (sendTextInput) sendTextInput.required = true;
        if (sendMediaGroup) sendMediaGroup.style.display = 'none';
        if (sendCaptionGroup) sendCaptionGroup.style.display = 'none';
        if (sendFilenameGroup) sendFilenameGroup.style.display = 'none';
      } else {
        if (sendTextGroup) sendTextGroup.style.display = 'none';
        if (sendTextInput) sendTextInput.required = false;
        if (sendMediaGroup) sendMediaGroup.style.display = 'block';

        if (type === 'image' || type === 'video' || type === 'document') {
          if (sendCaptionGroup) sendCaptionGroup.style.display = 'block';
        } else {
          if (sendCaptionGroup) sendCaptionGroup.style.display = 'none';
        }

        if (type === 'document') {
          if (sendFilenameGroup) sendFilenameGroup.style.display = 'block';
        } else {
          if (sendFilenameGroup) sendFilenameGroup.style.display = 'none';
        }

        if (fileTypeInfo && mediaFileInput) {
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
      }
    });
  }

  if (btnRemoveFile) {
    btnRemoveFile.addEventListener('click', removeSelectedFile);
  }

  if (fileDropZone) {
    fileDropZone.addEventListener('click', () => {
      if (mediaFileInput) mediaFileInput.click();
    });

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

  // Send Test Message Submit
  if (sendForm) {
    sendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentSessionId) {
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
        let endpoint = `/api/sessions/${state.currentSessionId}/messages/send`;
        let payload = { chatId };

        if (type === 'text') {
          endpoint = `/api/sessions/${state.currentSessionId}/messages/send-text`;
          payload.text = sendTextInput.value;
        } else {
          if (!selectedMedia) {
            throw new Error('Por favor, selecione ou arraste um arquivo para enviar.');
          }

          if (type === 'image') endpoint = `/api/sessions/${state.currentSessionId}/messages/send-image`;
          else if (type === 'audio') endpoint = `/api/sessions/${state.currentSessionId}/messages/send-audio`;
          else if (type === 'video') endpoint = `/api/sessions/${state.currentSessionId}/messages/send-video`;
          else if (type === 'document') endpoint = `/api/sessions/${state.currentSessionId}/messages/send-document`;
          else if (type === 'sticker') endpoint = `/api/sessions/${state.currentSessionId}/messages/send-sticker`;

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
        if (sendTextInput) sendTextInput.value = '';
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
}
