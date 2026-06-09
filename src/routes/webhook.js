const { processIncomingMessage } = require('../engine');

async function webhookRoutes(fastify, options) {
  fastify.post('/webhook', async (request, reply) => {
    try {
      const payload = request.body;
      if (!payload || !payload.event) {
        return reply.code(400).send({ error: 'Payload inválido' });
      }

      fastify.log.info(`📥 Webhook recebido: "${payload.event}"`);
      const result = await processIncomingMessage(payload);
      return reply.send(result);
    } catch (err) {
      fastify.log.error(`❌ Webhook error: ${err.message}`);
      return reply.code(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });
}

module.exports = webhookRoutes;
