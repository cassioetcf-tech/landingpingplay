// ── CONFIG — PingPlay Landing ────────────────────────────────────────────────
// Projeto Supabase DEDICADO do PingPlay (separado do Acesso na Tela).
//
// >>> PREENCHER com a URL e a anon/publishable key do projeto Supabase do PingPlay.
//     Supabase → Project Settings → API → Project URL e a "anon public" (ou
//     "publishable") key. São chaves de baixo risco, podem ficar no repositório
//     (a segurança real vem do RLS + RPCs SECURITY DEFINER — ver supabase-migration.sql).
//
// Enquanto os valores forem os placeholders abaixo, o site funciona visualmente,
// o ranking usa os dados-semente locais e os formulários caem no fallback do
// Netlify Forms — nada quebra.
var CONFIG = {
  SUPA_URL: 'https://SEU-PROJETO.supabase.co',
  SUPA_KEY: 'COLE_AQUI_A_ANON_KEY',
};

// true quando as chaves ainda são placeholders (evita chamadas que dariam erro).
CONFIG.SUPA_READY = !/SEU-PROJETO|COLE_AQUI/.test(CONFIG.SUPA_URL + CONFIG.SUPA_KEY);
