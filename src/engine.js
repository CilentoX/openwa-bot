const { getDb } = require('./database');
const { getConfig } = require('./config-manager');
const { sendTextMessage, sendImageMessage } = require('./openwa-client');
const messageEmitter = require('./events');

/** Log message in SQLite and update stats */
async function addMessageLog(direction, chatId, body, command = null, messageId = null) {
  try {
    const db = getDb();
    const timestamp = Date.now();
    const result = await db.run(
      'INSERT INTO message_logs (direction, chat_id, body, timestamp, command, message_id) VALUES (?, ?, ?, ?, ?, ?)',
      [direction, chatId, body, timestamp, command, messageId]
    );
    const localId = result.lastID;

    if (direction === 'incoming') {
      await db.run('UPDATE stats SET value = value + 1 WHERE key = "received"');
    } else if (direction === 'outgoing') {
      await db.run('UPDATE stats SET value = value + 1 WHERE key = "sent"');
    }
    
    // Emit the message in real-time
    messageEmitter.emit('message', {
      id: localId,
      message_id: messageId,
      direction,
      from: chatId,
      body,
      timestamp,
      command
    });

    return localId;
  } catch (err) {
    console.error(`❌ Erro ao salvar log de mensagem: ${err.message}`);
    return null;
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
  await addMessageLog('incoming', chatId, text, null, msg.id);

  let replyText = null;
  let replyImage = null;
  let matchedTrigger = null;
  const nowTime = Date.now();

  // Step 5: Check if customer is in an active menu state
  const customerState = await db.get('SELECT current_menu_id FROM customer_states WHERE chat_id = ?', [chatId]);
  
  if (customerState && customerState.current_menu_id) {
    console.log(`🌳 [Engine] Cliente ${chatId} está no estado de menu: ${customerState.current_menu_id}`);
    const currentMenu = await db.get('SELECT * FROM bot_menus WHERE id = ? AND enabled = 1', [customerState.current_menu_id]);
    
    if (!currentMenu) {
      // Clean up orphaned state
      await db.run('DELETE FROM customer_states WHERE chat_id = ?', [chatId]);
    } else {
      // 5a. Check if they want to go back (0 or voltar)
      if (text === '0' || text.toLowerCase() === 'voltar') {
        if (!currentMenu.parent_id) {
          // Exit root menu
          await db.run('DELETE FROM customer_states WHERE chat_id = ?', [chatId]);
          replyText = 'Você saiu do menu de atendimento. Digite !menu a qualquer momento para iniciar.';
          matchedTrigger = 'menu_exit';
        } else {
          // Go to parent menu
          const parentMenu = await db.get('SELECT * FROM bot_menus WHERE id = ? AND enabled = 1', [currentMenu.parent_id]);
          if (parentMenu) {
            await db.run('INSERT OR REPLACE INTO customer_states (chat_id, current_menu_id, updated_at) VALUES (?, ?, ?)', [chatId, parentMenu.id, nowTime]);
            replyText = parentMenu.message_text;
            replyImage = parentMenu.image_url;
            matchedTrigger = `menu_back:${parentMenu.name}`;
          } else {
            await db.run('DELETE FROM customer_states WHERE chat_id = ?', [chatId]);
            replyText = 'Você saiu do menu de atendimento.';
            matchedTrigger = 'menu_exit';
          }
        }
      } else {
        // 5b. Fetch children options
        const childMenus = await db.all('SELECT * FROM bot_menus WHERE parent_id = ? AND enabled = 1', [currentMenu.id]);
        const matchedChild = childMenus.find(m => m.trigger_option.toLowerCase() === text.toLowerCase());
        
        if (matchedChild) {
          if (matchedChild.is_leaf === 1) {
            // Leaf node: send message and reset state
            await db.run('DELETE FROM customer_states WHERE chat_id = ?', [chatId]);
          } else {
            // Transition to child state
            await db.run('INSERT OR REPLACE INTO customer_states (chat_id, current_menu_id, updated_at) VALUES (?, ?, ?)', [chatId, matchedChild.id, nowTime]);
          }
          replyText = matchedChild.message_text;
          replyImage = matchedChild.image_url;
          matchedTrigger = `menu:${matchedChild.name}`;
        } else {
          // 5c. Not a menu option, check if it's a global override command (starting with !)
          const isGlobalCommand = text.startsWith('!');
          let ranGlobal = false;
          
          if (isGlobalCommand) {
            const commands = await db.all('SELECT trigger, response, image_url, type FROM commands WHERE enabled = 1');
            const matchedCommand = commands.find(c => c.trigger.toLowerCase() === text.toLowerCase());
            
            if (matchedCommand) {
              // Clear state and run command
              await db.run('DELETE FROM customer_states WHERE chat_id = ?', [chatId]);
              matchedTrigger = matchedCommand.trigger;
              if (matchedCommand.type === 'dynamic' && matchedCommand.trigger === '!hora') {
                replyText = `🕒 Hora do Servidor: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (BRT)`;
              } else {
                replyText = matchedCommand.response;
                replyImage = matchedCommand.image_url;
              }
              ranGlobal = true;
            }
          }
          
          if (!ranGlobal) {
            // Stay in same menu, show invalid option warning and repeat options
            replyText = `⚠️ *Opção Inválida.*\n\n${currentMenu.message_text}`;
            replyImage = currentMenu.image_url;
            matchedTrigger = 'menu_invalid_option';
          }
        }
      }
    }
  }

  // Step 6: If not handled by active menu, check global commands (enabled = 1)
  if (!replyText) {
    const commands = await db.all('SELECT trigger, response, image_url, type FROM commands WHERE enabled = 1');
    const matchedCommand = commands.find(c => c.trigger.toLowerCase() === text.toLowerCase());

    if (matchedCommand) {
      console.log(`✅ [Engine] Comando encontrado! Trigger: "${matchedCommand.trigger}" | Type: ${matchedCommand.type}`);
      matchedTrigger = matchedCommand.trigger;
      if (matchedCommand.type === 'dynamic' && matchedCommand.trigger === '!hora') {
        replyText = `🕒 Hora do Servidor: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (BRT)`;
      } else {
        replyText = matchedCommand.response;
        replyImage = matchedCommand.image_url;
      }
    }
  }

  // Step 7: Check root menus triggers (trigger_option when parent_id IS NULL)
  if (!replyText) {
    const rootMenus = await db.all('SELECT * FROM bot_menus WHERE parent_id IS NULL AND enabled = 1');
    const matchedRoot = rootMenus.find(m => m.trigger_option.toLowerCase() === text.toLowerCase());
    
    if (matchedRoot) {
      console.log(`🌳 [Engine] Entrando no menu raiz: ${matchedRoot.name}`);
      await db.run('INSERT OR REPLACE INTO customer_states (chat_id, current_menu_id, updated_at) VALUES (?, ?, ?)', [chatId, matchedRoot.id, nowTime]);
      replyText = matchedRoot.message_text;
      replyImage = matchedRoot.image_url;
      matchedTrigger = `menu_root:${matchedRoot.name}`;
    }
  }

  // Step 8: Check Q&A rules if no command/menu matched
  if (!replyText) {
    const qnas = await db.all('SELECT question, answer, image_url, match_type, priority FROM qna WHERE enabled = 1 ORDER BY priority DESC, id ASC');
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
        replyImage = qna.image_url;
        matchedTrigger = `qna:${qna.question}`;
        break;
      }
    }

    if (!replyText) {
      console.log(`❌ [Engine] Nenhuma regra Q&A encontrada para: "${text}"`);
    }
  }

  // Step 7: Send response if generated
  if (replyText || replyImage) {
    console.log(`🤖 [Engine] Respondendo a ${chatId} (sessão: ${sessionId}):`);
    if (replyText) console.log(`   Texto: "${replyText.substring(0, 100)}${replyText.length > 100 ? '...' : ''}"`);
    if (replyImage) console.log(`   Imagem: "${replyImage}"`);
    
    let result;
    if (replyImage) {
      // Send image with caption (if any)
      result = await sendImageMessage(sessionId, chatId, replyImage, replyText);
    } else {
      // Send text only
      result = await sendTextMessage(sessionId, chatId, replyText);
    }
    
    if (result.success) {
      console.log(`✅ [Engine] Mensagem enviada com sucesso!`);
      const messageId = result.data?.id || result.data?.response?.id;

      let logImage = replyImage;
      if (replyImage && replyImage.startsWith('data:')) {
        logImage = replyImage.substring(0, 50) + '... [Base64]';
      }

      const logBody = replyImage ? `[IMAGEM: ${logImage}] ${replyText || ''}` : replyText;
      await addMessageLog('outgoing', chatId, logBody, matchedTrigger, messageId);
      return { status: 'replied', trigger: matchedTrigger };
    }
 else {
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
