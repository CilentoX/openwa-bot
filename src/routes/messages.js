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
}

module.exports = messagesRoutes;
