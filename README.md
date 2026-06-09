# 🤖 OpenWA Bot Console & Dashboard (JS Config & Multi-Session)

Este projeto é um cliente de teste completo para interagir com a **API Gateway do OpenWA**. Ele utiliza o framework **Fastify** para expor rotas modulares da API e serve uma dashboard web premium para gerenciamento de múltiplas sessões, monitoramento de grupos de WhatsApp e testes de envio.

---

## ⚙️ Configuração via Arquivo JS

Toda a configuração de credenciais e conexão é feita exclusivamente por meio do arquivo [config.js](file:///c:/Users/lucas/OneDrive/%C3%81rea%20de%20Trabalho/openwa/OpenWA/test-bot/config.js). 

Abra o arquivo e configure suas credenciais usando valores puros em JavaScript:
```javascript
module.exports = {
  // Porta onde o servidor Fastify do bot irá rodar localmente
  port: 3000,

  // URL base da sua instância do OpenWA (será adicionado /api automaticamente se necessário)
  openwaUrl: 'https://openwa.qwertyatlas.online',

  // Chave API master de produção
  apiKey: 'owa_k1_77c8743ee86bce30cc120adda74ade9dc84ac66af407cd94316aafeac83790ae',

  // ID da sessão padrão para fallback inicial
  defaultSessionId: 'ab22b8ca-51d'
};
```

*Nota: Não é utilizada nenhuma variável de ambiente (`process.env`) neste arquivo, garantindo que suas configurações estejam centralizadas e estáticas no código do bot.*

---

## 🛠️ Passo a Passo de Execução

### Passo 1: Iniciar o Bot
Abra seu terminal na pasta `test-bot` e execute o comando:
```bash
npm start
```
O console deverá indicar a inicialização com sucesso:
```text
🟢 OpenWA Bot & Dashboard rodando em http://localhost:3000
📡 URL API OpenWA: https://openwa.qwertyatlas.online
🔑 Modo de Configuração: ARQUIVO (config.js)
```

---

### Passo 2: Expor com Ngrok CLI
Como a sua instância do OpenWA precisa se comunicar com o bot local, abra um prompt de comando (CMD) no Windows e ative o ngrok:
```bash
ngrok http 3000
```
Copie a URL segura gerada (ex: `https://a1b2-34-56-78.ngrok-free.app`).

---

### Passo 3: Interagir na Dashboard
Acesse **[http://localhost:3000](http://localhost:3000)** no seu navegador.

#### 🔗 Seleção de Sessão Ativa
No topo superior direito, selecione qual sessão você deseja gerenciar. A dashboard se conecta dinamicamente ao OpenWA e lista todas as sessões registradas no seu gateway.

#### 👥 Grupos da Sessão
No painel esquerdo, você poderá ver a lista completa de todos os grupos do WhatsApp dos quais a sessão selecionada participa.
- Use a barra de pesquisa **"🔍 Filtrar grupos..."** para buscar grupos pelo nome ou JID.
- **Clique em um grupo** para preencher automaticamente o formulário de envio de mensagens com o JID correto do grupo (`@g.us`).

#### 🔗 Registrar Webhook
No painel direito, insira a URL pública que você copiou do Ngrok adicionando `/webhook` no final (ex: `https://xxxx.ngrok-free.app/webhook`) e clique em **Registrar Webhook** para integrá-lo com a sessão ativa selecionada.

#### 📤 Enviar Mensagens de Teste
Preencha a mensagem e o JID do destinatário (ou utilize o autopreenchimento clicando em um grupo na lista lateral) para disparar testes de envio usando a sessão ativa.

---

## 🌐 Rotas HTTP Utilizadas (Fastify)

Para garantir máxima granularidade e modularidade, o servidor Fastify expõe as seguintes rotas:

| Rota | Método | Descrição |
| --- | --- | --- |
| `POST /webhook` | `POST` | Receptor dos eventos do OpenWA (dispara respostas automáticas como `!ping`, `!help`). |
| `GET /api/config` | `GET` | Retorna os parâmetros gerais configurados no `config.js` (excluindo a API Key por segurança). |
| `GET /api/sessions` | `GET` | Proxy para listar todas as sessões disponíveis no OpenWA. |
| `GET /api/sessions/:id` | `GET` | Proxy para recuperar os detalhes de conectividade de uma sessão específica. |
| `GET /api/sessions/:id/groups` | `GET` | Proxy para buscar todos os grupos vinculados a uma sessão. |
| `POST /api/sessions/:id/webhooks` | `POST` | Registra a URL do webhook do bot para a sessão especificada. |
| `POST /api/sessions/:id/messages/send` | `POST` | Dispara o envio de mensagens usando a sessão especificada. |
| `GET /api/messages` | `GET` | Retorna o feed em memória das últimas mensagens recebidas/enviadas. |
| `DELETE /api/messages` | `DELETE` | Limpa o log de mensagens do feed em memória do servidor. |
| `GET /api/stats` | `GET` | Fornece estatísticas de contagem de mensagens do bot. |
