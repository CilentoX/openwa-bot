const { getDb } = require('../database');

async function messagesRoutes(fastify, options) {
  const db = getDb();

  // GET /api/messages
  fastify.get('/api/messages', async (request, reply) => {
    try {
      const rows = await db.all(
        'SELECT direction, chat_id as "from", body, timestamp, command FROM message_logs ORDER BY timestamp ASC LIMIT 200'
      );
      return reply.send(rows);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao carregar mensagens', details: err.message });
    }
  });

  // DELETE /api/messages
  fastify.delete('/api/messages', async (request, reply) => {
    try {
      await db.run('DELETE FROM message_logs');
      return reply.send({ success: true, message: 'Histórico de mensagens limpo com sucesso.' });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao limpar histórico', details: err.message });
    }
  });

  // GET /api/bot-stats
  fastify.get('/api/bot-stats', async (request, reply) => {
    try {
      const receivedRow = await db.get('SELECT value FROM stats WHERE key = "received"');
      const sentRow = await db.get('SELECT value FROM stats WHERE key = "sent"');
      const messageCountRow = await db.get('SELECT COUNT(*) as count FROM message_logs');

      // Top used commands list
      const topCommands = await db.all(
        'SELECT command, COUNT(*) as count FROM message_logs WHERE command IS NOT NULL GROUP BY command ORDER BY count DESC LIMIT 5'
      );

      return reply.send({
        stats: {
          received: receivedRow ? receivedRow.value : 0,
          sent: sentRow ? sentRow.value : 0
        },
        messageCount: messageCountRow ? messageCountRow.count : 0,
        topCommands: topCommands || []
      });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao carregar estatísticas', details: err.message });
    }
  });

  // GET /api/messages/stream (SSE)
  fastify.get('/api/messages/stream', (request, reply) => {
    const messageEmitter = require('../events');
    
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    reply.raw.write('comment: connected\n\n');

    const onMessage = (data) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    messageEmitter.on('message', onMessage);

    request.raw.on('close', () => {
      messageEmitter.off('message', onMessage);
    });
  });

  // GET /api/bot-stats/history
  fastify.get('/api/bot-stats/history', async (request, reply) => {
    try {
      const historyRows = await db.all(`
        SELECT 
          strftime('%d/%m %H:00', timestamp / 1000, 'unixepoch', 'localtime') as period,
          direction,
          COUNT(*) as count
        FROM message_logs
        WHERE timestamp > ?
        GROUP BY period, direction
        ORDER BY timestamp ASC
      `, [Date.now() - 24 * 60 * 60 * 1000]);

      const directionRows = await db.all(`
        SELECT direction, COUNT(*) as count
        FROM message_logs
        GROUP BY direction
      `);

      return reply.send({
        history: historyRows || [],
        directionStats: directionRows || []
      });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao buscar histórico de estatísticas', details: err.message });
    }
  });

  // GET /api/archived-chats
  fastify.get('/api/archived-chats', async (request, reply) => {
    try {
      const rows = await db.all('SELECT chat_id FROM archived_chats');
      return reply.send(rows.map(r => r.chat_id));
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao listar chats arquivados', details: err.message });
    }
  });

  // POST /api/archived-chats/:jid/archive
  fastify.post('/api/archived-chats/:jid/archive', async (request, reply) => {
    try {
      const { jid } = request.params;
      await db.run('INSERT OR IGNORE INTO archived_chats (chat_id, archived_at) VALUES (?, ?)', [jid, Date.now()]);
      return reply.send({ success: true, message: 'Chat arquivado com sucesso.' });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao arquivar chat', details: err.message });
    }
  });

  // POST /api/archived-chats/:jid/unarchive
  fastify.post('/api/archived-chats/:jid/unarchive', async (request, reply) => {
    try {
      const { jid } = request.params;
      await db.run('DELETE FROM archived_chats WHERE chat_id = ?', [jid]);
      return reply.send({ success: true, message: 'Chat desarquivado com sucesso.' });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao desarquivar chat', details: err.message });
    }
  });
}

module.exports = messagesRoutes;
