# PingPlay — Landing page

Hub único de engajamento da **PingPlay**, plataforma de acessibilidade audiovisual
para cinema (legenda, Libras e audiodescrição dentro da experiência, via óculos).
Iniciativa da ETC Filmes.

- **Produção:** https://queronopingplay.com/
- **Netlify:** projeto `landingpingplay`
- **Stack:** HTML + CSS + JavaScript vanilla, **sem build step** (mesmo padrão do
  Acesso na Tela — HTML puro é mais confiável para leitores de tela). Deploy
  estático no Netlify a partir do branch `main`.

## Objetivos de conversão (uma página só)
1. **#QueroNoPingPlay** — pedir um filme + ranking ao vivo dos mais pedidos.
2. **Testar nos cinemas** — lista de espera para sessões de demonstração.
3. **Lista de desejo** — lista de espera para a compra dos óculos.

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
js/landing.js              ← ranking ao vivo (FLIP) + formulários
assets/, fonts/            ← imagens e fonte Cocogoose
netlify.toml               ← headers de cache
supabase-migration.sql     ← rodar UMA vez no SQL Editor do Supabase
```

## Colocar no ar (checklist)

### 1. Supabase (backend dos formulários e do ranking)
1. Crie/abra o projeto Supabase **dedicado do PingPlay**.
2. No **SQL Editor**, cole e rode `supabase-migration.sql` (cria tabelas, RLS,
   seed do ranking e as RPCs de votação).
3. Em **Project Settings → API**, copie a **Project URL** e a **anon/publishable key**.
4. Cole os dois valores em `js/config.js` (`SUPA_URL` e `SUPA_KEY`) e faça commit.
   > Enquanto os placeholders não forem trocados, o site funciona em modo demo:
   > ranking com dados-semente e formulários caindo só no Netlify Forms.

### 2. GitHub → Netlify (deploy contínuo)
1. Crie um repositório no GitHub (ex.: `cassioetcf-tech/landingpingplay`).
2. `git remote add origin <url>` · `git push -u origin main`.
3. No painel do projeto Netlify `landingpingplay`: **Site configuration → Build &
   deploy → Link repository** e aponte para o repo. Build command vazio, publish
   directory `.` (já definido em `netlify.toml`).
4. Confirme o domínio `queronopingplay.com` em **Domain management**.

### 3. Formulários
- Cada envio grava no Supabase (ranking/pedidos/leads) **e** é capturado pelo
  **Netlify Forms** como backup (`pedir-filme`, `testar-cinema`, `lista-desejo`
  aparecem em **Forms** no painel). Configure notificações por e-mail em
  Netlify → Forms se quiser aviso a cada lead.

## Desenvolvimento local
Qualquer servidor estático na raiz, ex.: `npx serve .` e abra `http://localhost:3000`.

## Notas
- Números do ranking são fictícios de demonstração (na `supabase-migration.sql`).
- Fonte Cocogoose é trial — garantir licença ou substituir por uma grotesca
  geométrica bold antes de produção definitiva.
- Imagens são geradas por IA, fornecidas pelo cliente.
