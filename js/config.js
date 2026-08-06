// ── CONFIG — PingPlay Landing ────────────────────────────────────────────────
// Reaproveita o projeto Supabase do Acesso na Tela (mesma URL + anon key).
// As tabelas do PingPlay são namespaced com prefixo `pingplay_` para não
// colidir com nada do Acesso na Tela (ver supabase-migration.sql).
//
// A anon/publishable key é de baixo risco e já pública no repositório do
// Acesso na Tela. A segurança real vem do RLS + RPCs SECURITY DEFINER.
//
// Rode `supabase-migration.sql` no SQL Editor DESTE projeto (gpwmmvaetokgrzekepbk)
// para criar as tabelas pingplay_* e as RPCs de votação. Enquanto elas não
// existirem, o site roda em modo demo (ranking com dados-semente; formulários
// caem só no Netlify Forms) — nada quebra.
var CONFIG = {
  SUPA_URL: 'https://gpwmmvaetokgrzekepbk.supabase.co',
  SUPA_KEY: 'sb_publishable_lbKSyHwh8nNINEef-0Hi5Q_oPF5qt-P',
};

// true quando as chaves são reais (não placeholders).
CONFIG.SUPA_READY = !/SEU-PROJETO|COLE_AQUI/.test(CONFIG.SUPA_URL + CONFIG.SUPA_KEY);
