'use strict';
const { SessionOf, Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  const S = SessionOf(Req);
  if (!S) { Json(Res, 200, { authed: false, user: null }); return; }
  const R = await Db.execute({ sql: 'select discord_id, username, global_name, avatar from users where discord_id = ?', args: [S.d] });
  const U = R.rows[0];
  Json(Res, 200, { authed: true, user: U ? { id: U.discord_id, name: U.global_name || U.username, avatar: U.avatar } : { id: S.d, name: S.name, avatar: S.avatar } });
};
