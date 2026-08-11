// ── LANDING v2 — PingPlay ─────────────────────────────────────────────────────
// Cadastro único (base qualificada) + indicação de filmes com identidade e dedup.
// Persiste no Supabase (RPCs SECURITY DEFINER) e replica no Netlify Forms.
// Identidade sem login = e-mail guardado no localStorage do aparelho.
// Depende de: config.js, supabase.js.

(function () {
  'use strict';

  var TOP_N = 10;
  var LS_EMAIL = 'pp_email', LS_NOME = 'pp_nome';
  var _toastT = null;

  function $(id) { return document.getElementById(id); }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim()); }
  function norm(s) { return (s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function digits(s) { return (s || '').replace(/\D/g, ''); }
  function getEmail() { try { return localStorage.getItem(LS_EMAIL) || ''; } catch (e) { return ''; } }
  function setIdentity(email, nome) { try { localStorage.setItem(LS_EMAIL, email); if (nome) localStorage.setItem(LS_NOME, nome); } catch (e) {} }
  function announce(msg) { var l = $('a11y-live'); if (l) l.textContent = msg; }

  function toast(msg) {
    var t = $('toast'), m = $('toast-msg');
    if (!t || !m) return;
    m.textContent = msg; t.hidden = false;
    clearTimeout(_toastT);
    _toastT = setTimeout(function () { t.hidden = true; }, 3600);
  }

  // Máscara leve de telefone BR: (11) 99999-9999
  function maskTel(v) {
    var d = digits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function netlifyCapture(formName, data) {
    try {
      var body = new URLSearchParams(Object.assign({ 'form-name': formName }, data)).toString();
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }).catch(function () {});
    } catch (e) {}
  }

  // ═══ RANKING ═══
  var _rank = [];

  function capturePositions() {
    var map = {}, list = $('ranking-list');
    if (list) list.querySelectorAll('[data-mid]').forEach(function (n) { map[n.dataset.mid] = n.getBoundingClientRect().top; });
    return map;
  }

  function renderRanking(prevPos) {
    var list = $('ranking-list');
    if (!list) return;
    var rows = _rank.slice(0, TOP_N);
    var totalEl = $('ranking-total');
    if (totalEl) totalEl.textContent = _rank.reduce(function (n, r) { return n + r.pessoas; }, 0).toLocaleString('pt-BR');

    if (!rows.length) {
      list.innerHTML = '<p class="ranking-empty">Ainda não há indicações.<br>Seja a primeira pessoa a pedir um filme no PingPlay!</p>';
      return;
    }
    var max = rows[0].pessoas || 1;
    list.innerHTML = rows.map(function (r, idx) {
      var pct = Math.max(8, Math.round(r.pessoas / max * 100));
      var badge = idx === 0 ? '<span class="rank-badge top">Mais pedido</span>' : '';
      var pessoasLabel = r.pessoas.toLocaleString('pt-BR');
      return '' +
        '<div class="rank-row" data-mid="' + esc(norm(r.filme)) + '">' +
          '<span class="rank-num" aria-hidden="true">' + String(idx + 1).padStart(2, '0') + '</span>' +
          '<div class="rank-main">' +
            '<div class="rank-titleline"><span class="rank-title">' + esc(r.filme) + '</span>' + badge + '</div>' +
            '<div class="rank-bar" role="img" aria-label="' + esc(r.filme) + ': ' + pessoasLabel + ' ' + (r.pessoas === 1 ? 'pessoa pediu' : 'pessoas pediram') + ', ' + (idx + 1) + 'º lugar"><div class="rank-bar-fill" style="width:' + pct + '%"></div></div>' +
          '</div>' +
          '<span class="rank-votes">' + pessoasLabel + '</span>' +
          '<button type="button" class="btn-quero" data-film="' + esc(r.filme) + '" aria-label="Pedir também o filme ' + esc(r.filme) + '"><span aria-hidden="true">+</span> Quero</button>' +
        '</div>';
    }).join('');

    if (prevPos) {
      requestAnimationFrame(function () {
        list.querySelectorAll('[data-mid]').forEach(function (n) {
          var prev = prevPos[n.dataset.mid];
          if (prev == null) return;
          var dy = prev - n.getBoundingClientRect().top;
          if (dy) {
            n.style.transition = 'none'; n.style.transform = 'translateY(' + dy + 'px)';
            requestAnimationFrame(function () { n.style.transition = 'transform .55s cubic-bezier(.2,.85,.25,1)'; n.style.transform = ''; });
          }
        });
      });
    }
  }

  async function loadRanking() {
    if (!CONFIG.SUPA_READY) { renderRanking(null); return; }
    try {
      var rows = await supabaseRpc('pingplay_ranking', { p_limit: TOP_N });
      _rank = (rows || []).map(function (r) { return { filme: r.filme, pessoas: Number(r.pessoas) || 0 }; });
    } catch (e) { /* mantém o que tem (provável: migração ainda não rodada) */ }
    renderRanking(_rank.length ? null : null);
  }

  // ═══ INDICAR FILME ═══
  // Guarda um filme "pendente" quando a pessoa tenta indicar sem cadastro.
  var _pendingFilm = '';

  function goToCadastro(interesse, filme) {
    if (interesse) { var cb = $('c-int-' + interesse); if (cb) cb.checked = true; }
    if (filme) { var f = $('c-filme'); if (f && !f.value.trim()) f.value = filme; }
    var sec = $('cadastro');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var first = $('c-nome'); if (first) setTimeout(function () { first.focus(); }, 400);
  }

  async function indicarFilme(filme, fromInput) {
    var email = getEmail();
    if (!email) {
      _pendingFilm = filme || '';
      goToCadastro('indicar', filme);
      toast('Faça seu cadastro para indicar o filme.');
      return;
    }
    if (!norm(filme)) return;
    // otimista
    var key = norm(filme);
    var existing = _rank.find(function (r) { return norm(r.filme) === key; });
    var prev = capturePositions();
    if (existing) existing.pessoas += 1; else _rank.push({ filme: filme.trim(), pessoas: 1 });
    _rank.sort(function (a, b) { return b.pessoas - a.pessoas || a.filme.localeCompare(b.filme); });
    renderRanking(prev);
    toast('“' + filme.trim() + '” recebeu seu pedido. Obrigado!');
    announce('Você indicou “' + filme.trim() + '”. Ranking atualizado.');
    if (fromInput) { var q = $('q-filme'); if (q) q.value = ''; }
    if (CONFIG.SUPA_READY) {
      try { await supabaseRpc('pingplay_indicar', { p_email: email, p_filme: filme.trim() }); await loadRanking(); }
      catch (e) {}
    }
  }

  // ═══ CADASTRO ═══
  function clearInvalid(form) {
    form.querySelectorAll('.invalid').forEach(function (n) { n.classList.remove('invalid'); });
    var err = $('cad-error'); if (err) { err.hidden = true; err.textContent = ''; }
  }
  function markInvalid(el) { if (el) el.classList.add('invalid'); }

  async function submitCadastro(e) {
    e.preventDefault();
    var form = $('form-cadastro');
    clearInvalid(form);
    var nome = $('c-nome').value.trim(), email = $('c-email').value.trim(), tel = $('c-tel').value.trim(),
        cidade = $('c-cidade').value.trim(), perfil = $('c-perfil').value.trim(), filme = $('c-filme').value.trim();
    var iTestar = $('c-int-testar').checked, iOculos = $('c-int-oculos').checked, iIndicar = $('c-int-indicar').checked;
    var lgpd = $('c-lgpd').checked;

    var problems = [], firstBad = null;
    function bad(el, msg) { markInvalid(el); problems.push(msg); if (!firstBad) firstBad = el; }
    if (!nome) bad($('c-nome'), 'informe seu nome');
    if (!validEmail(email)) bad($('c-email'), 'informe um e-mail válido');
    if (digits(tel).length < 10) bad($('c-tel'), 'informe um telefone/WhatsApp válido com DDD');
    if (!cidade) bad($('c-cidade'), 'informe sua cidade');
    if (!perfil) bad($('c-perfil'), 'escolha como você se identifica');
    if (!(iTestar || iOculos || iIndicar)) { var fs = form.querySelector('.cad-fieldset'); if (fs) fs.classList.add('invalid'); problems.push('escolha ao menos um interesse'); if (!firstBad) firstBad = $('c-int-testar'); }
    if (!lgpd) { $('c-lgpd').closest('.checkline').classList.add('invalid'); problems.push('é preciso concordar com a Política de Privacidade'); if (!firstBad) firstBad = $('c-lgpd'); }

    if (problems.length) {
      var err = $('cad-error');
      if (err) { err.textContent = 'Revise: ' + problems.join('; ') + '.'; err.hidden = false; }
      if (firstBad) firstBad.focus();
      return;
    }

    var interesses = [];
    if (iTestar) interesses.push('testar');
    if (iOculos) interesses.push('oculos');
    if (iIndicar || filme) interesses.push('indicar');

    // Sucesso na UI
    setIdentity(email, nome);
    form.hidden = true;
    var ok = $('cad-success');
    if (ok) {
      var msg = $('cad-success-msg');
      if (msg) {
        var primeiro = (nome.split(' ')[0] || '');
        primeiro = primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
        msg.textContent = 'Obrigado' + (primeiro ? ', ' + primeiro : '') + '! Recebemos seu cadastro e entraremos em contato em breve.';
      }
      ok.hidden = false; ok.focus();
    }
    announce('Cadastro concluído com sucesso.');

    // Persistência
    var dados = { nome: nome, email: email, telefone: tel, cidade: cidade, perfil: perfil,
                  interesses: interesses.join(', '), filme: filme, lgpd: 'sim' };
    // E-mails (confirmação ao usuário + cópia interna) via função dedicada
    try { fetch('/.netlify/functions/cadastro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }).catch(function () {}); } catch (e) {}
    // Cópia p/ Netlify Forms (best-effort; serve de lista se a detecção estiver ativa)
    netlifyCapture('cadastro-pingplay', dados);
    if (CONFIG.SUPA_READY) {
      try {
        await supabaseRpc('pingplay_upsert_cadastro', {
          p_nome: nome, p_email: email, p_telefone: tel, p_cidade: cidade, p_perfil: perfil,
          p_quer_testar: iTestar, p_quer_oculos: iOculos, p_quer_indicar: (iIndicar || !!filme), p_lgpd: true
        });
      } catch (e2) {}
    }
    // Indicação de filme feita no próprio cadastro (ou a que ficou pendente)
    var toIndic = filme || _pendingFilm;
    if (toIndic) { _pendingFilm = ''; indicarFilme(toIndic, false); }
  }

  // ═══ INIT ═══
  document.addEventListener('DOMContentLoaded', function () {
    renderRanking(null);
    loadRanking();

    var fc = $('form-cadastro'); if (fc) fc.addEventListener('submit', submitCadastro);

    var tel = $('c-tel');
    if (tel) tel.addEventListener('input', function () { var p = tel.selectionStart === tel.value.length; tel.value = maskTel(tel.value); });

    // Limpa marcação de erro ao corrigir
    ['c-nome', 'c-email', 'c-tel', 'c-cidade', 'c-perfil', 'c-lgpd'].forEach(function (id) {
      var el = $(id); if (el) el.addEventListener('input', function () { el.classList.remove('invalid'); var l = el.closest('.checkline'); if (l) l.classList.remove('invalid'); });
    });
    ['c-int-testar', 'c-int-oculos', 'c-int-indicar'].forEach(function (id) {
      var el = $(id); if (el) el.addEventListener('change', function () { var fs = el.closest('.cad-fieldset'); if (fs) fs.classList.remove('invalid'); });
    });

    // Form de indicação (#QueroNoPingPlay)
    var fi = $('form-indicar');
    if (fi) fi.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('q-filme'), err = $('q-error');
      if (err) { err.hidden = true; err.textContent = ''; }
      var v = (q.value || '').trim();
      if (!v) { if (err) { err.hidden = false; err.textContent = 'Digite o nome do filme.'; } q.focus(); return; }
      indicarFilme(v, true);
    });

    // "+ Quero" nas linhas do ranking
    var list = $('ranking-list');
    if (list) list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-film]');
      if (b) indicarFilme(b.getAttribute('data-film'), false);
    });

    // CTAs que rolam até o cadastro e marcam o interesse
    document.querySelectorAll('.cta-cadastro').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (b.tagName === 'A') e.preventDefault();
        goToCadastro(b.getAttribute('data-interesse'), '');
      });
    });

    // "Já cadastrado neste aparelho": mostra dica no form de indicação
    if (getEmail()) { var note = $('q-note'); if (note) note.textContent = 'Indique quantos filmes quiser. Cliques repetidos no mesmo filme contam uma vez só.'; }

    if (CONFIG.SUPA_READY) setInterval(loadRanking, 20000);
  });
})();
