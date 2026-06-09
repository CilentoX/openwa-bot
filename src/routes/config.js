const { getAllConfig, setConfig } = require('../config-manager');

async function configRoutes(fastify, options) {
  // GET /api/config
  fastify.get('/api/config', async (request, reply) => {
    try {
      const config = await getAllConfig();

      // Show actual URL being used (env var takes priority)
      const effectiveUrl = process.env.OPENWA_API_URL || config.openwa_url || '';
      const connectionMode = process.env.OPENWA_API_URL ? 'direct' : 'config';

      return reply.send({
        openwaUrl: effectiveUrl,
        apiKey: config.api_key || '',
        defaultSessionId: config.default_session_id || '',
        botName: config.bot_name || 'OpenWA Bot',
        port: Number(config.bot_port) || 3000,
        connectionMode
      });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao carregar configurações', details: err.message });
    }
  });

  // PUT /api/config
  fastify.put('/api/config', async (request, reply) => {
    try {
      const { openwaUrl, apiKey, defaultSessionId, botName, port } = request.body;

      if (openwaUrl !== undefined) await setConfig('openwa_url', openwaUrl);
      if (apiKey !== undefined) await setConfig('api_key', apiKey);
      if (defaultSessionId !== undefined) await setConfig('default_session_id', defaultSessionId);
      if (botName !== undefined) await setConfig('bot_name', botName);
      if (port !== undefined) await setConfig('bot_port', port);

      return reply.send({ success: true, message: 'Configurações atualizadas com sucesso!' });
    } catch (err) {
      return reply.code(500).send({ error: 'Erro ao salvar configurações', details: err.message });
    }
  });
}

module.exports = configRoutes;
