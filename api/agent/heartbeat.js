'use strict';
const { AgentOf } = require('../../lib/agent');
const { Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  const A = AgentOf(Req);
  if (!A) { Json(Res, 401, { error: 'bad agent token' }); return; }
  await Db.execute({ sql: "update agents set last_seen = ?, status = 'online' where id = ?", args: [Date.now(), A.a] });
  Json(Res, 200, { ok: true });
};
