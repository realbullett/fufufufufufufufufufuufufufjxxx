'use strict';
const { Verify, Json } = require('../../lib/auth');
const Db = require('../../lib/db');

function AgentOf(Req) {
  const H = String(Req.headers.authorization || '');
  if (!H.startsWith('Bearer ')) return null;
  const S = Verify(H.slice(7).trim());
  return S && S.k === 'agent' && S.d && S.a ? S : null;
}

module.exports = { AgentOf };
