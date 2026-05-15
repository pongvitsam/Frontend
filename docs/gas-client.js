(function (global) {
  var pending = {};
  var bridgeReady = false;
  var bridgeQueue = [];

  function getConfig() {
    return global.APP_CONFIG || {};
  }

  function isGitHubPagesHost() {
    var host = global.location && global.location.hostname;
    return host === 'pongvitsam.github.io' || (host && host.endsWith('.github.io'));
  }

  function isGasHost() {
    if (isGitHubPagesHost()) return false;
    return typeof global.google !== 'undefined' && global.google.script && global.google.script.run;
  }

  function isAllowedBridgeOrigin(origin) {
    if (!origin) return false;
    var cfg = getConfig();
    var allowed = cfg.bridgeOrigins || ['https://pongvitsam.github.io'];
    if (allowed.indexOf(origin) !== -1) return true;
    if (origin.indexOf('https://script.google.com') === 0) return true;
    if (origin.indexOf('https://script.googleusercontent.com') === 0) return true;
    if (/^https:\/\/n-[a-z0-9]+-script\.googleusercontent\.com$/i.test(origin)) return true;
    return false;
  }

  function getBridgeFrame() {
    return document.getElementById('gas-bridge-frame');
  }

  function initBridgeListener() {
    if (global.__gasBridgeListener) return;
    global.__gasBridgeListener = true;
    global.addEventListener('message', function (e) {
      if (!isAllowedBridgeOrigin(e.origin)) return;

      var msg = e.data;
      if (!msg || msg.type !== 'gas-bridge') return;

      if (msg.ready) {
        bridgeReady = true;
        bridgeQueue.forEach(function (fn) { fn(); });
        bridgeQueue = [];
        return;
      }

      if (msg.id && pending[msg.id]) {
        var p = pending[msg.id];
        delete pending[msg.id];
        if (msg.ok) {
          if (p.success) p.success(msg.result);
        } else if (p.failure) {
          p.failure({ message: msg.error || 'Bridge error' });
        }
      }
    });
  }

  function whenBridgeReady(cb) {
    initBridgeListener();
    if (bridgeReady) return cb();
    bridgeQueue.push(cb);
    var frame = getBridgeFrame();
    if (frame) {
      frame.addEventListener('load', function () {
        try {
          if (frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'gas-bridge-ping' }, '*');
          }
        } catch (err) {}
      }, { once: true });
    }
    setTimeout(function () {
      if (!bridgeReady) {
        bridgeReady = true;
        bridgeQueue.forEach(function (fn) { fn(); });
        bridgeQueue = [];
      }
    }, 5000);
  }

  function callBridge(functionName, args, success, failure) {
    whenBridgeReady(function () {
      var id = 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      pending[id] = { success: success, failure: failure };
      var frame = getBridgeFrame();
      var target = frame && frame.contentWindow;
      if (!target) {
        delete pending[id];
        if (failure) failure({ message: 'GAS bridge iframe not found' });
        return;
      }
      try {
        target.postMessage(
          { type: 'gas-bridge', id: id, function: functionName, args: args || [] },
          '*'
        );
      } catch (err) {
        delete pending[id];
        if (failure) failure({ message: err.message || String(err) });
      }
    });
  }

  function createBridgeProxy() {
    var handlers = { success: null, failure: null };
    var p;
    var base = {
      withSuccessHandler: function (fn) {
        handlers.success = fn;
        return p;
      },
      withFailureHandler: function (fn) {
        handlers.failure = fn;
        return p;
      },
    };
    p = new Proxy(base, {
      get: function (target, prop) {
        if (Object.prototype.hasOwnProperty.call(target, prop)) {
          return target[prop];
        }
        if (typeof prop === 'string' && prop !== 'then') {
          return function () {
            var args = Array.prototype.slice.call(arguments);
            callBridge(prop, args, handlers.success, handlers.failure);
            return p;
          };
        }
        return undefined;
      },
    });
    return p;
  }

  global.gasRun = function () {
    if (isGasHost()) return global.google.script.run;
    initBridgeListener();
    return createBridgeProxy();
  };
})(typeof window !== 'undefined' ? window : this);
