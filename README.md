# PingPlay — Landing page

Hub único de engajamento da **PingPlay**, plataforma de acessibilidade audiovisual
para cinema (legenda, Libras e audiodescrição dentro da experiência, via óculos).
Iniciativa da ETC Filmes.

- **Produção:** https://queronopingplay.com/
- **Netlify:** projeto `landingpingplay`
- **Stack:** HTML + CSS + JavaScript vanilla, **sem build step** (mesmo padrão do
  Acesso na Tela — HTML puro é mais confiável para leitores de tela). Deploy
  estático no Netlify a partir do branch `main`.

## Modelo (v2 — cadastro único)
Uma pessoa faz **um cadastro só** (nome, e-mail, telefone/WhatsApp, cidade, como
se identifica) e marca seus **interesses**: testar, lista de desejo dos óculos e/ou
indicar filmes. Consentimento LGPD obrigatório (checkbox + `privacidade.html`).
- **#QueroNoPingPlay** — indicação de filmes **vinculada ao cadastro** (identidade =
  e-mail no `localStorage`); ranking = **nº de pessoas distintas por filme**, com
  dedup (a mesma pessoa não conta o mesmo filme duas vezes).
- **Testar** e **Lista de desejo** viram conteúdo explicativo com CTA que rola até o
  cadastro e marca o interesse.
Base única no Supabase (`pingplay_cadastros` + `pingplay_indicacoes`) + cópia de cada
cadastro no **Netlify Forms** (`cadastro-pingplay`) para o marketing.

## Acessibilidade
WCAG 2.2 AA + ABNT NBR 17225. Skip-link, foco visível (anel branco + halo roxo,
visível em fundo claro e escuro), barra de acessibilidade (tamanho de texto, 4
modos de contraste, VLibras), `aria-live` no ranking/toast, alvos ≥44px,
`prefers-reduced-motion`, mockups de celular expostos como imagem única com
descrição para leitores de tela. Declaração em `#acessibilidade`.

## Estrutura
```
index.html                 ← página única
css/base.css               ← tokens, foco, barra de acessibilidade, contraste, fonte
css/landing.css            ← estilos das seções
js/config.js               ← >>> PREENCHER com URL + anon key do Supabase do PingPlay
js/supabase.js             ← wrapper REST
js/a11y.js                 ← barra de acessibilidade (fonte, contraste, VLibras)
js/landing.js              ← cadastro único, indicação c/ dedup, ranking por pessoa
privacidade.html           ← Política de Privacidade (LGPD)
assets/, fonts/            ← imagens e fonte Cocogoose
netlify.toml               ← headers de cache
supabase-migration.sql     ← rodar UMA vez no SQL Editor do Supabase (v2)
```

## Colocar no ar (checklist)

### 1. Supabase (backend dos formulários e do ranking)
Reaproveita o projeto do **Acesso na Tela** (`gpwmmvaetokgrzekepbk`); `js/config.js`
já aponta para ele. Tabelas namespaced `pingplay_*` (não mexem em nada do Acesso
na Tela e **não** ligam na `newsletter`, para não disparar o e-mail de boas-vindas
de lá).
1. Abra o projeto Supabase do Acesso na Tela.
2. No **SQL Editor**, cole e rode `supabase-migration.sql` (v2: cria `pingplay_cadastros`
   e `pingplay_indicacoes`, RLS, RPCs `pingplay_upsert_cadastro`/`pingplay_indicar`/
   `pingplay_ranking`, e remove as tabelas da v1). Pronto — cadastro e ranking ficam
   live automaticamente.
   > Antes de rodar o SQL, o site funciona em modo demo: ranking com dados-semente
   > e formulários caindo só no Netlify Forms.

### 2. GitHub → Netlify (deploy contínuo)
1. Crie um repositório no GitHub (ex.: `cassioetcf-tech/landingpingplay`).
2. `git remote add origin <url>` · `git push -u origin main`.
3. No painel do projeto Netlify `landingpingplay`: **Site configuration → Build &
   deploy → Link repository** e aponte para o repo. Build command vazio, publish
   directory `.` (já definido em `netlify.toml`).
4. Confirme o domínio `queronopingplay.com` em **Domain management**.

### 3. Formulários e lista de cadastros
- Cada cadastro grava no Supabase (`pingplay_cadastros` + `pingplay_indicacoes`)
  **e** é capturado pelo **Netlify Forms** (`cadastro-pingplay`).
- **Acesso à lista completa:** painel Netlify → **Forms → cadastro-pingplay**
  (todos os envios + **export CSV**). É a fonte simples para o marketing. A base
  relacional fica no Supabase (para ranking/dedup e consultas mais ricas).

### 4. E-mails do cadastro (Microsoft 365 / Graph) — `netlify/functions/submission-created.js`
Roda sozinha a cada envio do formulário e manda 2 e-mails via **Microsoft Graph**
(OAuth client credentials), usando o M365 da ETC Filmes:
1. **Confirmação** para quem se cadastrou (marca PingPlay).
2. **Cópia interna** com todos os dados para o time (`reply-to` = a pessoa).

**Setup no Microsoft 365 (admin):**
1. **Entra ID (Azure AD) → App registrations → New registration** (ex.: "PingPlay
   Landing Mail"). Anote o **Application (client) ID** e o **Directory (tenant) ID**.
2. **Certificates & secrets → New client secret** → copie o **Value** (client secret).
3. **API permissions → Add → Microsoft Graph → Application permissions → `Mail.Send`**
   → **Grant admin consent**.
4. Garanta uma **caixa remetente real** com o endereço desejado. Para
   `@queronopingplay.com`: adicione o domínio como **accepted domain** no M365 e crie
   uma **shared mailbox** `contato@queronopingplay.com` (shared não precisa de licença
   e recebe respostas). Ou use uma caixa `@etcfilmes.com.br` que já exista.
5. *(Recomendado)* Restrinja o app a essa caixa com uma **Application Access Policy**
   (`New-ApplicationAccessPolicy`), senão o app pode enviar como qualquer caixa.

**Variáveis de ambiente no projeto Netlify `landingpingplay`:**
- `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` — do app registrado acima.
- `MS_SENDER` — caixa remetente (ex.: `contato@queronopingplay.com`).
- `PP_MAIL_TO` — cópia interna (vírgula). Default: cassio@ / daniella.leal@ /
  renato.azevedo@ etcfilmes.com.br.
- `PP_REPLY_TO` (opcional) — reply-to do e-mail de confirmação.

## Desenvolvimento local
Qualquer servidor estático na raiz, ex.: `npx serve .` e abra `http://localhost:3000`.

## Notas
- Números do ranking são fictícios de demonstração (na `supabase-migration.sql`).
- Fonte Cocogoose é trial — garantir licença ou substituir por uma grotesca
  geométrica bold antes de produção definitiva.
- Imagens são geradas por IA, fornecidas pelo cliente.
