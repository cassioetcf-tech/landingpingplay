-- ═══════════════════════════════════════════════════════════════════════════
-- PingPlay v2 — Migração Supabase (rodar UMA vez no SQL Editor)
-- Projeto: reaproveita o Supabase do Acesso na Tela (gpwmmvaetokgrzekepbk).
--
-- Modelo v2 (base qualificada de leads):
--   • pingplay_cadastros  — 1 linha por pessoa (chave = e-mail), com interesses e LGPD
--   • pingplay_indicacoes — filmes indicados por pessoa, com dedup (email+filme)
--   • ranking = nº de PESSOAS distintas por filme (não cliques)
-- PII protegida: cadastros/indicações NÃO têm leitura pública; escrita só via RPC.
-- Ao final, remove as tabelas/RPCs da v1 (eram de demonstração).
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create or replace function pingplay_norm(t text) returns text
language sql immutable as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))
$$;

-- ── Base única de cadastros (1 linha por pessoa) ──
create table if not exists pingplay_cadastros (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  email        text not null unique,
  telefone     text,
  cidade       text,
  perfil       text,
  quer_testar  boolean not null default false,
  quer_oculos  boolean not null default false,
  quer_indicar boolean not null default false,
  lgpd         boolean not null default false,
  lgpd_at      timestamptz,
  origem       text default 'landing',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Indicações de filmes (dedup por pessoa + filme) ──
create table if not exists pingplay_indicacoes (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  email_norm text generated always as (lower(btrim(email))) stored,
  filme      text not null,
  filme_norm text generated always as (pingplay_norm(filme)) stored,
  created_at timestamptz not null default now()
);
create unique index if not exists pingplay_indic_uk on pingplay_indicacoes (email_norm, filme_norm);

alter table pingplay_cadastros   enable row level security;
alter table pingplay_indicacoes  enable row level security;
-- Sem policies públicas de select/insert: escrita só via RPC SECURITY DEFINER (PII protegida).

-- ── RPC: cadastro (upsert por e-mail; merge — nunca rebaixa interesse/LGPD) ──
create or replace function pingplay_upsert_cadastro(
  p_nome text, p_email text, p_telefone text, p_cidade text, p_perfil text,
  p_quer_testar boolean, p_quer_oculos boolean, p_quer_indicar boolean, p_lgpd boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or btrim(p_email) = '' then raise exception 'email obrigatorio'; end if;
  insert into pingplay_cadastros (nome, email, telefone, cidade, perfil,
                                  quer_testar, quer_oculos, quer_indicar, lgpd, lgpd_at)
  values (btrim(p_nome), lower(btrim(p_email)), nullif(btrim(p_telefone), ''),
          nullif(btrim(p_cidade), ''), nullif(btrim(p_perfil), ''),
          coalesce(p_quer_testar, false), coalesce(p_quer_oculos, false),
          coalesce(p_quer_indicar, false), coalesce(p_lgpd, false),
          case when p_lgpd then now() else null end)
  on conflict (email) do update set
    nome         = coalesce(nullif(btrim(excluded.nome), ''), pingplay_cadastros.nome),
    telefone     = coalesce(excluded.telefone, pingplay_cadastros.telefone),
    cidade       = coalesce(excluded.cidade, pingplay_cadastros.cidade),
    perfil       = coalesce(excluded.perfil, pingplay_cadastros.perfil),
    quer_testar  = pingplay_cadastros.quer_testar  or excluded.quer_testar,
    quer_oculos  = pingplay_cadastros.quer_oculos  or excluded.quer_oculos,
    quer_indicar = pingplay_cadastros.quer_indicar or excluded.quer_indicar,
    lgpd         = pingplay_cadastros.lgpd or excluded.lgpd,
    lgpd_at      = coalesce(pingplay_cadastros.lgpd_at, excluded.lgpd_at),
    updated_at   = now();
end $$;

-- ── RPC: indicar filme (dedup por pessoa+filme) ──
create or replace function pingplay_indicar(p_email text, p_filme text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or btrim(p_email) = '' then raise exception 'email obrigatorio'; end if;
  if pingplay_norm(p_filme) = '' then raise exception 'filme vazio'; end if;
  insert into pingplay_indicacoes (email, filme)
  values (lower(btrim(p_email)), btrim(p_filme))
  on conflict (email_norm, filme_norm) do nothing;
end $$;

-- ── RPC: ranking agregado (SEM PII — só filme + nº de pessoas) ──
create or replace function pingplay_ranking(p_limit int default 10)
returns table(filme text, pessoas bigint)
language sql security definer set search_path = public as $$
  select max(filme) as filme, count(distinct email_norm) as pessoas
  from pingplay_indicacoes
  group by filme_norm
  order by pessoas desc, 1 asc
  limit greatest(1, coalesce(p_limit, 10));
$$;

grant execute on function pingplay_upsert_cadastro(text,text,text,text,text,boolean,boolean,boolean,boolean) to anon, authenticated;
grant execute on function pingplay_indicar(text,text) to anon, authenticated;
grant execute on function pingplay_ranking(int)        to anon, authenticated;

-- ── Limpeza da v1 (eram tabelas/RPCs de demonstração) ──
drop function if exists pingplay_vote_title(text);
drop function if exists pingplay_vote_id(text);
drop table if exists pingplay_movies;
drop table if exists pingplay_requests;
drop table if exists pingplay_leads;
