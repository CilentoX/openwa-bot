const { openwaRequest } = require('../openwa-client');
const { addMessageLog } = require('../engine');

function sendError(reply, error, fallbackMsg) {
  return reply.code(error.status || 500).send({
    error: fallbackMsg,
    message: error.message,
    details: error.details || null
  });
}

async function proxyRoutes(fastify, options) {

  // ─── Health ───────────────────────────────────────────────────────────
  fastify.get('/api/health', async (req, reply) => {
    try { return reply.send(await openwaRequest('health')); }
    catch (e) { return sendError(reply, e, 'Health check falhou'); }
  });

  fastify.get('/api/health/live', async (req, reply) => {
    try { return reply.send(await openwaRequest('health/live')); }
    catch (e) { return sendError(reply, e, 'Liveness check falhou'); }
  });

  fastify.get('/api/health/ready', async (req, reply) => {
    try { return reply.send(await openwaRequest('health/ready')); }
    catch (e) { return sendError(reply, e, 'Readiness check falhou'); }
  });

  // ─── Sessions ─────────────────────────────────────────────────────────
  fastify.get('/api/sessions', async (req, reply) => {
    try { return reply.send(await openwaRequest('sessions')); }
    catch (e) { return sendError(reply, e, 'Erro ao listar sessões'); }
  });

  fastify.post('/api/sessions', async (req, reply) => {
    try {
      const data = await openwaRequest('sessions', {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao criar sessão'); }
  });

  fastify.get('/api/sessions/stats/overview', async (req, reply) => {
    try { return reply.send(await openwaRequest('sessions/stats/overview')); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar stats de sessões'); }
  });

  fastify.get('/api/sessions/:id', async (req, reply) => {
    try {
      const { ensureWebhookRegistered } = require('../openwa-client');
      ensureWebhookRegistered(req.params.id).catch(() => {});
      return reply.send(await openwaRequest(`sessions/${req.params.id}`));
    }
    catch (e) { return sendError(reply, e, `Erro ao buscar sessão ${req.params.id}`); }
  });

  fastify.delete('/api/sessions/:id', async (req, reply) => {
    try {
      await openwaRequest(`sessions/${req.params.id}`, { method: 'DELETE' });
      return reply.code(204).send();
    } catch (e) { return sendError(reply, e, `Erro ao deletar sessão ${req.params.id}`); }
  });

  fastify.post('/api/sessions/:id/start', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.id}/start`, { method: 'POST' })); }
    catch (e) { return sendError(reply, e, `Erro ao iniciar sessão ${req.params.id}`); }
  });

  fastify.post('/api/sessions/:id/stop', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.id}/stop`, { method: 'POST' })); }
    catch (e) { return sendError(reply, e, `Erro ao parar sessão ${req.params.id}`); }
  });

  fastify.get('/api/sessions/:id/qr', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.id}/qr`)); }
    catch (e) { return sendError(reply, e, `Erro ao obter QR code da sessão ${req.params.id}`); }
  });

  // ─── Webhooks ─────────────────────────────────────────────────────────
  fastify.get('/api/webhooks', async (req, reply) => {
    try { return reply.send(await openwaRequest('webhooks')); }
    catch (e) { return sendError(reply, e, 'Erro ao listar webhooks'); }
  });

  fastify.post('/api/sessions/:sessionId/webhooks', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/webhooks`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao criar webhook'); }
  });

  fastify.get('/api/sessions/:sessionId/webhooks', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/webhooks`)); }
    catch (e) { return sendError(reply, e, 'Erro ao listar webhooks da sessão'); }
  });

  fastify.get('/api/sessions/:sessionId/webhooks/:id', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/webhooks/${req.params.id}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar webhook'); }
  });

  fastify.put('/api/sessions/:sessionId/webhooks/:id', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/webhooks/${req.params.id}`, {
        method: 'PUT',
        body: JSON.stringify(req.body)
      });
      return reply.send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao atualizar webhook'); }
  });

  fastify.delete('/api/sessions/:sessionId/webhooks/:id', async (req, reply) => {
    try {
      await openwaRequest(`sessions/${req.params.sessionId}/webhooks/${req.params.id}`, { method: 'DELETE' });
      return reply.code(204).send();
    } catch (e) { return sendError(reply, e, 'Erro ao deletar webhook'); }
  });

  fastify.post('/api/sessions/:sessionId/webhooks/:id/test', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/webhooks/${req.params.id}/test`, { method: 'POST' })); }
    catch (e) { return sendError(reply, e, 'Erro ao testar webhook'); }
  });

  // ─── Messages ─────────────────────────────────────────────────────────
  fastify.get('/api/sessions/:sessionId/messages', async (req, reply) => {
    try {
      const qs = new URLSearchParams();
      if (req.query.chatId) qs.set('chatId', req.query.chatId);
      if (req.query.limit) qs.set('limit', req.query.limit);
      if (req.query.offset) qs.set('offset', req.query.offset);
      const qsStr = qs.toString() ? `?${qs.toString()}` : '';
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/messages${qsStr}`));
    } catch (e) { return sendError(reply, e, 'Erro ao buscar histórico de mensagens'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-text', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-text`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      const { chatId, text } = req.body;
      const messageId = data?.id || data?.response?.id;
      await addMessageLog('outgoing', chatId, text, null, messageId);
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar mensagem de texto'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-image', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-image`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      const { chatId, caption } = req.body;
      const messageId = data?.id || data?.response?.id;
      await addMessageLog('outgoing', chatId, caption ? `📷 ${caption}` : '🖼️ [Imagem]', null, messageId);
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar imagem'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-video', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-video`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      const { chatId, caption } = req.body;
      const messageId = data?.id || data?.response?.id;
      await addMessageLog('outgoing', chatId, caption ? `🎥 ${caption}` : '🎥 [Vídeo]', null, messageId);
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar vídeo'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-audio', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-audio`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      const { chatId } = req.body;
      const messageId = data?.id || data?.response?.id;
      await addMessageLog('outgoing', chatId, '🎙️ [Áudio/Mensagem de voz]', null, messageId);
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar áudio'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-document', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-document`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      const { chatId, filename } = req.body;
      const messageId = data?.id || data?.response?.id;
      await addMessageLog('outgoing', chatId, filename ? `📄 Documento: ${filename}` : '📄 [Documento]', null, messageId);
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar documento'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-sticker', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-sticker`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      const { chatId } = req.body;
      const messageId = data?.id || data?.response?.id;
      await addMessageLog('outgoing', chatId, '✨ [Figurinha]', null, messageId);
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar sticker'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-location', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-location`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar localização'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-contact', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-contact`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar contato'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/reply', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/reply`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      const { chatId, text } = req.body;
      const messageId = data?.id || data?.response?.id;
      await addMessageLog('outgoing', chatId, text, null, messageId);
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao responder mensagem'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/forward', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/forward`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao encaminhar mensagem'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/react', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/react`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao reagir à mensagem'); }
  });

  fastify.get('/api/sessions/:sessionId/messages/:chatId/:messageId/reactions', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(
        `sessions/${req.params.sessionId}/messages/${req.params.chatId}/${req.params.messageId}/reactions`
      ));
    } catch (e) { return sendError(reply, e, 'Erro ao buscar reações'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/delete', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/delete`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao deletar mensagem'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-bulk', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/messages/send-bulk`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.code(202).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao enviar mensagens em massa'); }
  });

  fastify.get('/api/sessions/:sessionId/messages/batch/:batchId', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(
        `sessions/${req.params.sessionId}/messages/batch/${req.params.batchId}`
      ));
    } catch (e) { return sendError(reply, e, 'Erro ao buscar status do batch'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/batch/:batchId/cancel', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(
        `sessions/${req.params.sessionId}/messages/batch/${req.params.batchId}/cancel`,
        { method: 'POST' }
      ));
    } catch (e) { return sendError(reply, e, 'Erro ao cancelar batch'); }
  });

  // ─── Simplified Send (Dashboard Convenience) ─────────────────────────
  fastify.post('/api/sessions/:id/messages/send', async (req, reply) => {
    const { id } = req.params;
    const { chatId, text } = req.body;

    if (!chatId || !text) {
      return reply.code(400).send({ error: 'chatId e text são obrigatórios.' });
    }

    try {
      const data = await openwaRequest(`sessions/${id}/messages/send-text`, {
        method: 'POST',
        body: JSON.stringify({ chatId, text })
      });
      const messageId = data?.id || data?.response?.id;
      await addMessageLog('outgoing', chatId, text, null, messageId);
      return reply.send({ success: true, message: 'Mensagem enviada com sucesso!', data });
    } catch (error) {
      return reply.code(500).send({ error: `Erro ao enviar mensagem via sessão ${id}`, details: error.message || error });
    }
  });

  // ─── Contacts ─────────────────────────────────────────────────────────
  fastify.get('/api/sessions/:sessionId/contacts', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/contacts`)); }
    catch (e) { return sendError(reply, e, 'Erro ao listar contatos'); }
  });

  fastify.get('/api/sessions/:sessionId/contacts/:contactId', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/contacts/${req.params.contactId}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar contato'); }
  });

  fastify.get('/api/sessions/:sessionId/contacts/check/:number', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/contacts/check/${req.params.number}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao verificar número'); }
  });

  fastify.get('/api/sessions/:sessionId/contacts/:contactId/profile-picture', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/contacts/${req.params.contactId}/profile-picture`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar foto de perfil'); }
  });

  fastify.post('/api/sessions/:sessionId/contacts/:contactId/block', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/contacts/${req.params.contactId}/block`, { method: 'POST' })); }
    catch (e) { return sendError(reply, e, 'Erro ao bloquear contato'); }
  });

  fastify.delete('/api/sessions/:sessionId/contacts/:contactId/block', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/contacts/${req.params.contactId}/block`, { method: 'DELETE' })); }
    catch (e) { return sendError(reply, e, 'Erro ao desbloquear contato'); }
  });

  // ─── Groups ───────────────────────────────────────────────────────────
  fastify.get('/api/sessions/:sessionId/groups', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups`)); }
    catch (e) { return sendError(reply, e, 'Erro ao listar grupos'); }
  });

  fastify.post('/api/sessions/:sessionId/groups', async (req, reply) => {
    try {
      const data = await openwaRequest(`sessions/${req.params.sessionId}/groups`, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      return reply.code(201).send(data);
    } catch (e) { return sendError(reply, e, 'Erro ao criar grupo'); }
  });

  fastify.get('/api/sessions/:sessionId/groups/:groupId', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar detalhes do grupo'); }
  });

  fastify.post('/api/sessions/:sessionId/groups/:groupId/participants', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/participants`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao adicionar participantes'); }
  });

  fastify.delete('/api/sessions/:sessionId/groups/:groupId/participants', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/participants`, {
        method: 'DELETE', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao remover participantes'); }
  });

  fastify.post('/api/sessions/:sessionId/groups/:groupId/participants/promote', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/participants/promote`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao promover participantes'); }
  });

  fastify.post('/api/sessions/:sessionId/groups/:groupId/participants/demote', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/participants/demote`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao rebaixar participantes'); }
  });

  fastify.put('/api/sessions/:sessionId/groups/:groupId/subject', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/subject`, {
        method: 'PUT', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao alterar nome do grupo'); }
  });

  fastify.put('/api/sessions/:sessionId/groups/:groupId/description', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/description`, {
        method: 'PUT', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao alterar descrição do grupo'); }
  });

  fastify.post('/api/sessions/:sessionId/groups/:groupId/leave', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/leave`, { method: 'POST' })); }
    catch (e) { return sendError(reply, e, 'Erro ao sair do grupo'); }
  });

  fastify.get('/api/sessions/:sessionId/groups/:groupId/invite-code', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/invite-code`)); }
    catch (e) { return sendError(reply, e, 'Erro ao obter código de convite'); }
  });

  fastify.post('/api/sessions/:sessionId/groups/:groupId/invite-code/revoke', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/groups/${req.params.groupId}/invite-code/revoke`, { method: 'POST' })); }
    catch (e) { return sendError(reply, e, 'Erro ao revogar código de convite'); }
  });

  // ─── Labels ───────────────────────────────────────────────────────────
  fastify.get('/api/sessions/:sessionId/labels', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/labels`)); }
    catch (e) { return sendError(reply, e, 'Erro ao listar labels'); }
  });

  fastify.get('/api/sessions/:sessionId/labels/:labelId', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/labels/${req.params.labelId}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar label'); }
  });

  fastify.get('/api/sessions/:sessionId/labels/chat/:chatId', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/labels/chat/${req.params.chatId}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao listar labels do chat'); }
  });

  fastify.post('/api/sessions/:sessionId/labels/chat/:chatId', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/labels/chat/${req.params.chatId}`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao adicionar label ao chat'); }
  });

  fastify.delete('/api/sessions/:sessionId/labels/chat/:chatId/:labelId', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/labels/chat/${req.params.chatId}/${req.params.labelId}`, {
        method: 'DELETE'
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao remover label do chat'); }
  });

  // ─── Channels ─────────────────────────────────────────────────────────
  fastify.get('/api/sessions/:sessionId/channels', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/channels`)); }
    catch (e) { return sendError(reply, e, 'Erro ao listar canais'); }
  });

  fastify.get('/api/sessions/:sessionId/channels/:channelId', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/channels/${req.params.channelId}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar canal'); }
  });

  fastify.delete('/api/sessions/:sessionId/channels/:channelId', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/channels/${req.params.channelId}`, { method: 'DELETE' }));
    } catch (e) { return sendError(reply, e, 'Erro ao cancelar inscrição do canal'); }
  });

  fastify.get('/api/sessions/:sessionId/channels/:channelId/messages', async (req, reply) => {
    try {
      const qs = req.query.limit ? `?limit=${req.query.limit}` : '';
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/channels/${req.params.channelId}/messages${qs}`));
    } catch (e) { return sendError(reply, e, 'Erro ao buscar mensagens do canal'); }
  });

  fastify.post('/api/sessions/:sessionId/channels/subscribe', async (req, reply) => {
    try {
      return reply.code(201).send(await openwaRequest(`sessions/${req.params.sessionId}/channels/subscribe`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao inscrever no canal'); }
  });

  // ─── Status (WhatsApp Status/Stories) ─────────────────────────────────
  fastify.get('/api/sessions/:sessionId/status', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/status`)); }
    catch (e) { return sendError(reply, e, 'Erro ao listar status'); }
  });

  fastify.get('/api/sessions/:sessionId/status/:contactId', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/status/${req.params.contactId}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar status do contato'); }
  });

  fastify.post('/api/sessions/:sessionId/status/send-text', async (req, reply) => {
    try {
      return reply.code(201).send(await openwaRequest(`sessions/${req.params.sessionId}/status/send-text`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao postar status de texto'); }
  });

  fastify.post('/api/sessions/:sessionId/status/send-image', async (req, reply) => {
    try {
      return reply.code(201).send(await openwaRequest(`sessions/${req.params.sessionId}/status/send-image`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao postar status de imagem'); }
  });

  fastify.post('/api/sessions/:sessionId/status/send-video', async (req, reply) => {
    try {
      return reply.code(201).send(await openwaRequest(`sessions/${req.params.sessionId}/status/send-video`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao postar status de vídeo'); }
  });

  fastify.delete('/api/sessions/:sessionId/status/:statusId', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/status/${req.params.statusId}`, { method: 'DELETE' }));
    } catch (e) { return sendError(reply, e, 'Erro ao deletar status'); }
  });

  // ─── Catalog ──────────────────────────────────────────────────────────
  fastify.get('/api/sessions/:sessionId/catalog', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/catalog`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar catálogo'); }
  });

  fastify.get('/api/sessions/:sessionId/catalog/products', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/catalog/products`)); }
    catch (e) { return sendError(reply, e, 'Erro ao listar produtos'); }
  });

  fastify.get('/api/sessions/:sessionId/catalog/products/:productId', async (req, reply) => {
    try { return reply.send(await openwaRequest(`sessions/${req.params.sessionId}/catalog/products/${req.params.productId}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar produto'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-product', async (req, reply) => {
    try {
      return reply.code(201).send(await openwaRequest(`sessions/${req.params.sessionId}/messages/send-product`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao enviar produto'); }
  });

  fastify.post('/api/sessions/:sessionId/messages/send-catalog', async (req, reply) => {
    try {
      return reply.code(201).send(await openwaRequest(`sessions/${req.params.sessionId}/messages/send-catalog`, {
        method: 'POST', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao enviar catálogo'); }
  });

  // ─── Statistics (Gateway) ─────────────────────────────────────────────
  fastify.get('/api/stats/overview', async (req, reply) => {
    try { return reply.send(await openwaRequest('stats/overview')); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar estatísticas gerais'); }
  });

  fastify.get('/api/stats/messages', async (req, reply) => {
    try { return reply.send(await openwaRequest('stats/messages')); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar estatísticas de mensagens'); }
  });

  fastify.get('/api/stats/sessions/:sessionId', async (req, reply) => {
    try { return reply.send(await openwaRequest(`stats/sessions/${req.params.sessionId}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar estatísticas da sessão'); }
  });

  // ─── Audit ────────────────────────────────────────────────────────────
  fastify.get('/api/audit', async (req, reply) => {
    try {
      const qs = new URLSearchParams();
      ['action', 'severity', 'sessionId', 'apiKeyId', 'limit', 'offset'].forEach(k => {
        if (req.query[k]) qs.set(k, req.query[k]);
      });
      const qsStr = qs.toString() ? `?${qs.toString()}` : '';
      return reply.send(await openwaRequest(`audit${qsStr}`));
    } catch (e) { return sendError(reply, e, 'Erro ao listar audit logs'); }
  });

  // ─── Plugins ──────────────────────────────────────────────────────────
  fastify.get('/api/plugins', async (req, reply) => {
    try { return reply.send(await openwaRequest('plugins')); }
    catch (e) { return sendError(reply, e, 'Erro ao listar plugins'); }
  });

  fastify.get('/api/plugins/:id', async (req, reply) => {
    try { return reply.send(await openwaRequest(`plugins/${req.params.id}`)); }
    catch (e) { return sendError(reply, e, 'Erro ao buscar plugin'); }
  });

  fastify.post('/api/plugins/:id/enable', async (req, reply) => {
    try { return reply.send(await openwaRequest(`plugins/${req.params.id}/enable`, { method: 'POST' })); }
    catch (e) { return sendError(reply, e, 'Erro ao habilitar plugin'); }
  });

  fastify.post('/api/plugins/:id/disable', async (req, reply) => {
    try { return reply.send(await openwaRequest(`plugins/${req.params.id}/disable`, { method: 'POST' })); }
    catch (e) { return sendError(reply, e, 'Erro ao desabilitar plugin'); }
  });

  fastify.put('/api/plugins/:id/config', async (req, reply) => {
    try {
      return reply.send(await openwaRequest(`plugins/${req.params.id}/config`, {
        method: 'PUT', body: JSON.stringify(req.body)
      }));
    } catch (e) { return sendError(reply, e, 'Erro ao atualizar config do plugin'); }
  });

  fastify.get('/api/plugins/:id/health', async (req, reply) => {
    try { return reply.send(await openwaRequest(`plugins/${req.params.id}/health`)); }
    catch (e) { return sendError(reply, e, 'Erro ao verificar saúde do plugin'); }
  });
}

module.exports = proxyRoutes;
