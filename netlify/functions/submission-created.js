// ── submission-created — e-mails do cadastro PingPlay (Microsoft 365 / Graph) ──
// Função de EVENTO do Netlify: roda sozinha a cada envio de formulário Netlify.
// No formulário 'cadastro-pingplay' envia:
//   1) e-mail de confirmação para a pessoa que se cadastrou (marca PingPlay);
//   2) cópia interna com TODOS os dados para o time.
// Envia via Microsoft Graph (OAuth client credentials) usando o Microsoft 365 da
// ETC Filmes — sem custo de terceiros e com caixa que recebe respostas.
//
// Variáveis de ambiente (Netlify → Site configuration → Environment variables):
//   MS_TENANT_ID     ID do tenant (Entra ID / Azure AD) da ETC Filmes
//   MS_CLIENT_ID     Application (client) ID do app registrado
//   MS_CLIENT_SECRET Client secret do app
//   MS_SENDER        caixa remetente (UPN/e-mail), ex.: contato@queronopingplay.com
//                    (precisa ser uma caixa real no M365 — pode ser shared mailbox)
//   PP_MAIL_TO       destinos da cópia interna (vírgula). Default: cassio@ /
//                    daniella.leal@ / renato.azevedo@ etcfilmes.com.br
//   PP_REPLY_TO      (opcional) reply-to do e-mail de confirmação ao usuário
//
// O app precisa da permissão de APLICAÇÃO `Mail.Send` (com consentimento do admin).
// Recomendado restringir a caixa via Application Access Policy (ver README).

const TENANT   = process.env.MS_TENANT_ID || '';
const CLIENT   = process.env.MS_CLIENT_ID || '';
const SECRET   = process.env.MS_CLIENT_SECRET || '';
const SENDER   = process.env.MS_SENDER || '';
const TEAM     = (process.env.PP_MAIL_TO || 'cassio@etcfilmes.com.br, daniella.leal@etcfilmes.com.br, renato.azevedo@etcfilmes.com.br')
                   .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const REPLY_TO = process.env.PP_REPLY_TO || '';
const SITE_URL = 'https://queronopingplay.com';
const LOGO     = SITE_URL + '/assets/pingplay-logo-white.png';

function firstName(n) { return n ? String(n).trim().split(/\s+/)[0] : ''; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function recips(list) { return list.map(function (a) { return { emailAddress: { address: a } }; }); }

async function graphToken() {
  const body = 'client_id=' + encodeURIComponent(CLIENT) +
    '&client_secret=' + encodeURIComponent(SECRET) +
    '&scope=' + encodeURIComponent('https://graph.microsoft.com/.default') +
    '&grant_type=client_credentials';
  const r = await fetch('https://login.microsoftonline.com/' + encodeURIComponent(TENANT) + '/oauth2/v2.0/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body,
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) { console.error('[pingplay-mail] token HTTP ' + r.status + ': ' + JSON.stringify(j)); return ''; }
  return j.access_token || '';
}

async function sendMail(token, msg) {
  try {
    const r = await fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(SENDER) + '/sendMail', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, saveToSentItems: false }),
    });
    if (!r.ok) console.error('[pingplay-mail] sendMail HTTP ' + r.status + ': ' + (await r.text()));
    return r.ok;
  } catch (e) { console.error('[pingplay-mail] erro: ' + e.message); return false; }
}

function welcomeHtml(nome) {
  const ola = nome ? 'Olá, ' + esc(nome) + '!' : 'Olá!';
  return '<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:0;background:#F1ECF9;font-family:Arial,Helvetica,sans-serif;color:#231542;">' +
    '<div style="max-width:560px;margin:0 auto;padding:24px 16px;">' +
      '<div style="text-align:center;padding:6px 0 18px;">' +
        '<a href="' + SITE_URL + '"><img src="' + LOGO + '" alt="PingPlay" width="170" style="max-width:58%;height:auto;border:0;display:inline-block;"></a>' +
      '</div>' +
      '<div style="background:#583192;border-radius:14px 14px 0 0;padding:28px 28px 22px;">' +
        '<h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.25;">Recebemos o seu cadastro!</h1>' +
      '</div>' +
      '<div style="background:#ffffff;border:1px solid #E4DAF3;border-top:none;border-radius:0 0 14px 14px;padding:28px;">' +
        '<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">' + ola + '</p>' +
        '<p style="font-size:15px;line-height:1.7;margin:0 0 16px;color:#4F5151;">Que bom ter você com a gente! O <strong>PingPlay</strong> leva legenda, Libras e audiodescrição para <strong>dentro da experiência</strong> do cinema — a acessibilidade que cada pessoa controla do seu jeito.</p>' +
        '<p style="font-size:15px;line-height:1.7;margin:0 0 16px;color:#4F5151;">Seu cadastro foi registrado com sucesso. <strong>Em breve entraremos em contato</strong> com as próximas informações, de acordo com os interesses que você escolheu.</p>' +
        '<p style="text-align:center;margin:26px 0 22px;">' +
          '<a href="' + SITE_URL + '" style="background:#40C4F1;color:#0E1516;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px;display:inline-block;">Voltar ao PingPlay</a>' +
        '</p>' +
        '<p style="font-size:13px;line-height:1.6;margin:0;color:#8A9393;border-top:1px solid #EDEBE6;padding-top:16px;">Você recebeu este e-mail porque se cadastrou em <a href="' + SITE_URL + '" style="color:#583192;">queronopingplay.com</a>. Se não quiser mais receber nossos contatos, é só responder este e-mail avisando.</p>' +
      '</div>' +
      '<p style="text-align:center;font-size:12px;color:#8A9393;margin:16px 0 0;">Uma iniciativa ETC Filmes · Acessibilidade audiovisual de verdade.</p>' +
    '</div></body></html>';
}

function teamHtml(d) {
  const rows = [
    ['Nome', d.nome], ['E-mail', d.email], ['Telefone/WhatsApp', d.telefone],
    ['Cidade', d.cidade], ['Identifica-se como', d.perfil], ['Interesses', d.interesses],
    ['Filme indicado', d.filme], ['Consentimento LGPD', d.lgpd],
  ].map(function (r) {
    return '<tr><td style="padding:9px 12px;border:1px solid #E4DAF3;background:#F7F5FB;font-weight:bold;white-space:nowrap;">' + esc(r[0]) + '</td>' +
           '<td style="padding:9px 12px;border:1px solid #E4DAF3;">' + (esc(r[1]) || '<span style="color:#999;">—</span>') + '</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;color:#231542;background:#ffffff;">' +
    '<h2 style="margin:0 0 4px;color:#583192;">Novo cadastro no PingPlay</h2>' +
    '<p style="margin:0 0 16px;color:#8A9393;font-size:13px;">Cópia automática do cadastro em queronopingplay.com. Responda este e-mail para falar direto com a pessoa.</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:620px;font-size:14px;">' + rows + '</table>' +
    '</body></html>';
}

exports.handler = async function (event) {
  let payload = {};
  try { payload = (JSON.parse(event.body || '{}').payload) || {}; }
  catch (e) { return { statusCode: 200, body: 'json inválido' }; }

  if ((payload.form_name || '') !== 'cadastro-pingplay') return { statusCode: 200, body: 'form ignorado' };
  if (!TENANT || !CLIENT || !SECRET || !SENDER) {
    console.warn('[pingplay-mail] variáveis do Microsoft Graph ausentes');
    return { statusCode: 200, body: 'config Graph ausente' };
  }

  const token = await graphToken();
  if (!token) return { statusCode: 200, body: 'sem token' };

  const d = payload.data || {};
  const email = (d.email || '').trim();

  // 1) Confirmação para quem se cadastrou
  if (email) {
    const msg = {
      subject: 'Recebemos o seu cadastro no PingPlay',
      body: { contentType: 'HTML', content: welcomeHtml(firstName(d.nome)) },
      toRecipients: recips([email]),
    };
    if (REPLY_TO) msg.replyTo = recips([REPLY_TO]);
    await sendMail(token, msg);
  }

  // 2) Cópia interna para o time (com todos os dados)
  if (TEAM.length) {
    const msg = {
      subject: 'Novo cadastro PingPlay: ' + (d.nome || email || '—'),
      body: { contentType: 'HTML', content: teamHtml(d) },
      toRecipients: recips(TEAM),
    };
    if (email) msg.replyTo = recips([email]);
    await sendMail(token, msg);
  }

  return { statusCode: 200, body: 'ok' };
};
