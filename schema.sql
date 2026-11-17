-- Oxygen: discord accounts + desktop agents
create table if not exists users (
  discord_id    text primary key,
  username      text,
  global_name   text,
  avatar        text,
  access_token  text,
  refresh_token text,
  expires_at    integer,
  created_at    integer not null,
  updated_at    integer not null
);

create table if not exists agents (
  id         text primary key,
  discord_id text not null,
  name       text,
  created_at integer not null,
  last_seen  integer not null,
  status     text not null default 'offline'
);
create index if not exists agents_discord_idx on agents (discord_id);

create table if not exists pairings (
  code        text primary key,
  discord_id  text not null,
  created_at  integer not null,
  expires_at  integer not null,
  used        integer not null default 0
);
