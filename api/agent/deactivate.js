'use strict';
const { AgentOf } = require('../../lib/agent');
const { Json } = require('../../lib/auth');
const Db = require('../../lib/db');

module.exports = async (Req, Res) => {
  const A = AgentOf(Req);
  if (!A) { Json(Res, 401, { error: 'bad agent token' }); return; }
  await Db.execute({ sql: 'delete from agents where id = ?', args: [A.a] });
  Json(Res, 200, { ok: true });
};
