'use strict';
const crypto = require('crypto');

const Secret = process.env.OXYGEN_SECRET || 'dev-insecure-secret';
const DiscordId = process.env.DISCORD_CLIENT_ID || '';
const DiscordSecret = process.env.DISCORD_CLIENT_SECRET || '';

function Sign(Payload) {
  const B = Buffer.from(JSON.stringify(Payload)).toString('base64url');
  return B + '.' + crypto.createHmac('sha256', Secret).update(B).digest('base64url');
}

function Verify(Token) {
  if (!Token) return null;
  const I = Token.lastIndexOf('.');
  if (I < 1) return null;
  const B = Token.slice(0, I);
  if (crypto.createHmac('sha256', Secret).update(B).digest('base64url') !== Token.slice(I + 1)) return null;
  try {
    const S = JSON.parse(Buffer.from(B, 'base64url').toString('utf8'));
    if (S.exp && S.exp < Date.now()) return null;
    return S;
  } catch { return null; }
}

function ReadCookie(Req, Name) {
  const M = String(Req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + Name + '=([^;]+)'));
  return M ? decodeURIComponent(M[1]) : null;
}

function SessionOf(Req) {
  const Raw = ReadCookie(Req, 'oxygen_session');
  const S = Verify(Raw);
  return S && S.d ? S : null;
}

function Cookie(Name, Value, MaxAge) {
  return `${Name}=${encodeURIComponent(Value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MaxAge}`;
}

function Json(Res, Code, Body, Headers) {
  Res.statusCode = Code;
  Res.setHeader('Content-Type', 'application/json');
  Res.setHeader('Cache-Control', 'no-store');
  for (const K in (Headers || {})) Res.setHeader(K, Headers[K]);
  Res.end(JSON.stringify(Body));
}

function Redirect(Res, Location, CookieHeader) {
  const H = { Location };
  if (CookieHeader) H['Set-Cookie'] = CookieHeader;
  Res.writeHead(302, H);
  Res.end();
}

function RedirectUri(Req) {
  return process.env.DISCORD_REDIRECT_URI || `https://${Req.headers.host}/api/auth/callback`;
}

function DiscordAuthorizeUrl(Req, State) {
  return 'https://discord.com/oauth2/authorize?client_id=' + encodeURIComponent(DiscordId) +
    '&response_type=code&scope=identify&state=' + encodeURIComponent(State) +
    '&redirect_uri=' + encodeURIComponent(RedirectUri(Req));
}

async function DiscordExchange(Code, RedirectUri) {
  const Res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DiscordId,
      client_secret: DiscordSecret,
      grant_type: 'authorization_code',
      code: Code,
      redirect_uri: RedirectUri,
    }).toString(),
  });
  const Tok = await Res.json();
  if (!Tok.access_token) throw new Error(Tok.error_description || 'token exchange failed');
  const URes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + Tok.access_token } });
  const User = await URes.json();
  if (!User.id) throw new Error('discord user lookup failed');
  return { Tok, User };
}

module.exports = { Sign, Verify, ReadCookie, SessionOf, Cookie, Json, Redirect, RedirectUri, DiscordAuthorizeUrl, DiscordExchange };
