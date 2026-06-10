// === MAIN APP MODULE ENTRY POINT ===

import { state } from './state.js';
import { loadConfig, testIntegration, initConfigPanel } from './config.js';
import { loadCommands, initCommandsPanel } from './commands.js';
import { loadQna, initQnaPanel } from './qna.js';
import { loadMenus, initMenusPanel } from './menus.js';
import { loadStats, loadAnalyticsCharts, initStatsPanel, updateStats } from './stats.js';
import { fetchSessions, initSessionsPanel } from './sessions.js';
import { fetchMessages, fetchContacts, fetchArchivedChats, connectMessageStream, clearCachedMessages, initChatPanel } from './chat.js';

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
      } else if (tabId === 'chat') {
        fetchMessages();
        fetchContacts();
        fetchArchivedChats();
      }
    });
  });

  // === INITIALIZE SUB-PANELS ===
  initConfigPanel();
  initCommandsPanel();
  initQnaPanel();
  initMenusPanel();
  initStatsPanel(() => {
    clearCachedMessages();
  });
  initSessionsPanel();
  initChatPanel();

  // === APP STARTUP INITIALIZATION ===
  loadConfig();
  fetchArchivedChats();
  
  fetchSessions().then(() => {
    updateStats();
    fetchContacts().then(() => {
      fetchMessages();
    });
    connectMessageStream();
    
    // Continuous polling
    setInterval(fetchSessions, 10000); // Poll session list every 10s
    setInterval(() => {
      if (state.currentSessionId) {
        // Poll active session details
        fetchSessionDetails(state.currentSessionId);
      }
    }, 5000); // Poll active session status every 5s
  });

  // Helper helper to dynamically fetch session details on demand
  async function fetchSessionDetails(sessionId) {
    const { fetchSessionDetails: detailsFetcher } = await import('./sessions.js');
    detailsFetcher(sessionId);
  }
});
