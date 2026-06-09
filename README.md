# 🤖 OpenWA Bot Console & Dashboard

Bot de teste e dashboard web para a **API Gateway do OpenWA**. Utiliza **Fastify** como servidor HTTP e **SQLite** para persistência local.

---

## 🏗️ Arquitetura (Coolify + Traefik)

```
Internet → Traefik → openwa-bot (porta 3000, rede coolify)
                         ↓
                    openwa-api (porta 2785, rede openwa-internal)
```

O bot conecta **diretamente** na API do OpenWA via rede Docker interna (`openwa-internal`), sem passar pelo proxy nginx do dashboard. Isso elimina problemas de 401 causados por headers não encaminhados.

---

## ⚙️ Configuração

### Variáveis de Ambiente (Docker/Coolify)

| Variável | Descrição | Default |
|---|---|---|
| `OPENWA_API_URL` | URL direta da API (rede interna Docker) | `http://openwa-api:2785/api` |
| `OPENWA_API_KEY` | Chave de autenticação da API | _(vazio)_ |
| `DATABASE_PATH` | Caminho do banco SQLite | `/usr/src/app/data/bot.db` |

### Como obter a API Key

1. Acesse o dashboard do OpenWA em `https://openwa.qwertyatlas.online`
2. Faça login com a chave padrão (exibida nos logs do container `openwa-api` na primeira execução)
3. Vá em **API Keys** e copie a chave
4. No Coolify, adicione a variável `OPENWA_API_KEY` com o valor da chave no serviço do bot

### Configuração via Dashboard do Bot

Acesse `https://openwa-bot.qwertyatlas.online` e na aba **Configurações** você pode ajustar:
- URL da API
- Chave de autenticação
- Sessão padrão
- Nome do bot

> **Nota:** Variáveis de ambiente têm prioridade sobre configurações do SQLite.

---

## 🚀 Deploy (Coolify)

O `docker-compose.yml` já está configurado para Coolify com Traefik:
- Domínio: `openwa-bot.qwertyatlas.online`
- SSL automático via Let's Encrypt
- Rede `coolify` (Traefik) + `openwa-internal` (API direta)

### Variáveis obrigatórias no Coolify:
```
OPENWA_API_KEY=owa_k1_... (sua chave API)
```

---

## 🛠️ Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Iniciar o servidor
npm start
```

O bot roda em `http://localhost:3000`.

---

## 📋 Rotas HTTP

| Rota | Método | Descrição |
|---|---|---|
| `POST /webhook` | POST | Receptor de eventos do OpenWA |
| `GET /api/config` | GET | Retorna configurações |
| `PUT /api/config` | PUT | Atualiza configurações |
| `GET /api/sessions` | GET | Lista sessões (proxy → API) |
| `GET /api/sessions/:id` | GET | Detalhes da sessão |
| `GET /api/sessions/:id/groups` | GET | Grupos da sessão |
| `POST /api/sessions/:id/webhooks` | POST | Registra webhook |
| `POST /api/sessions/:id/messages/send` | POST | Envia mensagem |
| `GET /api/messages` | GET | Log de mensagens locais |
| `GET /api/commands` | GET | Lista comandos do bot |
| `GET /api/qna` | GET | Lista regras Q&A |
| `GET /api/stats` | GET | Estatísticas do bot |

---

## 📁 Estrutura

```
test-bot/
├── bot.js                    # Entry point
├── docker-compose.yml        # Config para Coolify
├── Dockerfile                # Build do container
├── public/                   # Dashboard frontend
│   ├── index.html
│   ├── app.js
│   └── style.css
└── src/
    ├── config-manager.js     # Leitura/escrita SQLite config
    ├── database.js           # Inicialização do banco
    ├── engine.js             # Motor de processamento de mensagens
    ├── openwa-client.js      # Cliente HTTP para API OpenWA
    └── routes/
        ├── commands.js       # CRUD de comandos
        ├── config.js         # CRUD de configurações
        ├── messages.js       # Log de mensagens
        ├── proxy.js          # Proxy para todas as rotas da API
        ├── qna.js            # CRUD de regras Q&A
        └── webhook.js        # Receptor de webhooks
```
