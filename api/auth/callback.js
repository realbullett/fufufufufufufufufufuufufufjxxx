'use strict';
const crypto = require('crypto');
const { Verify, RedirectUri, DiscordExchange } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  const Q = new URL(Req.url, 'http://x').searchParams;
  const Code = Q.get('code');
  const State = Q.get('state');
  const M = String(Req.headers.cookie || '').match(/oxygen_state=([^;]+)/);
  const Saved = M ? decodeURIComponent(M[1]) : null;
  if (!Code || !State || State !== Saved) { Res.writeHead(302, { Location: '/app?auth=failed' }); Res.end(); return; }
  const S = Verify(State) || {};
  try {
    const { Tok, User } = await DiscordExchange(Code, RedirectUri(Req));
    const Now = Date.now();
    await Db.execute({
      sql: `insert into users (discord_id, username, global_name, avatar, access_token, refresh_token, expires_at, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(discord_id) do update set
              username = excluded.username,
              global_name = excluded.global_name,
              avatar = excluded.avatar,
              access_token = excluded.access_token,
              refresh_token = excluded.refresh_token,
              expires_at = excluded.expires_at,
              updated_at = excluded.updated_at`,
      args: [User.id, User.username || '', User.global_name || '', User.avatar || '', Tok.access_token, Tok.refresh_token || '', Now + (Tok.expires_in || 604800) * 1000, Now, Now],
    });
    if (S.p) {
      const AgentToken = require('../../lib/auth').Sign({ d: User.id, a: crypto.randomUUID(), k: 'agent', exp: Now + 365 * 864e5 });
      Res.writeHead(302, { Location: `http://127.0.0.1:${S.p}/#connect=${AgentToken}` });
      Res.end();
      return;
    }
    const Session = require('../../lib/auth').Sign({ d: User.id, name: User.global_name || User.username, avatar: User.avatar || '', exp: Now + 30 * 864e5 });
    Res.writeHead(302, {
      Location: '/app',
      'Set-Cookie': [
        'oxygen_session=' + encodeURIComponent(Session) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + 30 * 86400,
        'oxygen_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      ],
    });
    Res.end();
  } catch (E) {
    Res.writeHead(302, { Location: '/app?auth=failed' });
    Res.end();
  }
};
