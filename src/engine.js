const { getDb } = require('./database');
const { getConfig } = require('./config-manager');
const { sendTextMessage } = require('./openwa-client');

/** Log message in SQLite and update stats */
async function addMessageLog(direction, chatId, body, command = null) {
  try {
    const db = getDb();
    await db.run(
      'INSERT INTO message_logs (direction, chat_id, body, timestamp, command) VALUES (?, ?, ?, ?, ?)',
      [direction, chatId, body, Date.now(), command]
    );
    if (direction === 'incoming') {
      await db.run('UPDATE stats SET value = value + 1 WHERE key = "received"');
    } else if (direction === 'outgoing') {
      await db.run('UPDATE stats SET value = value + 1 WHERE key = "sent"');
    }
  } catch (err) {
    console.error(`❌ Erro ao salvar log de mensagem: ${err.message}`);
  }
}

/** Process incoming webhook messages */
async function processIncomingMessage(payload) {
  if (!payload || payload.event !== 'message.received' || !payload.data) {
    return { status: 'ignored_event' };
  }

  const msg = payload.data;

  // Ignore messages sent by ourselves to prevent loops
  if (msg.fromMe) {
    return { status: 'ignored_from_me' };
  }

  const chatId = msg.from;
  const text = (msg.body || '').trim();
  
  const db = getDb();
  const defaultSessionId = await getConfig('default_session_id');
  const sessionId = payload.sessionId || defaultSessionId;

  if (!sessionId) {
    console.warn('⚠️ Nenhuma sessão configurada para responder à mensagem.');
    return { status: 'no_session_configured' };
  }

  console.log(`💬 Mensagem de ${chatId} na sessão ${sessionId}: "${text}"`);

  // 1. Log incoming message
  await addMessageLog('incoming', chatId, text);

  let replyText = null;
  let matchedTrigger = null;

  // 2. Check commands (enabled = 1)
  const commands = await db.all('SELECT trigger, response, type FROM commands WHERE enabled = 1');
  const matchedCommand = commands.find(c => c.trigger.toLowerCase() === text.toLowerCase());

  if (matchedCommand) {
    matchedTrigger = matchedCommand.trigger;
    if (matchedCommand.type === 'dynamic') {
      if (matchedCommand.trigger === '!hora') {
        replyText = `🕒 Hora do Servidor: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (BRT)`;
      } else {
        replyText = matchedCommand.response;
      }
    } else {
      replyText = matchedCommand.response;
    }
  }

  // 3. Check Q&A if no command matched (enabled = 1, ordered by priority DESC)
  if (!replyText) {
    const qnas = await db.all('SELECT question, answer, match_type, priority FROM qna WHERE enabled = 1 ORDER BY priority DESC, id ASC');
    
    for (const qna of qnas) {
      let isMatch = false;
      const questionPattern = qna.question.trim().toLowerCase();
      const textToCompare = text.toLowerCase();

      if (qna.match_type === 'exact') {
        isMatch = (textToCompare === questionPattern);
      } else if (qna.match_type === 'contains') {
        isMatch = textToCompare.includes(questionPattern);
      } else if (qna.match_type === 'regex') {
        try {
          const regex = new RegExp(qna.question, 'i');
          isMatch = regex.test(text);
        } catch (err) {
          console.error(`❌ Regex inválido no Q&A ID: ${qna.id}: ${err.message}`);
        }
      }

      if (isMatch) {
        replyText = qna.answer;
        matchedTrigger = `qna:${qna.question}`;
        break; // Match found, stop evaluating lower priority Q&A
      }
    }
  }

  // 4. Send response if generated
  if (replyText) {
    console.log(`🤖 Respondendo a ${chatId} com: "${replyText}"`);
    const result = await sendTextMessage(sessionId, chatId, replyText);
    if (result.success) {
      await addMessageLog('outgoing', chatId, replyText, matchedTrigger);
      return { status: 'replied', trigger: matchedTrigger };
    } else {
      return { status: 'error_sending', error: result.error };
    }
  }

  return { status: 'no_match' };
}

module.exports = {
  processIncomingMessage,
  addMessageLog
};
