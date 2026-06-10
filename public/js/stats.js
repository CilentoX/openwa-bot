// === STATISTICS & CHARTS MODULE ===

import { showFeedback, escapeHtml } from './utils.js';

const statsReceivedBig = document.getElementById('stats-received-big');
const statsSentBig = document.getElementById('stats-sent-big');
const statsTotalBig = document.getElementById('stats-total-big');
const topCommandsList = document.getElementById('top-commands-list');
const btnPurgeLogs = document.getElementById('btn-purge-logs');
const purgeFeedback = document.getElementById('purge-feedback');

const statReceived = document.getElementById('stat-received');
const statSent = document.getElementById('stat-sent');

let historyChartInstance = null;
let directionChartInstance = null;

// Update stats on side widgets / stats page
export async function updateStats() {
  try {
    const response = await fetch('/api/bot-stats');
    if (response.ok) {
      const data = await response.json();
      if (statReceived) statReceived.textContent = data.stats.received;
      if (statSent) statSent.textContent = data.stats.sent;
      
      // Update stats tab big numbers if visible
      if (statsReceivedBig) statsReceivedBig.textContent = data.stats.received || 0;
      if (statsSentBig) statsSentBig.textContent = data.stats.sent || 0;
      if (statsTotalBig) statsTotalBig.textContent = data.messageCount || 0;
    }
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
  }
}

export async function loadStats() {
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

export async function loadAnalyticsCharts() {
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

export function initStatsPanel(onPurgeCallback) {
  if (btnPurgeLogs) {
    btnPurgeLogs.addEventListener('click', async () => {
      if (!confirm('Esta ação limpará todo o histórico de mensagens local do SQLite permanentemente. Deseja continuar?')) return;
      try {
        const response = await fetch('/api/messages', { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao limpar logs.');

        showFeedback(purgeFeedback, 'Histórico de mensagens do SQLite foi totalmente limpo!');
        
        if (onPurgeCallback && typeof onPurgeCallback === 'function') {
          onPurgeCallback();
        }

        await loadStats();
      } catch (err) {
        showFeedback(purgeFeedback, err.message, true);
      }
    });
  }
}
