(function (global) {
  var REQUEST_TIMEOUT_MS = 25000;
  var UPLOAD_TIMEOUT_MS = 180000;

  var JSONP_FUNCS = {
    getInitialData: 0,
    getAdminDashboardData: 0,
    verifyLogin: 2,
    recordClick: 2,
    updateBanner: 2,
    deleteProject: 1,
    reorderApps: 1,
    saveProject: 2,
    setSettingImage: 2,
  };

  var FORM_FILE_ACTIONS = {
    uploadImage: true,
    updateBackgroundImage: true,
    updateLogoImage: true,
  };

  var bridgeReady = false;
  var bridgePending = {};
  var bridgeListenerInit = false;

  function getConfig() {
    return global.APP_CONFIG || {};
  }

  function getGasExecUrl() {
    var cfg = getConfig();
    return cfg.gasExecUrl || '';
  }

  function getGasBridgeUrl() {
    var cfg = getConfig();
    return cfg.gasBridgeUrl || '';
  }

  function isGitHubPagesHost() {
    var host = global.location && global.location.hostname;
    return host === 'pongvitsam.github.io' || (host && host.endsWith('.github.io'));
  }

  function isGasHost() {
    if (isGitHubPagesHost()) return false;
    return typeof global.google !== 'undefined' && global.google.script && global.google.script.run;
  }

  function isGoogleHostedOrigin(origin) {
    if (!origin) return false;
    if (origin.indexOf('https://script.google.com') === 0) return true;
    return /^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/i.test(origin);
  }

  function hasFilePayload(args) {
    return args && args.some(function (a) { return a && a.data; });
  }

  function shouldUseBridge(name, args) {
    if (!isGitHubPagesHost() || !getGasBridgeUrl()) return false;
    if (name === 'uploadImage') return true;
    if (name === 'saveProject' && args[1] && args[1].data) return true;
    if (FORM_FILE_ACTIONS[name] && hasFilePayload(args)) return true;
    return false;
  }

  function shouldUseJsonp(name, args) {
    if (isGasHost()) return false;
    if (shouldUseBridge(name, args)) return false;
    if (name === 'uploadImage') return false;
    if (name === 'saveProject' && args[1] && args[1].data) return false;
    if (FORM_FILE_ACTIONS[name] && hasFilePayload(args)) return false;
    if (!Object.prototype.hasOwnProperty.call(JSONP_FUNCS, name)) return false;
    return (args || []).length === JSONP_FUNCS[name];
  }

  function shouldUseFormPost(name, args) {
    if (isGasHost() || shouldUseBridge(name, args) || shouldUseJsonp(name, args)) return false;
    if (name === 'uploadImage') return true;
    if (FORM_FILE_ACTIONS[name] && hasFilePayload(args)) return true;
    return false;
  }

  function ensureFormFrame() {
    var frame = global.document.getElementById('gas-form-frame');
    if (!frame) {
      frame = global.document.createElement('iframe');
      frame.id = 'gas-form-frame';
      frame.name = 'gas-form-frame';
      frame.title = 'GAS API';
      frame.setAttribute('style', 'position:absolute;width:0;height:0;border:0;visibility:hidden');
      global.document.body.appendChild(frame);
    }
    return frame;
  }

  function ensureBridgeFrame() {
    var frame = global.document.getElementById('gas-bridge-frame');
    if (!frame) {
      frame = global.document.createElement('iframe');
      frame.id = 'gas-bridge-frame';
      frame.name = 'gas-bridge-frame';
      frame.title = 'GAS Bridge';
      frame.setAttribute('style', 'position:absolute;width:0;height:0;border:0;visibility:hidden');
      frame.src = getGasBridgeUrl();
      global.document.body.appendChild(frame);
    } else if (!frame.src) {
      frame.src = getGasBridgeUrl();
    }
    return frame;
  }

  function initBridgeListener() {
    if (bridgeListenerInit) return;
    bridgeListenerInit = true;
    global.addEventListener('message', function (e) {
      if (!isGoogleHostedOrigin(e.origin)) return;
      var msg = e.data;
      if (!msg || msg.type !== 'gas-bridge') return;
      if (msg.ready) {
        bridgeReady = true;
        return;
      }
      if (!msg.id || !bridgePending[msg.id]) return;
      var pending = bridgePending[msg.id];
      delete bridgePending[msg.id];
      if (msg.ok) pending.success(msg.result);
      else pending.failure({ message: msg.error || 'เซิร์ฟเวอร์ตอบกลับผิดพลาด' });
    });
  }

  function callBridge(functionName, args, success, failure) {
    initBridgeListener();
    var frame = ensureBridgeFrame();
    var id = 'bridge_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    var timer = setTimeout(function () {
      if (!bridgePending[id]) return;
      delete bridgePending[id];
      if (failure) failure({ message: 'หมดเวลาเชื่อมต่อเซิร์ฟเวอร์ (ลองใหม่หรือลดขนาดรูป)' });
    }, UPLOAD_TIMEOUT_MS);

    bridgePending[id] = {
      success: function (result) {
        clearTimeout(timer);
        if (success) success(result);
      },
      failure: function (err) {
        clearTimeout(timer);
        if (failure) failure(err);
      },
    };

    function send() {
      try {
        frame.contentWindow.postMessage({
          type: 'gas-bridge',
          id: id,
          function: functionName,
          args: args || [],
        }, '*');
      } catch (err) {
        delete bridgePending[id];
        clearTimeout(timer);
        if (failure) failure({ message: 'เชื่อมต่อ Bridge ไม่สำเร็จ' });
      }
    }

    if (bridgeReady) {
      send();
      return;
    }

    var tries = 0;
    var wait = setInterval(function () {
      tries += 1;
      if (bridgeReady) {
        clearInterval(wait);
        send();
      } else if (tries > 50) {
        clearInterval(wait);
        send();
      }
    }, 100);
  }

  function callFormPost(functionName, args, success, failure) {
    var gasUrl = getGasExecUrl();
    if (!gasUrl) {
      if (failure) failure({ message: 'ไม่พบ URL API' });
      return;
    }
    var postArgs = (args || []).slice();
    var filePayload = null;
    if (functionName === 'uploadImage' && postArgs[0] && postArgs[0].data) {
      filePayload = postArgs.shift();
    } else if (functionName === 'saveProject' && postArgs[1] && postArgs[1].data) {
      filePayload = postArgs[1];
      postArgs = [postArgs[0]];
    }
    var hasFile = !!filePayload;
    var cbName = 'gasForm_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    var timer = setTimeout(function () {
      cleanup();
      if (failure) failure({ message: 'หมดเวลาเชื่อมต่อเซิร์ฟเวอร์' });
    }, hasFile ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

    var messageHandler = null;

    function cleanup() {
      clearTimeout(timer);
      if (messageHandler) {
        global.removeEventListener('message', messageHandler);
        messageHandler = null;
      }
      try { delete global[cbName]; } catch (e) {}
    }

    global[cbName] = function (res) {
      cleanup();
      if (res && res.ok) {
        if (success) success(res.data);
      } else if (failure) {
        failure({ message: (res && res.error) || 'API error' });
      }
    };

    messageHandler = function (e) {
      if (!isGoogleHostedOrigin(e.origin)) return;
      var msg = e.data;
      if (!msg || msg.type !== 'gas-form-post' || msg.callback !== cbName) return;
      global[cbName](msg.response);
    };
    global.addEventListener('message', messageHandler);

    ensureFormFrame();

    var form = global.document.createElement('form');
    form.method = 'POST';
    form.action = gasUrl;
    form.target = 'gas-form-frame';
    form.style.display = 'none';
    form.acceptCharset = 'UTF-8';

    function addField(n, v) {
      var input = global.document.createElement('input');
      input.type = 'hidden';
      input.name = n;
      input.value = v;
      form.appendChild(input);
    }

    addField('action', functionName);
    addField('args', JSON.stringify(postArgs));
    if (filePayload) addField('fileData', JSON.stringify(filePayload));
    addField('callback', cbName);
    global.document.body.appendChild(form);
    form.submit();
    setTimeout(function () {
      if (form.parentNode) form.parentNode.removeChild(form);
    }, 2000);
  }

  function callJsonp(functionName, args, success, failure) {
    var url = getGasExecUrl() + '?action=' + encodeURIComponent(functionName);
    if (args && args.length) {
      url += '&args=' + encodeURIComponent(JSON.stringify(args));
    }
    var cbName = 'gasJsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    var script = global.document.createElement('script');
    var timer = setTimeout(function () {
      cleanup();
      if (failure) failure({ message: 'หมดเวลาเชื่อมต่อเซิร์ฟเวอร์' });
    }, REQUEST_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      try { delete global[cbName]; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    global[cbName] = function (res) {
      cleanup();
      if (res && res.ok) {
        if (success) success(res.data);
      } else if (failure) {
        failure({ message: (res && res.error) || 'API error' });
      }
    };

    script.src = url + '&callback=' + encodeURIComponent(cbName) + '&_=' + Date.now();
    script.onerror = function () {
      cleanup();
      if (failure) failure({ message: 'โหลด API ไม่สำเร็จ' });
    };
    global.document.head.appendChild(script);
  }

  function invokeGas(functionName, args, success, failure) {
    if (isGasHost()) {
      var runner = global.google.script.run;
      if (success) runner = runner.withSuccessHandler(success);
      if (failure) runner = runner.withFailureHandler(failure);
      runner[functionName].apply(runner, args || []);
      return;
    }
    if (shouldUseBridge(functionName, args)) {
      callBridge(functionName, args, success, failure);
      return;
    }
    if (shouldUseJsonp(functionName, args)) {
      callJsonp(functionName, args, success, failure);
      return;
    }
    if (shouldUseFormPost(functionName, args)) {
      callFormPost(functionName, args, success, failure);
      return;
    }
    if (failure) failure({ message: 'ไม่รองรับการเรียก ' + functionName });
  }

  function createGasProxy() {
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
            var a = Array.prototype.slice.call(arguments);
            invokeGas(prop, a, handlers.success, handlers.failure);
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
    return createGasProxy();
  };

  if (isGitHubPagesHost() && getGasBridgeUrl()) {
    global.addEventListener('DOMContentLoaded', function () {
      initBridgeListener();
      ensureBridgeFrame();
    });
  }
})(typeof window !== 'undefined' ? window : this);
