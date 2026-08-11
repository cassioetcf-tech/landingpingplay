// ── cadastro — e-mails do cadastro PingPlay (SMTP / Microsoft 365) ────────────
// Função HTTP chamada DIRETO pelo front (POST /.netlify/functions/cadastro) após
// o cadastro. Envia:
//   1) e-mail de confirmação para a pessoa que se cadastrou (marca PingPlay);
//   2) cópia interna com TODOS os dados para o time.
// Via SMTP autenticado pela caixa contato@pingplay.com.br (Microsoft 365).
// Independente do Netlify Forms.
//
// Variáveis de ambiente (Netlify → Site configuration → Environment variables):
//   SMTP_USER  contato@pingplay.com.br   · SMTP_PASS  senha da caixa
//   SMTP_HOST  default smtp.office365.com · SMTP_PORT  default 587
//   PP_MAIL_FROM  default "PingPlay <SMTP_USER>"
//   PP_MAIL_TO    cópia interna (vírgula). Default: cassio@/daniella.leal@/renato.azevedo@etcfilmes.com.br
//   PP_REPLY_TO   (opcional) reply-to do e-mail de confirmação
//
// ⚠️ A caixa precisa estar com "Authenticated SMTP" habilitado no M365.

const nodemailer = require('nodemailer');

const HOST     = process.env.SMTP_HOST || 'smtp.office365.com';
const PORT     = parseInt(process.env.SMTP_PORT || '587', 10);
const USER     = process.env.SMTP_USER || '';
const PASS     = process.env.SMTP_PASS || '';
const FROM     = process.env.PP_MAIL_FROM || ('PingPlay <' + (USER || 'contato@pingplay.com.br') + '>');
const TEAM     = (process.env.PP_MAIL_TO || 'cassio@etcfilmes.com.br, daniella.leal@etcfilmes.com.br, renato.azevedo@etcfilmes.com.br')
                   .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const REPLY_TO = process.env.PP_REPLY_TO || '';
const SITE_URL = 'https://queronopingplay.com';
const LOGO     = SITE_URL + '/assets/pingplay-logo.png';

function firstName(n) { return n ? String(n).trim().split(/\s+/)[0] : ''; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim()); }

let _tx = null;
function transport() {
  if (_tx) return _tx;
  _tx = nodemailer.createTransport({
    host: HOST, port: PORT, secure: PORT === 465, requireTLS: PORT === 587,
    auth: { user: USER, pass: PASS },
  });
  return _tx;
}
async function send(msg) {
  try { await transport().sendMail(msg); return { ok: true }; }
  catch (e) { console.error('[pingplay-mail] SMTP erro: ' + e.message); return { ok: false, error: e.message }; }
}

function welcomeHtml(nome) {
  const ola = nome ? 'Olá, ' + esc(nome) + '!' : 'Olá!';
  return '<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:0;background:#F1ECF9;font-family:Arial,Helvetica,sans-serif;color:#231542;">' +
    '<div style="max-width:560px;margin:0 auto;padding:24px 16px;">' +
      '<div style="text-align:center;padding:6px 0 18px;">' +
        '<a href="' + SITE_URL + '" style="display:inline-block;background:#ffffff;border-radius:12px;padding:14px 20px;text-decoration:none;"><img src="' + LOGO + '" alt="PingPlay" width="170" style="width:170px;max-width:60vw;height:auto;border:0;display:block;"></a>' +
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
function welcomeText(nome) {
  const ola = nome ? 'Olá, ' + nome + '!' : 'Olá!';
  return ola + '\n\nRecebemos o seu cadastro no PingPlay com sucesso. Em breve entraremos em contato com as próximas informações, de acordo com os interesses que você escolheu.\n\n' +
    'O PingPlay leva legenda, Libras e audiodescrição para dentro da experiência do cinema.\n\n' + SITE_URL + '\n\n' +
    'Você recebeu este e-mail porque se cadastrou em queronopingplay.com. Se não quiser mais receber, responda este e-mail avisando.';
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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: 'json inválido' }; }

  // Honeypot anti-spam (o front nunca preenche)
  if (d.hp) return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'hp' }) };

  const email = (d.email || '').trim();
  if (!validEmail(email)) return { statusCode: 400, body: JSON.stringify({ ok: false, reason: 'email' }) };

  if (!USER || !PASS) { console.warn('[pingplay-mail] SMTP_USER/SMTP_PASS ausentes'); return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'smtp-config' }) }; }

  // 1) Confirmação para quem se cadastrou
  const wc = { from: FROM, to: email, subject: 'Recebemos o seu cadastro no PingPlay', html: welcomeHtml(firstName(d.nome)), text: welcomeText(firstName(d.nome)) };
  if (REPLY_TO) wc.replyTo = REPLY_TO;
  const rUser = await send(wc);

  // 2) Cópia interna para o time
  let rTeam = { ok: true };
  if (TEAM.length) {
    const tc = { from: FROM, to: TEAM.join(', '), subject: 'Novo cadastro PingPlay: ' + (d.nome || email || '—'), html: teamHtml(d), replyTo: email };
    rTeam = await send(tc);
  }

  const out = { ok: rUser.ok && rTeam.ok };
  if (d.debug) out.error = rUser.error || rTeam.error || null; // detalhe só quando pedido explicitamente
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
};
