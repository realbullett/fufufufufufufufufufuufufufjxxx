'use strict';
const { SessionOf, Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  const S = SessionOf(Req);
  if (!S) { Json(Res, 401, { error: 'not signed in' }); return; }
  const R = await Db.execute({ sql: 'select id, name, status, last_seen, created_at from agents where discord_id = ? order by created_at desc', args: [S.d] });
  Json(Res, 200, { agents: R.rows.map((Row) => ({ id: Row.id, name: Row.name, status: Row.status, lastSeen: Row.last_seen, createdAt: Row.created_at })) });
};
