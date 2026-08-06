// ── LANDING — PingPlay ────────────────────────────────────────────────────────
// Ranking ao vivo (#QueroNoPingPlay) + formulários (Testar / Lista de desejo).
// Persiste no Supabase quando CONFIG.SUPA_READY; sempre captura no Netlify Forms.
// Depende de: config.js, supabase.js.

(function () {
  'use strict';

  var TOP_N = 10;

  // Dados-semente (demonstração). Substituídos pelos dados reais do Supabase quando disponível.
  var SEED = [
    { id: 'avatar',    title: 'Avatar 4',        votes: 2847 },
    { id: 'vingadores',title: 'Vingadores',      votes: 2613 },
    { id: 'superman',  title: 'Superman',        votes: 2390 },
    { id: 'aranha',    title: 'Homem-Aranha',    votes: 2104 },
    { id: 'demon',     title: 'Demon Slayer',    votes: 1958 },
    { id: 'jurassic',  title: 'Jurassic World',  votes: 1622 },
    { id: 'toystory',  title: 'Toy Story 6',     votes: 1487 },
    { id: 'moana',     title: 'Moana',           votes: 1290 },
    { id: 'frozen',    title: 'Frozen 3',        votes: 1175 },
    { id: 'minecraft', title: 'Minecraft',       votes: 980  }
  ];

  var state = { movies: SEED.map(function (m) { return { id: m.id, title: m.title, votes: m.votes, isNew: false }; }) };
  var _lastBump = null;
  var _toastT = null;

  // ── Utils ──
  function norm(s) { return (s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim()); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  function announce(msg) { var l = $('a11y-live'); if (l) l.textContent = msg; }

  function toast(msg) {
    var t = $('toast'), m = $('toast-msg');
    if (!t || !m) return;
    m.textContent = msg;
    t.hidden = false;
    clearTimeout(_toastT);
    _toastT = setTimeout(function () { t.hidden = true; }, 3400);
  }

  // ── Ranking render + FLIP ──
  function capturePositions() {
    var map = {}, list = $('ranking-list');
    if (!list) return map;
    list.querySelectorAll('[data-mid]').forEach(function (n) { map[n.dataset.mid] = n.getBoundingClientRect().top; });
    return map;
  }

  function render(prevPos) {
    var list = $('ranking-list');
    if (!list) return;
    var sorted = state.movies.slice().sort(function (a, b) { return b.votes - a.votes || a.title.localeCompare(b.title); });
    var max = sorted.length ? sorted[0].votes : 1;
    var total = state.movies.reduce(function (n, m) { return n + m.votes; }, 0);
    var top = sorted.slice(0, TOP_N);

    var totalEl = $('ranking-total');
    if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');

    list.innerHTML = top.map(function (m, idx) {
      var pct = Math.max(8, Math.round(m.votes / max * 100));
      var badges = '';
      if (idx === 0) badges += '<span class="rank-badge top">Mais pedido</span>';
      if (m.isNew) badges += '<span class="rank-badge new">Novo</span>';
      return '' +
        '<div class="rank-row" data-mid="' + esc(m.id) + '">' +
          '<span class="rank-num" aria-hidden="true">' + String(idx + 1).padStart(2, '0') + '</span>' +
          '<div class="rank-main">' +
            '<div class="rank-titleline"><span class="rank-title">' + esc(m.title) + '</span>' + badges + '</div>' +
            '<div class="rank-bar" role="img" aria-label="' + esc(m.title) + ': ' + m.votes.toLocaleString('pt-BR') + ' pedidos, ' + (idx + 1) + 'º lugar"><div class="rank-bar-fill" style="width:' + pct + '%"></div></div>' +
          '</div>' +
          '<span class="rank-votes" data-count="' + esc(m.id) + '">' + m.votes.toLocaleString('pt-BR') + '</span>' +
          '<button type="button" class="btn-quero" data-vote="' + esc(m.id) + '" aria-label="Pedir também o filme ' + esc(m.title) + '"><span aria-hidden="true">+</span> Quero</button>' +
        '</div>';
    }).join('');

    // FLIP: anima a reordenação
    if (prevPos) {
      requestAnimationFrame(function () {
        list.querySelectorAll('[data-mid]').forEach(function (n) {
          var prev = prevPos[n.dataset.mid];
          if (prev == null) return;
          var now = n.getBoundingClientRect().top;
          var dy = prev - now;
          if (dy) {
            n.style.transition = 'none';
            n.style.transform = 'translateY(' + dy + 'px)';
            requestAnimationFrame(function () {
              n.style.transition = 'transform .55s cubic-bezier(.2,.85,.25,1)';
              n.style.transform = '';
            });
          }
        });
      });
    }

    // Pulso no número recém-incrementado
    if (_lastBump) {
      var el = list.querySelector('[data-count="' + CSS.escape(_lastBump) + '"]');
      if (el) {
        el.style.transition = 'none';
        el.style.transform = 'scale(1.4)';
        el.style.color = 'var(--accent)';
        requestAnimationFrame(function () {
          el.style.transition = 'transform .5s cubic-bezier(.2,1.3,.3,1), color .6s ease';
          el.style.transform = 'scale(1)';
          el.style.color = '#2A3133';
        });
      }
      _lastBump = null;
    }
  }

  function reRender() { var p = capturePositions(); render(p); }

  // ── Persistência (Supabase) ──
  function reconcile(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    state.movies = rows.map(function (r) { return { id: r.id, title: r.title, votes: r.votes, isNew: !!r.is_new }; });
    reRender();
  }

  async function loadRanking() {
    if (!CONFIG.SUPA_READY) return;
    try {
      var rows = await supabaseGet('pingplay_movies', 'select=id,title,votes,is_new&order=votes.desc');
      reconcile(rows);
    } catch (e) { /* mantém semente */ }
  }

  function netlifyCapture(formName, data) {
    // Backup de captação via Netlify Forms (ignora erro em ambiente local).
    try {
      var body = new URLSearchParams(Object.assign({ 'form-name': formName }, data)).toString();
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }).catch(function () {});
    } catch (e) {}
  }

  // ── Ações do ranking ──
  async function requestMovie(e) {
    e.preventDefault();
    var inp = $('pp-movie'), err = $('pp-error');
    var raw = (inp.value || '').trim();
    var email = ($('pp-email').value || '').trim();
    var cidade = ($('pp-cidade').value || '').trim();
    var perfil = ($('pp-perfil').value || '').trim();

    if (err) { err.hidden = true; err.textContent = ''; }
    if (!raw) { if (err) { err.hidden = false; err.textContent = 'Digite o nome do filme que você quer ver acessível.'; } inp.focus(); return; }
    if (email && !validEmail(email)) { if (err) { err.hidden = false; err.textContent = 'Confira o e-mail digitado.'; } $('pp-email').focus(); return; }

    // Atualização otimista local
    var key = norm(raw);
    var i = state.movies.findIndex(function (m) { return norm(m.title) === key; });
    var existed = i >= 0;
    if (existed) { state.movies[i] = Object.assign({}, state.movies[i], { votes: state.movies[i].votes + 1 }); _lastBump = state.movies[i].id; }
    else { var id = 'm' + Date.now(); state.movies.push({ id: id, title: raw, votes: 1, isNew: true }); _lastBump = id; }
    reRender();
    inp.value = '';
    var msg = existed ? '“' + raw + '” subiu no ranking. Obrigado por pedir!' : '“' + raw + '” entrou no ranking. Bora mobilizar a comunidade!';
    toast(msg); announce(msg);

    // Persistência
    netlifyCapture('pedir-filme', { filme: raw, cidade: cidade, email: email, perfil: perfil });
    if (CONFIG.SUPA_READY) {
      try {
        var rows = await supabaseRpc('pingplay_vote_title', { p_title: raw });
        reconcile(rows);
        supabasePost('pingplay_requests', { filme: raw, cidade: cidade || null, email: email || null, perfil: perfil || null, quer_aviso: !!$('pp-notify').checked }).catch(function () {});
      } catch (e2) { /* mantém otimista */ }
    }
  }

  async function vote(id) {
    var m = state.movies.find(function (x) { return x.id === id; });
    if (!m) return;
    m.votes += 1; _lastBump = id;
    reRender();
    announce('“' + m.title + '” recebeu mais um pedido. Agora com ' + m.votes.toLocaleString('pt-BR') + ' pedidos.');
    if (CONFIG.SUPA_READY) {
      try { var rows = await supabaseRpc('pingplay_vote_id', { p_id: id }); reconcile(rows); } catch (e) {}
    }
  }

  // ── Formulários Testar / Desejo ──
  function handleLead(formName, tableName, fields, successId, formId) {
    var err = $(fields.errorId);
    if (err) { err.hidden = true; err.textContent = ''; }
    var nome = ($(fields.nome).value || '').trim();
    var email = ($(fields.email).value || '').trim();
    if (!nome) { showErr(err, 'Informe seu nome.', fields.nome); return; }
    if (!validEmail(email)) { showErr(err, 'Informe um e-mail válido.', fields.email); return; }

    var data = { nome: nome, email: email, cidade: ($(fields.cidade).value || '').trim(), uf: ($(fields.uf).value || '').trim().toUpperCase() };
    if (fields.cinema) data.cinema = ($(fields.cinema).value || '').trim();

    // UI de sucesso
    var form = $(formId), ok = $(successId);
    if (form) form.hidden = true;
    if (ok) { ok.hidden = false; ok.focus && ok.focus(); }
    announce('Cadastro concluído. Você entrou na lista.');

    // Persistência
    netlifyCapture(formName, data);
    if (CONFIG.SUPA_READY) {
      var payload = Object.assign({ tipo: (tableName === 'teste' ? 'teste' : 'desejo') }, data);
      supabasePost('pingplay_leads', payload).catch(function () {});
    }
  }
  function showErr(err, msg, focusId) { if (err) { err.hidden = false; err.textContent = msg; } var f = $(focusId); if (f) f.focus(); }

  // ── Init ──
  document.addEventListener('DOMContentLoaded', function () {
    render(null);
    loadRanking();

    var fp = $('form-pedir'); if (fp) fp.addEventListener('submit', requestMovie);

    var list = $('ranking-list');
    if (list) list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vote]');
      if (b) vote(b.getAttribute('data-vote'));
    });

    var ft = $('form-testar');
    if (ft) ft.addEventListener('submit', function (e) {
      e.preventDefault();
      handleLead('testar-cinema', 'teste', { nome: 't-nome', email: 't-email', cidade: 't-cidade', uf: 't-uf', cinema: 't-cinema', errorId: 't-error' }, 't-success', 'form-testar');
    });

    var fb = $('form-comprar');
    if (fb) fb.addEventListener('submit', function (e) {
      e.preventDefault();
      handleLead('lista-desejo', 'desejo', { nome: 'b-nome', email: 'b-email', cidade: 'b-cidade', uf: 'b-uf', errorId: 'b-error' }, 'b-success', 'form-comprar');
    });

    // Atualização "ao vivo" do ranking (reflete pedidos de outras pessoas)
    if (CONFIG.SUPA_READY) setInterval(loadRanking, 20000);
  });
})();
