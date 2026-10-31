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

## 3. Lista de alunos

Exporte os e-mails dos alunos (CSV ou TXT, qualquer formato em que o e-mail apareça):

```bash
node scripts/allowlist.mjs alunos.csv           # gera allowlist.bulk.json
npx wrangler kv bulk put allowlist.bulk.json --binding ALLOW --remote
```

- Gmail com ponto ou `+etiqueta` é tratado como a mesma conta (`joao.silva+x@gmail.com` = `joaosilva@gmail.com`).
- Adicionar um aluno: `npx wrangler kv key put "email@dominio.com" 1 --binding ALLOW --remote`
- Remover: `npx wrangler kv key delete "email@dominio.com" --binding ALLOW --remote`
  (o aluno perde o acesso no próximo carregamento da página).
- Os arquivos `*.csv` e `allowlist*.json` estão no `.gitignore`. Nunca suba dados de alunos para o GitHub.

## 4. Fechar o endereço da Vercel

O hub também existe em `*.vercel.app`, fora do Worker. Em Vercel > Project > Settings > Deployment Protection,
ative **Vercel Authentication** (Standard Protection). Os domínios `*.vercel.app` passam a exigir login da Vercel
e o domínio próprio continua público para a Cloudflare buscar.

## Como o login funciona

- `/hub/entrar`: tela de login. `/hub/login`: vai ao Google (código de autorização + PKCE + `state`).
- `/hub/auth/callback`: troca o código, confere `iss`, `aud`, `exp` e `email_verified`, e consulta a lista.
- Sessão: cookie assinado (HMAC-SHA256), `HttpOnly`, `Secure`, `SameSite=Lax`, validade de 7 dias.
- A lista é conferida de novo a cada carregamento de página, então remover um aluno vale já na próxima visita.
- Sem configuração completa o Worker responde 503 (acesso fechado, não aberto).
- `/hub/me` devolve nome e e-mail para o menu; `/hub/sair` encerra a sessão.

## Testes

```bash
npm test    # 17 testes: fluxo completo, cookie forjado, state adulterado, open redirect, remoção de aluno...
```
