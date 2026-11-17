'use strict';
const { createClient } = require('@libsql/client');

const Db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

module.exports = Db;
