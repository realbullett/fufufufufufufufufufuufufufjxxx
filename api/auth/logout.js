'use strict';
const { Json } = require('../../lib/auth');

module.exports = async (Req, Res) => {
  Json(Res, 200, { ok: true }, { 'Set-Cookie': 'oxygen_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
};
