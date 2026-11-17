'use strict';
const crypto = require('crypto');
const { Sign, Verify, Cookie, Redirect, DiscordAuthorizeUrl } = require('../../lib/auth');

module.exports = async (Req, Res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    Res.statusCode = 500;
    Res.setHeader('Content-Type', 'text/plain');
    Res.end('discord sign-in is not configured');
    return;
  }
  const Port = String(new URL(Req.url, 'http://x').searchParams.get('port') || '').replace(/\D/g, '');
  const Signed = Sign({ s: crypto.randomBytes(16).toString('hex'), p: Port || undefined });
  Redirect(Res, DiscordAuthorizeUrl(Req, Signed), Cookie('oxygen_state', Signed, 600));
};
