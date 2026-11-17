(function () {
  window.__VULNER_WEB__ = true;

  var ServedByAgent = (location.hostname === '127.0.0.1' || location.hostname === 'localhost') && !!location.port;
  var DefaultHost = ServedByAgent ? location.host : '127.0.0.1:4870';
  var Host = localStorage.getItem('vulner.agent') || DefaultHost;
  var UrlToken = new URLSearchParams(location.search).get('t');
  if (UrlToken) { try { localStorage.setItem('vulner.token', UrlToken); } catch (E) {} }
  var Token = UrlToken || localStorage.getItem('vulner.token') || '';

  var Socket = null;
  var Open = false;
  var Seq = 0;
  var Pending = new Map();
  var ChatListeners = [];
  var TermListeners = [];
  var WebListeners = [];
  var WinListeners = [];
  var StatusListeners = [];
  var ReconnectDelay = 500;
  var ManualClose = false;

  var Timeouts = { 'ide:addFolder': 600000, 'meta:models': 60000, 'meta:mcp': 180000, 'chat:bg': 30000 };

  function wsUrl() {
    var Proto = (location.protocol === 'https:' && !/^(127\.0\.0\.1|localhost|\[::1\])(:|$)/.test(Host)) ? 'wss:' : 'ws:';
    return Proto + '//' + Host + '/ws?t=' + encodeURIComponent(Token);
  }

  function notifyStatus(State, Detail) {
    StatusListeners.forEach(function (Cb) { try { Cb(State, Detail); } catch (E) {} });
    var El = document.getElementById('vulner-pair');
    if (!El) return;
    if (State === 'open') { El.classList.remove('show'); return; }
    El.classList.add('show');
    var Note = El.querySelector('[data-note]');
    if (Note) Note.textContent = Detail || (State === 'unauthorized' ? 'sign in with the oxygen desktop app' : State === 'closed' ? 'agent not reachable' : 'connecting…');
    var Btn = El.querySelector('button');
    if (Btn) Btn.disabled = State === 'connecting';
  }

  function connect() {
    if (Socket && (Socket.readyState === 0 || Socket.readyState === 1)) return;
    if (!Token && !ServedByAgent) { notifyStatus('closed', 'sign in with the oxygen desktop app'); return; }
    notifyStatus('connecting');
    try { Socket = new WebSocket(wsUrl()); }
    catch (E) { notifyStatus('closed', 'bad agent address'); return; }
    Socket.onopen = function () {
      Open = true;
      ReconnectDelay = 500;
      localStorage.setItem('vulner.agent', Host);
      localStorage.setItem('vulner.token', Token);
      notifyStatus('open');
    };
    Socket.onmessage = function (Ev) {
      var Msg;
      try { Msg = JSON.parse(Ev.data); } catch (E) { return; }
      if (Msg.t === 'res') {
        var P = Pending.get(Msg.id);
        if (!P) return;
        Pending.delete(Msg.id);
        clearTimeout(P.timer);
        if (Msg.ok) P.resolve(Msg.result);
        else P.reject(new Error(Msg.error || 'agent error'));
        return;
      }
      if (Msg.t !== 'ev') return;
      var Data = Msg.data;
      if (Msg.ch === 'chat') ChatListeners.forEach(function (Cb) { try { Cb(Data); } catch (E) {} });
      else if (Msg.ch === 'term') TermListeners.forEach(function (Cb) { try { Cb(Data); } catch (E) {} });
      else if (Msg.ch === 'agent-web') WebListeners.forEach(function (Cb) { try { Cb(Data); } catch (E) {} });
      else if (Msg.ch === 'sys') {
        if (Data && Data.type === 'unauthorized') {
          ManualClose = true;
          notifyStatus('unauthorized');
        }
      }
    };
    Socket.onclose = function (Ev) {
      Open = false;
      if (Ev && Ev.code === 4001) { ManualClose = true; notifyStatus('unauthorized'); }
      Pending.forEach(function (P) { clearTimeout(P.timer); P.reject(new Error('agent disconnected')); });
      Pending.clear();
      if (ManualClose) return;
      notifyStatus('closed');
      setTimeout(connect, ReconnectDelay);
      ReconnectDelay = Math.min(ReconnectDelay * 2, 5000);
    };
    Socket.onerror = function () {};
  }

  function call(Method, Args) {
    return new Promise(function (Resolve, Reject) {
      if (!Socket || Socket.readyState !== 1) {
        if (!Socket || Socket.readyState > 1) connect();
        Reject(new Error('agent is not connected'));
        return;
      }
      var Id = ++Seq;
      var Wait = Timeouts[Method] || 30000;
      var Timer = setTimeout(function () {
        Pending.delete(Id);
        Reject(new Error(Method + ' timed out'));
      }, Wait);
      Pending.set(Id, { resolve: Resolve, reject: Reject, timer: Timer });
      Socket.send(JSON.stringify({ t: 'req', id: Id, method: Method, args: Args || [] }));
    });
  }

  function addListener(Arr) {
    return function (Cb) {
      Arr.push(Cb);
      return function () {
        var I = Arr.indexOf(Cb);
        if (I !== -1) Arr.splice(I, 1);
      };
    };
  }

  function readClipboardImage() {
    if (!navigator.clipboard || !navigator.clipboard.read) return Promise.resolve(null);
    return navigator.clipboard.read().then(function (Items) {
      for (var I = 0; I < Items.length; I++) {
        var Type = (Items[I].types || []).find(function (T) { return T.indexOf('image/') === 0; });
        if (!Type) continue;
        return Items[I].getType(Type).then(function (Blob) {
          return new Promise(function (Resolve) {
            var Reader = new FileReader();
            Reader.onload = function () { Resolve(Reader.result); };
            Reader.onerror = function () { Resolve(null); };
            Reader.readAsDataURL(Blob);
          });
        });
      }
      return null;
    }).catch(function () { return null; });
  }

  window.vulner = {
    send: function (Text, Image) { return call('chat:send', [Text, Image]); },
    readImage: readClipboardImage,
    bgSend: function (Title, Prompt) { return call('chat:bg', [Title, Prompt]); },
    gateState: function () { return call('gate:state'); },
    bgStop: function (BgId) { return call('chat:bgstop', [BgId]); },
    memRead: function () { return call('mem:read'); },
    memSave: function (Text) { return call('mem:save', [Text]); },
    stop: function () { return call('chat:stop'); },
    continue: function () { return call('chat:continue'); },
    newChat: function () { return call('chat:new'); },
    listSessions: function () { return call('chat:list'); },
    restoreSession: function (Id) { return call('chat:restore', [Id]); },
    restorePoint: function (Id, Turn, Mode) { return call('chat:restorePoint', [Id, Turn, Mode]); },
    deleteSession: function (Id) { return call('chat:delete', [Id]); },
    clearHistory: function () { return call('chat:clear'); },
    getModels: function () { return call('meta:models'); },
    getProvider: function () { return call('meta:provider'); },
    setProvider: function (Config) { return call('meta:setProvider', [Config]); },
    setModel: function (Name) { return call('meta:setModel', [Name]); },
    getBalance: function () { return call('meta:balance'); },
    auth: function (Opts) { return call('meta:auth', [Opts]); },
    getMcp: function (Opts) { return call('meta:mcp', [Opts]); },
    winMin: function () { return Promise.resolve(); },
    winMax: function () { return Promise.resolve(); },
    winClose: function () { return Promise.resolve(); },
    winState: function () { return Promise.resolve(false); },
    onWinState: function (Cb) { WinListeners.push(Cb); return function () {}; },
    ideList: function (Dir) { return call('ide:list', [Dir]); },
    ideRead: function (File) { return call('ide:read', [File]); },
    ideWrite: function (File, Content) { return call('ide:write', [File, Content]); },
    ideRoots: function () { return call('ide:roots'); },
    ideAddFolder: function (Path) { return call('ide:addFolder', [Path]); },
    ideRemoveFolder: function (Dir) { return call('ide:removeFolder', [Dir]); },
    openPath: function (P) { return call('sys:openPath', [P]); },
    termStart: function () { return call('term:start'); },
    termRun: function (Id, Line) { return call('term:run', [{ id: Id, line: Line }]); },
    termKill: function (Id) { return call('term:kill', [Id]); },
    termDispose: function (Id) { return call('term:dispose', [Id]); },
    onTerm: addListener(TermListeners),
    onAgentWeb: addListener(WebListeners),
    agentWebResult: function (Rid, Out) { return call('agent:web-res', [Rid, Out]).catch(function () {}); },
    onEvent: function (Cb) { ChatListeners.push(Cb); return function () {}; },
    onStatus: function (Cb) { StatusListeners.push(Cb); },
    reconnect: function () { ManualClose = false; ReconnectDelay = 500; connect(); },
  };

  function buildOverlay() {
    var El = document.createElement('div');
    El.id = 'vulner-pair';
    El.innerHTML =
      '<div class="vp-card">' +
      '<div class="vp-title">Oxygen agent</div>' +
      '<div class="vp-body">to use oxygen on this machine:</div>' +
      '<ol class="vp-steps">' +
      '<li>download the oxygen desktop app from the <a href="/landing">landing page</a></li>' +
      '<li>open the app and sign in with discord</li>' +
      '<li>come back here &mdash; you will be signed in automatically</li>' +
      '</ol>' +
      '<button class="vp-back" data-back>go to the landing page</button>' +
      '<div class="vp-row"><span class="vp-note" data-note>connecting...</span></div>' +
      '</div>';
    El.querySelector('[data-back]').addEventListener('click', function () { location.href = '/landing'; });
    document.body.appendChild(El);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildOverlay);
  else buildOverlay();

  function start() {
    fetch('/auth/me', { credentials: 'same-origin' })
      .then(function (R) { return R.json(); })
      .then(function (J) {
        window.__OXYGEN_USER__ = (J && J.user) || null;
        window.__OXYGEN_AUTH__ = !(J && J.authed === false);
        if (!window.__OXYGEN_AUTH__) return;
        connect();
        setTimeout(function () { if (!Open) notifyStatus('closed', Token ? 'agent not reachable - open the oxygen desktop app' : 'sign in with the oxygen desktop app'); }, 1500);
      })
      .catch(function () {
        window.__OXYGEN_AUTH__ = true;
        connect();
        setTimeout(function () { if (!Open) notifyStatus('closed', Token ? 'agent not reachable - open the oxygen desktop app' : 'sign in with the oxygen desktop app'); }, 1500);
      });
  }

  start();
})();
