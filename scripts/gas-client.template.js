(function (global) {
  var pending = {};
  var bridgeReady = false;
  var bridgeQueue = [];

  function getConfig() {
    return global.APP_CONFIG || {};
  }

  function isGasHost() {
    return typeof global.google !== 'undefined' && global.google.script && global.google.script.run;
  }

  function getBridgeFrame() {
    return document.getElementById('gas-bridge-frame');
  }

  function initBridgeListener() {
    if (global.__gasBridgeListener) return;
    global.__gasBridgeListener = true;
    global.addEventListener('message', function (e) {
      var cfg = getConfig();
      var origins = cfg.bridgeOrigins || ['https://pongvitsam.github.io'];
      if (origins.indexOf(e.origin) === -1 && e.origin.indexOf('https://script.google.com') !== 0) return;

      var msg = e.data;
      if (!msg || msg.type !== 'gas-bridge') return;

      if (msg.id && pending[msg.id]) {
        var p = pending[msg.id];
        delete pending[msg.id];
        if (msg.ok) {
          if (p.success) p.success(msg.result);
        } else if (p.failure) {
          p.failure({ message: msg.error || 'Bridge error' });
        }
      }

      if (msg.type === 'gas-bridge-ready' || (msg && msg.type === 'gas-bridge' && msg.ready)) {
        bridgeReady = true;
        bridgeQueue.forEach(function (fn) { fn(); });
        bridgeQueue = [];
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
          frame.contentWindow.postMessage({ type: 'gas-bridge-ping' }, '*');
        } catch (err) {}
      }, { once: true });
    }
    setTimeout(cb, 3000);
  }

  function callBridge(functionName, args, success, failure) {
    whenBridgeReady(function () {
      var cfg = getConfig();
      var id = 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      pending[id] = { success: success, failure: failure };
      var frame = getBridgeFrame();
      var target = frame && frame.contentWindow;
      var origin = 'https://script.google.com';
      if (!target) {
        delete pending[id];
        if (failure) failure({ message: 'GAS bridge iframe not found' });
        return;
      }
      try {
        target.postMessage(
          { type: 'gas-bridge', id: id, function: functionName, args: args || [] },
          origin
        );
      } catch (err) {
        delete pending[id];
        if (failure) failure({ message: err.message || String(err) });
      }
    });
  }

  function createBridgeProxy() {
    var handlers = { success: null, failure: null };
    var proxy = {
      withSuccessHandler: function (fn) {
        handlers.success = fn;
        return proxy;
      },
      withFailureHandler: function (fn) {
        handlers.failure = fn;
        return proxy;
      },
    };

    return new Proxy(proxy, {
      get: function (target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'string' && prop !== 'then') {
          return function () {
            var args = Array.prototype.slice.call(arguments);
            callBridge(prop, args, handlers.success, handlers.failure);
            return proxy;
          };
        }
        return undefined;
      },
    });
  }

  global.gasRun = function () {
    if (isGasHost()) return global.google.script.run;
    initBridgeListener();
    return createBridgeProxy();
  };
})(typeof window !== 'undefined' ? window : this);
