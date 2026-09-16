# CONTEXT.md — Hub Núcleo Gravitas

> Documento de continuidade para outra sessão/Claude assumir este projeto. Escrito em 2026-09-16, ao final de uma conversa longa e iterativa. Ver também `../CONTEXT.md` (projeto irmão, o site institucional `nucleo-gravitas/`) e `../identidade-visual-nucleo-gravitas.md` (doc de marca compartilhado).

---

## 1. Objetivo do projeto

Hub interno, **sem senha mas com URL "escondida"** (`/hub`), pra alunos/mentorados do **Núcleo Gravitas** consultarem um banco de ofertas de infoproduto lowticket já mineradas/validadas (pra modelar, não copiar) e frameworks/metodologia oficial da mentoria. Não é um produto público, é material de apoio pros mentorados.

O domínio raiz `nucleogravitas.com.br` é do **site institucional** (projeto irmão `nucleo-gravitas/`, ver `../CONTEXT.md`), que hoje ainda não está pronto — por isso a raiz está **temporariamente redirecionada pra `/hub`** via `vercel.json` (ver seção 5).

---

## 2. Estrutura de arquivos e repositório

```
prints site digao/                     ← pasta raiz (NÃO é repo git; cada subprojeto tem seu próprio .git)
├── CONTEXT.md                          ← contexto do site institucional (projeto irmão)
├── identidade-visual-nucleo-gravitas.md
├── .claude/launch.json                 ← COMPARTILHADO entre os dois projetos, ver seção 8 do CONTEXT irmão
├── nucleo-gravitas/                     ← site institucional, projeto separado
└── HUB NUCLEO GRAVITAS/                ← ESTE projeto — é um repositório git próprio
    ├── CONTEXT.md                       ← este arquivo
    ├── vercel.json                      ← redirect temporário raiz→/hub
    ├── index.html                       ← página do SITE INSTITUCIONAL na raiz do domínio (ver seção 5)
    └── hub/
        ├── serve.js                     ← servidor local de dev
        ├── index.html                    ← a página do Hub em si
        ├── css/style.css
        ├── js/
        │   ├── data.js                   ← FONTE ÚNICA DE DADOS, editar aqui pra adicionar conteúdo
        │   └── script.js                 ← toda a lógica de renderização
        └── assets/frameworks/            ← 14 pares .svg + .pdf (gráficos de framework)
```

- Repo git: `HUB NUCLEO GRAVITAS/` é a raiz do git, remote `https://github.com/dinizskt/nucleogravitashub.git`, branch `main`.
- **Deploy:** Vercel conectado a esse repo/branch, auto-deploy a cada push (o usuário já tinha essa conexão configurada antes; nenhuma ação manual na Vercel é necessária, só `git push`).
- **Domínio:** `nucleogravitas.com.br` → raiz do repo (site institucional, ainda incompleto) → redirecionada pra `/hub` (ver seção 5).
- Commits sempre com `-c user.name="Cassio Diniz" -c user.email="c4ssio180@gmail.com"` (sem config git global na máquina) e footer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## 3. Tecnologias

- HTML/CSS/JS puro, sem framework, sem build step. Zero dependências no site publicado.
- `hub/serve.js` só serve arquivos estáticos localmente (dev). Preview local via `.claude/launch.json`, entrada `"hub-nucleo-gravitas"`, porta 8099.
- **Fontes:** Inter (corpo) + Sora (títulos), mesma identidade do site institucional.
- **Design da UI do app:** propositalmente **flat/chapado** — sem gradiente, sem glow, sem hover-lift, sem "textura ou movimento especial". Isso foi um pedido explícito do usuário só pra interface do Hub em si (nav, cards de oferta, botões etc). **Não confundir com os gráficos dos frameworks** (seção 6), que são ilustrações baixáveis e usam gradiente/sombra livremente — regras diferentes pra coisas diferentes.
- Scrollbar customizada fina, sem outras firulas visuais.

---

## 4. `hub/js/data.js` — fonte única de conteúdo

Tudo é dado estático em arrays/objetos JS, renderizado pelo `script.js`. **Pra adicionar conteúdo, editar só este arquivo** (mais o `script.js` se for um tipo de dado novo).

### `OFERTAS` (54 entradas, linhas ~7–1592)
Cada oferta: `titulo, nicho, produto, publico, promessa, mecanismo, preco, plataforma, link, status, dificuldade, escala, dataMineracao, nota:{demanda,producao,anunciar,concorrencia,potencial,pesquisaWeb}, porQueVende:{dor,desejo,mecanismo,angulo,agora}, diferenciacao, linkCheck:{status,nota,verificadoEm}`.

- 44 ofertas originais + 10 do relatório "mineração 30-08".
- `nota.pesquisaWeb` = validação real feita com pesquisa na web (demanda/concorrência), não é só heurística.
- `linkCheck` só existe nas 44 originais — foi verificado **de verdade** navegando no Meta Ads Library (via Browser tool) e não só com fetch, porque fetch simples dava resultado inconclusivo. Quando `linkCheck.status !== "ok"`, o card mostra um aviso visível explicando que o anúncio ter saído do ar **não invalida a oferta**: a concepção/mecanismo/promessa continuam podendo ser modelados (pode ter sido corte de orçamento, sazonalidade, troca de link — não necessariamente fim de vendas).
- Se novos relatórios de mineração chegarem, seguir o mesmo padrão de objeto e adicionar ao array (sem `linkCheck` a menos que se vá verificar de verdade).

### Bancos de conteúdo **dormentes** (dados existem, UI desativada — "Em breve")
`MECANISMOS, HEADLINES, HOOKS, SWIPES, ESTRUTURA_PAGINA, BUMPS, UPSELLS, ESTEIRAS, BONUS, PROMPTS, CHECKLIST_VALIDACAO, CHECKLIST_24H, FERRAMENTAS, SATURADAS`.

Foram todos preenchidos numa fase anterior do projeto, mas o usuário pediu pra **desativar tudo exceto Banco de Ofertas** temporariamente — as seções aparecem no nav com placeholder "Em breve", mas os dados e a lógica ficam intactos em `data.js` pra reativar quando o usuário pedir. **Não são dados mortos, é intencional.**

### `FRAMEWORKS` (14 entradas, linha ~1611+)
Cada um: `{titulo, categoria, descricao, imagem, arquivo}`. `imagem`/`arquivo` sempre com path **absoluto** `/hub/assets/frameworks/<nome>.svg` / `.pdf` (ver regra crítica na seção 7).

Lista atual (nessa ordem):
1. Estrutura de Oferta
2. Arquitetura da Oferta
3. Página de Vendas Low Ticket
4. Métricas da Utmify
5. 7 Erros que Travam o Low Ticket
6. Nível de Consciência
7. Mapa da Modelagem no Low Ticket
8. Blocos Obrigatórios em Todas as Ofertas
9. Os 3 Tipos de Entregável
10. Estrutura do Criativo Demonstrativo
11. Padrão Básico de Métricas para Low Ticket
12. Mapa de Decisões na Escala
13. Mapa dos Ajustes 5×
14. Order Bump Gravitas

(A numeração dos arquivos pula o `01` de propósito — era a capa "Metodologia Aplicada", removida por pedido do usuário porque "não precisa ter".)

---

## 5. `panel-*` no `hub/index.html` e o redirect da raiz

- Sidenav do Hub: grupo **Frameworks** (topo) → **Ofertas** (só `panel-ofertas` é funcional) → **Copy & Criativos** / **Monetização** / **Execução** (todos "Em breve", dados dormentes conforme seção 4).
- `hub/js/script.js` só tem lógica de renderização pra `panel-ofertas` (busca/filtro/agrupamento por nicho/cards com barra de `nota`, `<details>` de `porQueVende`/`diferenciacao`, badge de `linkCheck`) e `panel-frameworks` (`renderFrameworks()` / `frameworkCardHTML()`).
- `vercel.json` na raiz do repo:
  ```json
  { "redirects": [{ "source": "/", "destination": "/hub", "permanent": false }] }
  ```
  Isso é **temporário e reversível** (302, não 301) — só existe porque o site institucional (`index.html` na raiz deste mesmo repo) ainda não está pronto. **Quando o site institucional estiver pronto pra publicar, apagar/editar esse redirect** pra raiz voltar a servir o site normal e o Hub ficar só em `/hub`.

---

## 6. Frameworks (gráficos baixáveis) — pipeline de geração

Os 14 frameworks são imagens 16:9 (1600×900) com a identidade visual do Núcleo Gravitas (fundo escuro, gradiente roxo), baixáveis em **PDF**.

- **Pipeline:** SVG escrito à mão (JS gerador) → convertido pra PDF via `pdfkit` + `svg-to-pdfkit` (pacotes Node instalados num projeto scratchpad temporário, fora do repo). Escolhido porque não havia ferramenta nativa de renderização de PDF disponível no ambiente.
- **Scripts geradores viviam só no scratchpad da sessão** (`.../scratchpad/pdfgen/`), não fazem parte do repo publicado:
  - `gen-all-v2.js` — **script definitivo e mais atual**, gera as 14 SVGs com o design system v2 (gradientes, sombras `feDropShadow`, layout de altura dinâmica). Se precisar regenerar ou adicionar um framework novo no mesmo padrão visual, **partir desse script**, não dos mais antigos (`_generate.js`, `gen-manual.js` — já superados).
  - `make-all-pdfs.js` — lê todo `.svg` de `hub/assets/frameworks/`, troca `→`/`›` por `>` (PDFKit não renderiza esse glyph — fica em branco), converte pra `.pdf` via `SVGtoPDF`.
- **Conteúdo dos 9 frameworks baseados no manual** (Nível de Consciência até Order Bump Gravitas) vem do manual oficial de metodologia do usuário (`nucleo_gravitas_manual.pdf`, 56 páginas, "MANUAL DE REFERÊNCIA · LOW TICKET · NG · 2026", 9 Partes / 33 Seções) — **um framework por Parte/área**, conforme pedido explícito ("cada um de uma área", "cuidado com o conteúdo e informações"). Só 9 das 33 seções foram convertidas; as outras 24 seções ainda não têm framework — possível próximo passo se o usuário pedir.
- **Princípio de layout crítico** (aprendido depois de feedback negativo — "design muito simples e desalinhado, precisa ser algo realmente profissional"): a altura da área de conteúdo de cada framework **deve ser calculada dinamicamente** como `available = FOOTER_Y - 20 - contentY`, nunca com altura fixa/chutada — isso foi a causa raiz do design "vazio"/desalinhado que o usuário reclamou. Qualquer novo framework deve seguir esse padrão.
- Se for regenerar: reinstalar `pdfkit`/`svg-to-pdfkit` num scratchpad (`npm install pdfkit svg-to-pdfkit`), copiar/adaptar `gen-all-v2.js`, rodar, rodar `make-all-pdfs.js`, copiar os pares `.svg`+`.pdf` pra `hub/assets/frameworks/`, adicionar entrada em `FRAMEWORKS` no `data.js` com paths **absolutos** `/hub/...`.

---

## 7. ⚠️ Regra crítica: paths absolutos `/hub/...`

Produção serve o Hub em `/hub` (sem barra final). **Todo path de asset dentro de `hub/index.html` e nos campos `imagem`/`arquivo` do `FRAMEWORKS` em `data.js` precisa ser absoluto, prefixado `/hub/...`** — não relativo. Path relativo funciona em dev local (quando `hub/` é servido como raiz própria via `serve.js`) mas **quebra em produção** (resolve contra a raiz do domínio). Esse bug já foi cometido e corrigido duas vezes (uma vez no fix geral, commit `fcc0b92`; outra vez especificamente pra `FRAMEWORKS` novos). Ao adicionar qualquer asset novo, sempre checar isso antes de commitar, e verificar ao vivo (`document.querySelectorAll('.framework-card')`, `img.complete`/`naturalWidth` via JS no Browser tool contra a URL de produção) depois do deploy.

---

## 8. Regras de conteúdo/design já validadas com o usuário

1. **UI do Hub em si: flat, sem gradiente/glow/hover** (seção 3). Isso não se aplica aos gráficos de framework, que podem (e devem) ter gradiente/sombra pro visual "profissional".
2. **Ao adicionar framework baseado no manual oficial, preservar fielmente o conteúdo/metodologia proprietária** — não resumir de forma que distorça o método, não inventar conceito que não está no manual.
3. Se algum link de anúncio de oferta estiver fora do ar, isso **não é motivo pra remover a oferta do banco** — é motivo pra mostrar o aviso (`linkCheck`) explicando que a concepção continua válida.
4. Subheadline do Hub: **"O ouro das operações de infoproduto lowticket escaladas"** (copy confirmada, não alterar sem pedido novo).
5. Ao fazer qualquer mudança visual em gráficos de framework, testar via `serve.js` local (porta 8099) OU direto em produção — `file://` no Browser tool é instável (falha intermitente sem motivo aparente), **preferir servidor HTTP real**.

---

## 9. Pendências / próximos passos (não confirmados — só possibilidades levantadas)

Nenhuma tarefa está em aberto por pedido explícito do usuário no momento. Duas possibilidades foram mencionadas mas **não escolhidas** quando perguntei ("continua" → "[sem preferência]" → usuário disse "deixa assim por hoje"):

1. **Mais frameworks**: só 9 das 33 seções do manual oficial foram convertidas em framework (uma por Parte/área). As outras 24 seções continuam sem gráfico — possível trabalho futuro, seguindo o pipeline da seção 6.
2. **Ativar seções "Em breve"**: `MECANISMOS, HEADLINES, HOOKS`, etc. já têm dados completos em `data.js` (seção 4) mas nenhuma UI de renderização — se o usuário pedir, é "só" escrever a função de render em `script.js` e tirar o placeholder no `index.html`, o dado já existe.
3. Quando o site institucional (`nucleo-gravitas/`) estiver pronto, remover o redirect temporário em `vercel.json` (seção 5).

---

*Fim do documento. Antes de tomar qualquer decisão de design/conteúdo que pareça conflitar com uma regra acima, perguntar ao usuário — várias dessas regras vieram de feedback explícito repetido, não são só preferência minha.*
