// ── SUPABASE REST WRAPPER ─────────────────────────────────────────────────────
// Depende de: js/config.js (CONFIG.SUPA_URL, CONFIG.SUPA_KEY)

function _supaHeaders(extra) {
  var h = {
    'apikey': CONFIG.SUPA_KEY,
    'Authorization': 'Bearer ' + CONFIG.SUPA_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  return Object.assign(h, extra || {});
}

// GET /rest/v1/{table}?{query}
async function supabaseGet(table, query) {
  var url = CONFIG.SUPA_URL + '/rest/v1/' + table + (query ? '?' + query : '');
  var r = await fetch(url, { headers: _supaHeaders() });
  if (!r.ok) throw new Error('Supabase GET ' + table + ' HTTP ' + r.status);
  return r.json();
}

// POST /rest/v1/{table}
async function supabasePost(table, body, prefer) {
  var url = CONFIG.SUPA_URL + '/rest/v1/' + table;
  var headers = _supaHeaders(prefer ? { 'Prefer': prefer } : {});
  var r = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) });
  if (!r.ok) { var msg = await r.text(); throw new Error('Supabase POST ' + table + ' HTTP ' + r.status + ': ' + msg); }
  var text = await r.text();
  return text ? JSON.parse(text) : null;
}

// POST /rest/v1/rpc/{fn} — chama uma função (RPC) do Postgres.
async function supabaseRpc(fn, params) {
  var url = CONFIG.SUPA_URL + '/rest/v1/rpc/' + fn;
  var r = await fetch(url, { method: 'POST', headers: _supaHeaders(), body: JSON.stringify(params || {}) });
  if (!r.ok) { var msg = await r.text(); throw new Error('Supabase RPC ' + fn + ' HTTP ' + r.status + ': ' + msg); }
  var text = await r.text();
  return text ? JSON.parse(text) : null;
}
