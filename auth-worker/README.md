# Login do Gravitas Hub (Cloudflare Worker + Google)

Um Worker da Cloudflare fica na frente de `nucleogravitas.com.br/hub*`. Quem não está logado vê a tela
"Entrar com Google"; só e-mails da lista de alunos entram. O resto do site (a landing) passa direto.

Por que Worker e não Cloudflare Access: o Access é grátis só até 50 usuários e depois cobra por pessoa.
O Worker não cobra por aluno (plano gratuito: 100 mil requisições/dia).

Por que não dá para fazer só no navegador: o hub é um site estático e o `data.js` é público. A proteção
precisa rodar no servidor (aqui, na borda da Cloudflare) antes de entregar qualquer arquivo de `/hub`.

## Pré-requisito: o domínio precisa estar na Cloudflare

Hoje o DNS de `nucleogravitas.com.br` está na Vercel (`ns1.vercel-dns.com`). Para a Cloudflare ficar na frente,
o domínio inteiro passa a usar os nameservers da Cloudflare. Isso afeta o site todo, então antes de trocar:

1. Anote **todos** os registros atuais em Vercel > Domains > nucleogravitas.com.br > DNS Records
   (principalmente MX e TXT de e-mail, SPF/DKIM, verificações). A Cloudflare não consegue ler a zona da Vercel.
2. Crie a conta na Cloudflare, adicione o domínio (plano Free) e recrie esses registros.
   Os registros do site (A/CNAME para a Vercel) ficam com a nuvem **laranja** (proxied).
3. Em SSL/TLS, use **Full (strict)**.
4. Troque os nameservers no registrador para os que a Cloudflare indicar e espere propagar.

## 1. Google (OAuth)

Google Cloud Console > APIs e serviços:
1. Tela de consentimento OAuth: tipo **Externo**, nome "Gravitas Hub", e-mail de suporte. Publique o app
   (status "Em produção"); o escopo usado é só `openid email profile`.
2. Credenciais > Criar ID do cliente OAuth > **Aplicativo da Web**.
   URIs de redirecionamento autorizados:
   - `https://www.nucleogravitas.com.br/hub/auth/callback`
   - `https://nucleogravitas.com.br/hub/auth/callback`
3. Guarde o **Client ID** e o **Client Secret**.

## 2. Publicar o Worker

```bash
cd auth-worker
npx wrangler login
npx wrangler kv namespace create ALLOW        # copie o id e cole em wrangler.toml (kv_namespaces)
```

Em `wrangler.toml`, preencha `GOOGLE_CLIENT_ID` e `ADMIN_EMAILS` (seu e-mail, para você sempre entrar). Depois:

```bash
npx wrangler secret put GOOGLE_CLIENT_SECRET   # cole o Client Secret
npx wrangler secret put SESSION_SECRET         # cole uma string aleatória longa (ex.: openssl rand -base64 48)
npx wrangler deploy
```

## 3. Link de convite (o jeito principal de liberar alunos)

Um link só, para colocar no grupo do WhatsApp. Quem abre faz login com o Google **uma vez** e fica cadastrado;
depois entra direto em `/hub` com um clique, sem precisar do link de novo.

```bash
node scripts/convite.mjs              # padrão: vale 14 dias, até 600 cadastros (ex.: node scripts/convite.mjs 7 300)
npx wrangler kv bulk put convite.bulk.json --binding ALLOW --remote
```

O script mostra o link (`https://www.nucleogravitas.com.br/hub/entrar?convite=...`) e o comando para cancelá-lo.

- **Trocar o link** (vazou, turma nova, prazo acabou): gere outro e apague o antigo com o comando que o script mostrou.
  Quem já se cadastrou continua entrando normalmente; o link antigo para de cadastrar gente nova.
- Depois do prazo o convite some sozinho do KV. Quem abrir um link vencido vê "Este convite expirou".
- Quem já é cadastrado e abre o convite de novo não gasta vaga.
- O código tem 24 caracteres aleatórios; não dá para adivinhar. Mesmo assim, trate o link como interno do grupo.
- O limite é aproximado (o KV não tem contador atômico): com muita gente entrando no mesmo segundo pode passar por poucos.

**Quem entrou e quando:**

```bash
npx wrangler kv key list --binding ALLOW --remote > membros.json
node scripts/membros.mjs membros.json       # gera membros.csv (e-mail, origem, data de entrada)
```

## 4. Lista de alunos (opcional, para liberar sem convite)

Exporte os e-mails dos alunos (CSV ou TXT, qualquer formato em que o e-mail apareça):

```bash
node scripts/allowlist.mjs alunos.csv           # gera allowlist.bulk.json
npx wrangler kv bulk put allowlist.bulk.json --binding ALLOW --remote
```

- Gmail com ponto ou `+etiqueta` é tratado como a mesma conta (`joao.silva+x@gmail.com` = `joaosilva@gmail.com`).
- Adicionar um aluno: `npx wrangler kv key put "email@dominio.com" 1 --binding ALLOW --remote`
- Remover: `npx wrangler kv key delete "email@dominio.com" --binding ALLOW --remote`
  (o aluno perde o acesso no próximo carregamento da página).
- Os arquivos `*.csv`, `allowlist*.json`, `convite*.json` e `membros*.json` estão no `.gitignore`.
  Nunca suba dados de alunos para o GitHub.

## 5. Fechar o endereço da Vercel

O hub também existe em `*.vercel.app`, fora do Worker. Em Vercel > Project > Settings > Deployment Protection,
ative **Vercel Authentication** (Standard Protection). Os domínios `*.vercel.app` passam a exigir login da Vercel
e o domínio próprio continua público para a Cloudflare buscar.

## 6. Ofertas enviadas pelos alunos

O aluno envia pelo botão "Enviar oferta" no Banco de Ofertas. A oferta fica pendente num banco D1 (grátis na
Cloudflare) e só aparece para todos depois que um e-mail de `ADMIN_EMAILS` aprova na tela "Aprovar ofertas" do Hub.
Recusar apaga. Limite de 5 envios por aluno por dia. O nome e o e-mail de quem enviou nunca aparecem na oferta aprovada.

Primeira instalação:

```bash
npx wrangler d1 create gravitas-hub-ofertas      # cole o id em wrangler.toml e descomente o bloco d1_databases
npx wrangler d1 execute gravitas-hub-ofertas --remote --file schema.sql
npx wrangler deploy
```

## Como o login funciona

- `/hub/entrar`: tela de login. `/hub/login`: vai ao Google (código de autorização + PKCE + `state`).
- `/hub/auth/callback`: troca o código, confere `iss`, `aud`, `exp` e `email_verified`, e consulta a lista.
- Sessão: cookie assinado (HMAC-SHA256), `HttpOnly`, `Secure`, `SameSite=Lax`, validade de 7 dias.
- A lista é conferida de novo a cada carregamento de página, então remover um aluno vale já na próxima visita.
- Sem configuração completa o Worker responde 503 (acesso fechado, não aberto).
- `/hub/me` devolve nome e e-mail para o menu; `/hub/sair` encerra a sessão.

## Testes

```bash
npm test    # 23 testes: fluxo completo, convite (válido, vencido, lotado, forjado), cookie forjado, open redirect...
```
