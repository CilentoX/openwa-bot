const { getDb } = require('../database');

async function qnaRoutes(fastify, options) {
  const db = getDb();

  // GET /api/qna
  fastify.get('/api/qna', async (request, reply) => {
    try {
      const rows = await db.all('SELECT * FROM qna ORDER BY priority DESC, id ASC');
      return reply.send(rows);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao listar regras de Q&A', details: err.message });
    }
  });

  // POST /api/qna
  fastify.post('/api/qna', async (request, reply) => {
    try {
      const { question, answer, match_type, priority } = request.body;
      if (!question || !answer) {
        return reply.code(400).send({ error: 'Pergunta e resposta são obrigatórios.' });
      }

      if (!['exact', 'contains', 'regex'].includes(match_type)) {
        return reply.code(400).send({ error: 'Tipo de correspondência inválido. Use exact, contains ou regex.' });
      }

      const result = await db.run(
        'INSERT INTO qna (question, answer, match_type, enabled, priority, created_at) VALUES (?, ?, ?, 1, ?, ?)',
        [question.trim(), answer, match_type, priority || 0, Date.now()]
      );

      const newQna = await db.get('SELECT * FROM qna WHERE id = ?', [result.lastID]);
      return reply.code(201).send(newQna);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao criar regra de Q&A', details: err.message });
    }
  });

  // PUT /api/qna/:id
  fastify.put('/api/qna/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { question, answer, match_type, priority, enabled } = request.body;

      if (!question || !answer) {
        return reply.code(400).send({ error: 'Pergunta e resposta são obrigatórios.' });
      }

      if (!['exact', 'contains', 'regex'].includes(match_type)) {
        return reply.code(400).send({ error: 'Tipo de correspondência inválido. Use exact, contains ou regex.' });
      }

      await db.run(
        'UPDATE qna SET question = ?, answer = ?, match_type = ?, priority = ?, enabled = ? WHERE id = ?',
        [question.trim(), answer, match_type, priority || 0, enabled !== undefined ? enabled : 1, id]
      );

      const updatedQna = await db.get('SELECT * FROM qna WHERE id = ?', [id]);
      if (!updatedQna) {
        return reply.code(404).send({ error: 'Regra de Q&A não encontrada.' });
      }

      return reply.send(updatedQna);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao atualizar regra de Q&A', details: err.message });
    }
  });

  // PATCH /api/qna/:id/toggle
  fastify.patch('/api/qna/:id/toggle', async (request, reply) => {
    try {
      const { id } = request.params;
      const qna = await db.get('SELECT enabled FROM qna WHERE id = ?', [id]);
      if (!qna) {
        return reply.code(404).send({ error: 'Regra de Q&A não encontrada.' });
      }

      const newStatus = qna.enabled === 1 ? 0 : 1;
      await db.run('UPDATE qna SET enabled = ? WHERE id = ?', [newStatus, id]);
      return reply.send({ success: true, id, enabled: newStatus });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao alterar status de Q&A', details: err.message });
    }
  });

  // DELETE /api/qna/:id
  fastify.delete('/api/qna/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const qna = await db.get('SELECT id FROM qna WHERE id = ?', [id]);
      if (!qna) {
        return reply.code(404).send({ error: 'Regra de Q&A não encontrada.' });
      }

      await db.run('DELETE FROM qna WHERE id = ?', [id]);
      return reply.send({ success: true, message: 'Regra de Q&A excluída com sucesso.' });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao excluir regra de Q&A', details: err.message });
    }
  });
}

module.exports = qnaRoutes;
