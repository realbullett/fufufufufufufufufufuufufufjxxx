'use strict';
const crypto = require('crypto');
const { Sign, Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  if (Req.method !== 'POST') { Json(Res, 405, { error: 'post only' }); return; }
  let Body = {};
  try { Body = JSON.parse(await new Promise((Ok, No) => { let D = ''; Req.on('data', (C) => D += C); Req.on('end', () => Ok(D || '{}')); Req.on('error', No); })); } catch {}
  const Code = String(Body.code || '').toUpperCase().trim();
  if (!Code) { Json(Res, 400, { error: 'code required' }); return; }
  const R = await Db.execute({ sql: 'select code, discord_id, expires_at, used from pairings where code = ?', args: [Code] });
  const Row = R.rows[0];
  if (!Row || Row.used || Row.expires_at < Date.now()) { Json(Res, 400, { error: 'invalid or expired code' }); return; }
  await Db.execute({ sql: 'update pairings set used = 1 where code = ?', args: [Code] });
  const AgentToken = Sign({ d: Row.discord_id, a: crypto.randomUUID(), k: 'agent', exp: Date.now() + 365 * 864e5 });
  Json(Res, 200, { ok: true, token: AgentToken });
};
