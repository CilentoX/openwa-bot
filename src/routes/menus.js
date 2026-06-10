const { getDb } = require('../database');

async function menusRoutes(fastify, options) {
  const db = getDb();

  // GET /api/menus
  fastify.get('/api/menus', async (request, reply) => {
    try {
      const rows = await db.all('SELECT * FROM bot_menus ORDER BY id ASC');
      return reply.send(rows);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao listar menus', details: err.message });
    }
  });

  // POST /api/menus
  fastify.post('/api/menus', async (request, reply) => {
    try {
      const { name, message_text, parent_id, trigger_option, is_leaf, enabled } = request.body;
      if (!name || !trigger_option || !message_text) {
        return reply.code(400).send({ error: 'Os campos nome, trigger_option e message_text são obrigatórios.' });
      }

      const cleanTrigger = trigger_option.trim();
      const parentVal = parent_id ? Number(parent_id) : null;

      // Check for duplicate triggers at the same level
      const duplicate = await db.get(
        'SELECT id FROM bot_menus WHERE trigger_option = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))',
        [cleanTrigger, parentVal, parentVal]
      );
      if (duplicate) {
        return reply.code(400).send({ error: `Já existe um menu com a opção de disparo '${cleanTrigger}' neste mesmo nível.` });
      }

      const result = await db.run(
        'INSERT INTO bot_menus (name, message_text, parent_id, trigger_option, is_leaf, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          name.trim(),
          message_text,
          parentVal,
          cleanTrigger,
          is_leaf ? 1 : 0,
          enabled !== undefined ? enabled : 1,
          Date.now()
        ]
      );

      const newMenu = await db.get('SELECT * FROM bot_menus WHERE id = ?', [result.lastID]);
      return reply.code(201).send(newMenu);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao criar menu', details: err.message });
    }
  });

  // PUT /api/menus/:id
  fastify.put('/api/menus/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, message_text, parent_id, trigger_option, is_leaf, enabled } = request.body;

      if (!name || !trigger_option || !message_text) {
        return reply.code(400).send({ error: 'Os campos nome, trigger_option e message_text são obrigatórios.' });
      }

      const cleanTrigger = trigger_option.trim();
      const parentVal = parent_id ? Number(parent_id) : null;

      // Prevent a menu from being its own parent
      if (parentVal === Number(id)) {
        return reply.code(400).send({ error: 'Um menu não pode ser pai de si mesmo.' });
      }

      // Check for duplicate triggers at the same level (excluding itself)
      const duplicate = await db.get(
        'SELECT id FROM bot_menus WHERE trigger_option = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL)) AND id != ?',
        [cleanTrigger, parentVal, parentVal, id]
      );
      if (duplicate) {
        return reply.code(400).send({ error: `Já existe outro menu com a opção de disparo '${cleanTrigger}' neste mesmo nível.` });
      }

      await db.run(
        'UPDATE bot_menus SET name = ?, message_text = ?, parent_id = ?, trigger_option = ?, is_leaf = ?, enabled = ? WHERE id = ?',
        [
          name.trim(),
          message_text,
          parentVal,
          cleanTrigger,
          is_leaf ? 1 : 0,
          enabled !== undefined ? enabled : 1,
          id
        ]
      );

      const updatedMenu = await db.get('SELECT * FROM bot_menus WHERE id = ?', [id]);
      if (!updatedMenu) {
        return reply.code(404).send({ error: 'Menu não encontrado.' });
      }

      return reply.send(updatedMenu);
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao atualizar menu', details: err.message });
    }
  });

  // PATCH /api/menus/:id/toggle
  fastify.patch('/api/menus/:id/toggle', async (request, reply) => {
    try {
      const { id } = request.params;
      const menu = await db.get('SELECT enabled FROM bot_menus WHERE id = ?', [id]);
      if (!menu) {
        return reply.code(404).send({ error: 'Menu não encontrado.' });
      }

      const newStatus = menu.enabled === 1 ? 0 : 1;
      await db.run('UPDATE bot_menus SET enabled = ? WHERE id = ?', [newStatus, id]);
      return reply.send({ success: true, id, enabled: newStatus });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao alternar status do menu', details: err.message });
    }
  });

  // DELETE /api/menus/:id
  fastify.delete('/api/menus/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const menu = await db.get('SELECT id FROM bot_menus WHERE id = ?', [id]);
      if (!menu) {
        return reply.code(404).send({ error: 'Menu não encontrado.' });
      }

      // Recursive helper to delete nodes and their children
      const deleteNode = async (nodeId) => {
        const children = await db.all('SELECT id FROM bot_menus WHERE parent_id = ?', [nodeId]);
        for (const child of children) {
          await deleteNode(child.id);
        }
        await db.run('DELETE FROM bot_menus WHERE id = ?', [nodeId]);
        // Clean up any active states that reference this menu
        await db.run('DELETE FROM customer_states WHERE current_menu_id = ?', [nodeId]);
      };

      await deleteNode(Number(id));
      return reply.send({ success: true, message: 'Menu e todos os seus submenus foram excluídos com sucesso.' });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao excluir menu', details: err.message });
    }
  });
}

module.exports = menusRoutes;
