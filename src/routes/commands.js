const { getDb } = require('../database');

async function commandsRoutes(fastify, options) {
  const db = getDb();

  // GET /api/commands
  fastify.get('/api/commands', async (request, reply) => {
    try {
      const rows = await db.all('SELECT * FROM commands ORDER BY id ASC');
      return reply.send(rows);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao listar comandos', details: err.message });
    }
  });

  // POST /api/commands
  fastify.post('/api/commands', async (request, reply) => {
    try {
      const { trigger, response, description, type } = request.body;
      if (!trigger) {
        return reply.code(400).send({ error: 'O gatilho (trigger) é obrigatório.' });
      }

      const cleanTrigger = trigger.trim();
      const existing = await db.get('SELECT id FROM commands WHERE trigger = ?', [cleanTrigger]);
      if (existing) {
        return reply.code(400).send({ error: `O comando '${cleanTrigger}' já existe.` });
      }

      const result = await db.run(
        'INSERT INTO commands (trigger, response, description, type, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        [cleanTrigger, response || '', description || '', type || 'static', Date.now()]
      );

      const newCmd = await db.get('SELECT * FROM commands WHERE id = ?', [result.lastID]);
      return reply.code(201).send(newCmd);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao criar comando', details: err.message });
    }
  });

  // PUT /api/commands/:id
  fastify.put('/api/commands/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { trigger, response, description, type, enabled } = request.body;

      if (!trigger) {
        return reply.code(400).send({ error: 'O gatilho (trigger) é obrigatório.' });
      }

      const cleanTrigger = trigger.trim();
      const existing = await db.get('SELECT id FROM commands WHERE trigger = ? AND id != ?', [cleanTrigger, id]);
      if (existing) {
        return reply.code(400).send({ error: `Já existe outro comando cadastrado com o gatilho '${cleanTrigger}'.` });
      }

      await db.run(
        'UPDATE commands SET trigger = ?, response = ?, description = ?, type = ?, enabled = ? WHERE id = ?',
        [cleanTrigger, response || '', description || '', type || 'static', enabled !== undefined ? enabled : 1, id]
      );

      const updatedCmd = await db.get('SELECT * FROM commands WHERE id = ?', [id]);
      if (!updatedCmd) {
        return reply.code(404).send({ error: 'Comando não encontrado.' });
      }

      return reply.send(updatedCmd);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao atualizar comando', details: err.message });
    }
  });

  // PATCH /api/commands/:id/toggle
  fastify.patch('/api/commands/:id/toggle', async (request, reply) => {
    try {
      const { id } = request.params;
      const cmd = await db.get('SELECT enabled FROM commands WHERE id = ?', [id]);
      if (!cmd) {
        return reply.code(404).send({ error: 'Comando não encontrado.' });
      }

      const newStatus = cmd.enabled === 1 ? 0 : 1;
      await db.run('UPDATE commands SET enabled = ? WHERE id = ?', [newStatus, id]);
      return reply.send({ success: true, id, enabled: newStatus });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao alterar status do comando', details: err.message });
    }
  });

  // DELETE /api/commands/:id
  fastify.delete('/api/commands/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const cmd = await db.get('SELECT id FROM commands WHERE id = ?', [id]);
      if (!cmd) {
        return reply.code(404).send({ error: 'Comando não encontrado.' });
      }

      await db.run('DELETE FROM commands WHERE id = ?', [id]);
      return reply.send({ success: true, message: 'Comando excluído com sucesso.' });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao excluir comando', details: err.message });
    }
  });
}

module.exports = commandsRoutes;
