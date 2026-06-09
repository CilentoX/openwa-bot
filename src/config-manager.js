const { getDb } = require('./database');

async function getConfig(key) {
  const db = getDb();
  const row = await db.get('SELECT value FROM config WHERE key = ?', [key]);
  return row ? row.value : null;
}

async function setConfig(key, value) {
  const db = getDb();
  await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, String(value)]);
}

async function getAllConfig() {
  const db = getDb();
  const rows = await db.all('SELECT key, value FROM config');
  const configObj = {};
  for (const row of rows) {
    configObj[row.key] = row.value;
  }
  return configObj;
}

module.exports = {
  getConfig,
  setConfig,
  getAllConfig
};
