/**
 * OpenWA Fastify Bot & Dashboard Server
 * Entry point. Initializes the SQLite database and registers modular routes.
 */

const path = require('path');
const fastify = require('fastify')({ logger: true });
const fastifyStatic = require('@fastify/static');
const fastifyCors = require('@fastify/cors');

const { initDb } = require('./src/database');
const { getConfig } = require('./src/config-manager');

// CORS Configuration
fastify.register(fastifyCors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
});

// Serve Static Dashboard Frontend
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// Start Server & Register Routes
const start = async () => {
  try {
    // 1. Initialize SQLite database and tables
    await initDb();

    // 2. Register modular routes
    await fastify.register(require('./src/routes/webhook'));
    await fastify.register(require('./src/routes/config'));
    await fastify.register(require('./src/routes/commands'));
    await fastify.register(require('./src/routes/qna'));
    await fastify.register(require('./src/routes/messages'));
    await fastify.register(require('./src/routes/menus'));
    await fastify.register(require('./src/routes/proxy'));

    // 3. Retrieve server port from DB config
    const portValue = await getConfig('bot_port');
    const port = Number(portValue) || 3000;

    // 4. Start HTTP Server
    await fastify.listen({ port, host: '0.0.0.0' });

    // 5. Auto-register webhook for default session if configured
    const defaultSession = await getConfig('default_session_id');
    if (defaultSession) {
      const { ensureWebhookRegistered } = require('./src/openwa-client');
      console.log(`📡 [Webhook] Verificando webhook automático para a sessão padrão: ${defaultSession}`);
      ensureWebhookRegistered(defaultSession).catch(() => {});
    }

    // 6. Display startup info
    const apiUrl = process.env.OPENWA_API_URL || await getConfig('openwa_url') || 'NOT SET';
    const hasKey = !!(process.env.OPENWA_API_KEY || await getConfig('api_key'));
    const connMode = process.env.OPENWA_API_URL ? 'ENV (Variável de Ambiente)' : 'CONFIG (SQLite)';

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🟢 OpenWA Bot & Dashboard rodando em http://localhost:${port}`);
    console.log(`📡 API OpenWA: ${apiUrl}`);
    console.log(`🔗 Modo de conexão: ${connMode}`);
    console.log(`🔑 API Key: ${hasKey ? 'Configurada ✓' : '⚠️  NÃO CONFIGURADA'}`);
    console.log(`💾 Persistência local: SQLite (bot.db)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

