const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const fs = require('fs');

let dbInstance = null;

async function initDb() {
  if (dbInstance) return dbInstance;

  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'bot.db');
  
  // Ensure the target directory exists if a custom path is used
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // 1. Config Table
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // 2. Commands Table
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger TEXT UNIQUE,
      response TEXT,
      description TEXT,
      type TEXT DEFAULT 'static',
      enabled INTEGER DEFAULT 1,
      created_at INTEGER
    )
  `);

  // 3. Q&A Table
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS qna (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT,
      answer TEXT,
      match_type TEXT CHECK(match_type IN ('exact', 'contains', 'regex')),
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at INTEGER
    )
  `);

  // 4. Message Logs Table
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT,
      chat_id TEXT,
      body TEXT,
      timestamp INTEGER,
      command TEXT
    )
  `);

  // 5. Stats Table
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value INTEGER
    )
  `);

  // Seed default stats
  await dbInstance.run('INSERT OR IGNORE INTO stats (key, value) VALUES ("received", 0)');
  await dbInstance.run('INSERT OR IGNORE INTO stats (key, value) VALUES ("sent", 0)');

  // Seed Config from config.js if it exists, otherwise use defaults
  const configJsPath = path.join(__dirname, '..', 'config.js');
  let defaultConfigs = {
    openwa_url: 'https://openwa.qwertyatlas.online',
    api_key: '',
    default_session_id: '',
    bot_name: 'OpenWA Bot',
    bot_port: '3000'
  };

  if (fs.existsSync(configJsPath)) {
    try {
      const oldConfig = require(configJsPath);
      if (oldConfig.openwaUrl) defaultConfigs.openwa_url = oldConfig.openwaUrl;
      if (oldConfig.apiKey) defaultConfigs.api_key = oldConfig.apiKey;
      if (oldConfig.defaultSessionId) defaultConfigs.default_session_id = oldConfig.defaultSessionId;
      if (oldConfig.port) defaultConfigs.bot_port = String(oldConfig.port);
    } catch (e) {
      console.warn('⚠️ Erro ao ler config.js legado para semente:', e.message);
    }
  }

  for (const [key, value] of Object.entries(defaultConfigs)) {
    await dbInstance.run('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)', [key, value]);
  }

  // Seed default commands
  const defaultCommands = [
    {
      trigger: '!ping',
      response: 'pong! 🏓',
      description: 'Teste de latência e resposta do bot',
      type: 'static'
    },
    {
      trigger: '!help',
      response: 'Olá! Sou o OpenWA Test Bot. Aqui estão os comandos disponíveis:\n\n' +
                '📌 *!menu* - Exibe o menu principal\n' +
                '📌 *!ping* - Teste de latência\n' +
                '📌 *!hora* - Exibe a hora do servidor\n' +
                '📌 *!docs* - Link para a documentação da API',
      description: 'Menu de ajuda com a lista de comandos',
      type: 'static'
    },
    {
      trigger: '!docs',
      response: '📚 Acesse a documentação completa da API em:\nhttps://openwa.qwertyatlas.online/api/docs',
      description: 'Link direto para documentação oficial',
      type: 'static'
    },
    {
      trigger: '!menu',
      response: '📋 *MENU PRINCIPAL*\n\n' +
               '1️⃣ Informações da Conta\n' +
               '2️⃣ Testar Envio de Mídia\n' +
               '3️⃣ Status do Servidor\n\n' +
               'Envie *!help* para ver a lista de comandos de texto.',
      description: 'Menu principal numérico',
      type: 'static'
    },
    {
      trigger: '1',
      response: '👤 *Informações da Conta*:\nEste bot está integrado usando a API Gateway do OpenWA.',
      description: 'Opção 1 do menu',
      type: 'static'
    },
    {
      trigger: '2',
      response: '📷 Para testar o envio de mídias, utilize os endpoints de imagem, áudio ou figurinhas na documentação!',
      description: 'Opção 2 do menu',
      type: 'static'
    },
    {
      trigger: '3',
      response: '⚡ *Status*: Servidor do bot online e ativo.',
      description: 'Opção 3 do menu',
      type: 'static'
    },
    {
      trigger: '!hora',
      response: '',
      description: 'Exibe a hora atual do servidor (dinâmico)',
      type: 'dynamic'
    }
  ];

  const now = Date.now();
  for (const cmd of defaultCommands) {
    await dbInstance.run(
      'INSERT OR IGNORE INTO commands (trigger, response, description, type, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      [cmd.trigger, cmd.response, cmd.description, cmd.type, now]
    );
  }

  // Seed initial Q&A (just one example to make it easy)
  const defaultQnas = [
    {
      question: 'bom dia',
      answer: 'Bom dia! Tudo bem? Como posso te ajudar hoje? ☀️',
      match_type: 'contains',
      priority: 1
    },
    {
      question: 'boa tarde',
      answer: 'Boa tarde! Como posso ajudar você hoje? ☕',
      match_type: 'contains',
      priority: 1
    },
    {
      question: 'boa noite',
      answer: 'Boa noite! Espero que esteja tendo um ótimo dia. 🌙',
      match_type: 'contains',
      priority: 1
    }
  ];

  for (const qna of defaultQnas) {
    const existing = await dbInstance.get('SELECT id FROM qna WHERE question = ?', [qna.question]);
    if (!existing) {
      await dbInstance.run(
        'INSERT INTO qna (question, answer, match_type, enabled, priority, created_at) VALUES (?, ?, ?, 1, ?, ?)',
        [qna.question, qna.answer, qna.match_type, qna.priority, now]
      );
    }
  }

  console.log('💾 Banco de dados SQLite inicializado e populado (bot.db).');
  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

module.exports = {
  initDb,
  getDb
};
