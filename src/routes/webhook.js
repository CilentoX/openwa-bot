const { processIncomingMessage } = require('../engine');

async function webhookRoutes(fastify, options) {
  fastify.post('/webhook', async (request, reply) => {
    try {
      const payload = request.body;

      // Detailed logging for debugging
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📥 [WEBHOOK] Recebido!');
      console.log(`   Event: ${payload?.event || 'NENHUM'}`);
      console.log(`   SessionId: ${payload?.sessionId || 'NENHUM'}`);
      if (payload?.data) {
        console.log(`   From: ${payload.data.from || 'N/A'}`);
        console.log(`   Body: "${(payload.data.body || '').substring(0, 100)}"`);
        console.log(`   FromMe: ${payload.data.fromMe}`);
        console.log(`   Type: ${payload.data.type || 'N/A'}`);
      } else {
        console.log('   Data: NENHUM (payload.data está vazio!)');
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (!payload || !payload.event) {
        console.log('⚠️ [WEBHOOK] Payload inválido - sem campo "event"');
        return reply.code(400).send({ error: 'Payload inválido' });
      }

      const result = await processIncomingMessage(payload);
      console.log(`🔄 [WEBHOOK] Resultado do processamento: ${JSON.stringify(result)}`);
      return reply.send(result);
    } catch (err) {
      console.error(`❌ [WEBHOOK] Erro fatal: ${err.message}`);
      console.error(err.stack);
      return reply.code(500).send({ error: 'Internal Server Error', message: err.message });
    }
  });
}

module.exports = webhookRoutes;
