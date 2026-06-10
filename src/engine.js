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
  // Step 1: Validate event
  if (!payload || payload.event !== 'message.received' || !payload.data) {
    console.log(`🔕 [Engine] Evento ignorado: "${payload?.event || 'nenhum'}" (esperado: "message.received")`);
    return { status: 'ignored_event' };
  }

  const msg = payload.data;

  // Step 2: Ignore self-messages
  if (msg.fromMe) {
    console.log(`🔕 [Engine] Mensagem ignorada (fromMe=true)`);
    return { status: 'ignored_from_me' };
  }

  const chatId = msg.from;
  const text = (msg.body || '').trim();
  
  // Step 3: Get session ID
  const db = getDb();
  const defaultSessionId = await getConfig('default_session_id');
  const sessionId = payload.sessionId || defaultSessionId;

  console.log(`📋 [Engine] Processando mensagem:`);
  console.log(`   chatId: ${chatId}`);
  console.log(`   text: "${text}"`);
  console.log(`   payload.sessionId: "${payload.sessionId || 'VAZIO'}"`);
  console.log(`   defaultSessionId (config): "${defaultSessionId || 'VAZIO'}"`);
  console.log(`   sessionId efetivo: "${sessionId || 'NENHUM'}"`);

  if (!sessionId) {
    console.warn('⚠️ [Engine] Nenhuma sessão configurada para responder à mensagem.');
    console.warn('   → Configure "default_session_id" no painel do bot ou envie o sessionId no payload do webhook.');
    return { status: 'no_session_configured' };
  }

  // Step 4: Log incoming message
  await addMessageLog('incoming', chatId, text);

  let replyText = null;
  let matchedTrigger = null;

  // Step 5: Check commands (enabled = 1)
  const commands = await db.all('SELECT trigger, response, type FROM commands WHERE enabled = 1');
  console.log(`🤖 [Engine] Comandos habilitados: ${commands.length}`);
  
  const matchedCommand = commands.find(c => c.trigger.toLowerCase() === text.toLowerCase());

  if (matchedCommand) {
    console.log(`✅ [Engine] Comando encontrado! Trigger: "${matchedCommand.trigger}" | Type: ${matchedCommand.type}`);
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
  } else {
    console.log(`❌ [Engine] Nenhum comando encontrado para: "${text}"`);
    if (commands.length > 0) {
      console.log(`   Triggers disponíveis: ${commands.map(c => `"${c.trigger}"`).join(', ')}`);
    }
  }

  // Step 6: Check Q&A if no command matched
  if (!replyText) {
    const qnas = await db.all('SELECT question, answer, match_type, priority FROM qna WHERE enabled = 1 ORDER BY priority DESC, id ASC');
    console.log(`💬 [Engine] Regras Q&A habilitadas: ${qnas.length}`);
    
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
          console.error(`❌ Regex inválido no Q&A: "${qna.question}": ${err.message}`);
        }
      }

      if (isMatch) {
        console.log(`✅ [Engine] Q&A match! Pergunta: "${qna.question}" (${qna.match_type})`);
        replyText = qna.answer;
        matchedTrigger = `qna:${qna.question}`;
        break;
      }
    }

    if (!replyText) {
      console.log(`❌ [Engine] Nenhuma regra Q&A encontrada para: "${text}"`);
    }
  }

  // Step 7: Send response if generated
  if (replyText) {
    console.log(`🤖 [Engine] Respondendo a ${chatId} (sessão: ${sessionId}):`);
    console.log(`   Resposta: "${replyText.substring(0, 100)}${replyText.length > 100 ? '...' : ''}"`);
    
    const result = await sendTextMessage(sessionId, chatId, replyText);
    
    if (result.success) {
      console.log(`✅ [Engine] Mensagem enviada com sucesso!`);
      await addMessageLog('outgoing', chatId, replyText, matchedTrigger);
      return { status: 'replied', trigger: matchedTrigger };
    } else {
      console.error(`❌ [Engine] Falha ao enviar: ${result.error}`);
      return { status: 'error_sending', error: result.error };
    }
  }

  console.log(`🔕 [Engine] Nenhuma resposta gerada para: "${text}"`);
  return { status: 'no_match' };
}

module.exports = {
  processIncomingMessage,
  addMessageLog
};
