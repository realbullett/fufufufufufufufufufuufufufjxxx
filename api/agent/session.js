'use strict';
const { AgentOf } = require('../../lib/agent');
const { Sign, Verify, Cookie, Redirect, Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  try {
  const Qt = new URL(Req.url, 'https://oxygen.local').searchParams.get('t') || '';
  const H = AgentOf(Req);
  const Q = !H && Qt ? Verify(Qt) : null;
  const A = H || Q;
  if (!A || A.k !== 'agent' || !A.d || !A.a) { Json(Res, 401, { error: 'bad agent token' }); return; }
  const R = await Db.execute({ sql: 'select discord_id, username, global_name, avatar from users where discord_id = ?', args: [A.d] });
  const Row = R.rows[0];
  const C = Cookie('oxygen_session', Sign({ d: A.d, name: Row ? (Row.global_name || Row.username) : '', avatar: Row ? (Row.avatar || '') : '', exp: Date.now() + 30 * 864e5 }), 30 * 86400);
  Redirect(Res, '/app?t=' + encodeURIComponent(Qt), C);
  } catch (E) { Json(Res, 500, { error: String(E && E.message || E) }); }
};