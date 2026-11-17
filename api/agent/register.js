'use strict';
const { AgentOf } = require('../../lib/agent');
const { Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  try {
  const A = AgentOf(Req);
  if (!A) { Json(Res, 401, { error: 'bad agent token' }); return; }
  if (Req.method !== 'POST') { Json(Res, 405, { error: 'post only' }); return; }
  let Body = {};
  try { Body = JSON.parse(await new Promise((Ok, No) => { let D = ''; Req.on('data', (C) => D += C); Req.on('end', () => Ok(D || '{}')); Req.on('error', No); })); } catch {}
  const Now = Date.now();
  await Db.execute({
    sql: `insert into agents (id, discord_id, name, created_at, last_seen, status)
          values (?, ?, ?, ?, ?, 'online')
          on conflict(id) do update set
            name = case when excluded.name != '' then excluded.name else agents.name end,
            last_seen = excluded.last_seen,
            status = 'online'`,
    args: [A.a, A.d, String(Body.name || '').slice(0, 80), Now, Now],
  });
  const R = await Db.execute({ sql: 'select id, name, status, last_seen from agents where id = ?', args: [A.a] });
  const Row = R.rows[0];
  Json(Res, 200, { ok: true, agent: Row ? { id: Row.id, name: Row.name, status: Row.status, lastSeen: Row.last_seen } : null });
  } catch (E) { Json(Res, 500, { error: String(E && E.message || E) }); }
};