'use strict';
const crypto = require('crypto');
const { SessionOf, Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  const S = SessionOf(Req);
  if (!S) { Json(Res, 401, { error: 'not signed in' }); return; }
  const Code = crypto.randomBytes(3).toString('hex').toUpperCase().padStart(6, '0');
  const Now = Date.now();
  await Db.execute({ sql: 'insert into pairings (code, discord_id, created_at, expires_at) values (?, ?, ?, ?)', args: [Code, S.d, Now, Now + 10 * 60000] });
  Json(Res, 200, { code: Code, expiresAt: Now + 10 * 60000 });
};
