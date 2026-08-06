-- ═══════════════════════════════════════════════════════════════════════════
-- PingPlay — Migração Supabase (rodar UMA vez no SQL Editor do projeto DEDICADO)
-- Cria: ranking de filmes (#QueroNoPingPlay), pedidos individuais e leads
-- (Testar / Lista de desejo). RLS + RPCs SECURITY DEFINER para votação segura.
-- Depois de rodar, preencha js/config.js com a URL e a anon key deste projeto.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Normalização de título (imutável, usada em coluna gerada e nas RPCs)
create or replace function pingplay_norm(t text) returns text
language sql immutable as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))
$$;

-- ── Ranking de filmes ──
create table if not exists pingplay_movies (
  id         text primary key,
  title      text not null,
  title_norm text generated always as (pingplay_norm(title)) stored,
  votes      integer not null default 0,
  is_new     boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists pingplay_movies_norm_uk on pingplay_movies (title_norm);

-- ── Pedidos individuais (form #QueroNoPingPlay) ──
create table if not exists pingplay_requests (
  id         uuid primary key default gen_random_uuid(),
  filme      text not null,
  cidade     text,
  email      text,
  perfil     text,
  quer_aviso boolean default true,
  created_at timestamptz not null default now()
);

-- ── Leads (Testar nos cinemas + Lista de desejo) ──
create table if not exists pingplay_leads (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('teste', 'desejo')),
  nome       text,
  email      text,
  cidade     text,
  uf         text,
  cinema     text,
  created_at timestamptz not null default now()
);

-- ── Semente do ranking (números fictícios de demonstração; troque quando quiser) ──
insert into pingplay_movies (id, title, votes) values
  ('avatar',     'Avatar 4',       2847),
  ('vingadores', 'Vingadores',     2613),
  ('superman',   'Superman',       2390),
  ('aranha',     'Homem-Aranha',   2104),
  ('demon',      'Demon Slayer',   1958),
  ('jurassic',   'Jurassic World', 1622),
  ('toystory',   'Toy Story 6',    1487),
  ('moana',      'Moana',          1290),
  ('frozen',     'Frozen 3',       1175),
  ('minecraft',  'Minecraft',       980)
on conflict (id) do nothing;

-- ── RLS ──
alter table pingplay_movies   enable row level security;
alter table pingplay_requests enable row level security;
alter table pingplay_leads    enable row level security;

-- Ranking: leitura pública; escrita só via RPC (security definer)
drop policy if exists pingplay_movies_read on pingplay_movies;
create policy pingplay_movies_read on pingplay_movies for select using (true);

-- Pedidos e leads: inserção pública, SEM leitura pública (protege PII)
drop policy if exists pingplay_requests_insert on pingplay_requests;
create policy pingplay_requests_insert on pingplay_requests for insert with check (true);
drop policy if exists pingplay_leads_insert on pingplay_leads;
create policy pingplay_leads_insert on pingplay_leads for insert with check (true);

grant select on pingplay_movies to anon, authenticated;
grant insert on pingplay_requests, pingplay_leads to anon, authenticated;

-- ── RPC: votar por título (cria o filme se não existir) ──
create or replace function pingplay_vote_title(p_title text)
returns setof pingplay_movies
language plpgsql security definer set search_path = public as $$
declare v_norm text; v_id text;
begin
  v_norm := pingplay_norm(p_title);
  if v_norm = '' then raise exception 'titulo vazio'; end if;
  update pingplay_movies set votes = votes + 1 where title_norm = v_norm;
  if not found then
    v_id := 'm' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;
    insert into pingplay_movies (id, title, votes, is_new)
    values (v_id, btrim(p_title), 1, true)
    on conflict (title_norm) do update set votes = pingplay_movies.votes + 1;
  end if;
  return query select * from pingplay_movies order by votes desc, title asc;
end $$;

-- ── RPC: votar por id (botão "+ Quero") ──
create or replace function pingplay_vote_id(p_id text)
returns setof pingplay_movies
language plpgsql security definer set search_path = public as $$
begin
  update pingplay_movies set votes = votes + 1 where id = p_id;
  return query select * from pingplay_movies order by votes desc, title asc;
end $$;

grant execute on function pingplay_vote_title(text) to anon, authenticated;
grant execute on function pingplay_vote_id(text)    to anon, authenticated;
