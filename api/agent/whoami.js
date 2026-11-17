'use strict';
const { AgentOf } = require('../../lib/agent');
const { Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  try {
  const A = AgentOf(Req);
  if (!A) { Json(Res, 401, { error: 'bad agent token' }); return; }
  const R = await Db.execute({ sql: 'select discord_id, username, global_name, avatar from users where discord_id = ?', args: [A.d] });
  const Row = R.rows[0];
  Json(Res, 200, { user: Row ? { id: Row.discord_id, name: Row.global_name || Row.username, avatar: Row.avatar, username: Row.username } : null });
  } catch (E) { Json(Res, 500, { error: String(E && E.message || E) }); }
};