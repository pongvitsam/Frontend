(function (global) {
  var REQUEST_TIMEOUT_MS = 25000;
  var UPLOAD_TIMEOUT_MS = 120000;

  var JSONP_FUNCS = {
    getInitialData: 0,
    getAdminDashboardData: 0,
    verifyLogin: 2,
    recordClick: 2,
    updateBanner: 2,
    deleteProject: 1,
    saveProject: 2,
  };

  function getConfig() {
    return global.APP_CONFIG || {};
  }

  function getGasExecUrl() {
    var cfg = getConfig();
    return cfg.gasExecUrl || '';
  }

  function isGitHubPagesHost() {
    var host = global.location && global.location.hostname;
    return host === 'pongvitsam.github.io' || (host && host.endsWith('.github.io'));
  }

  function isGasHost() {
    if (isGitHubPagesHost()) return false;
    return typeof global.google !== 'undefined' && global.google.script && global.google.script.run;
  }

  function shouldUseJsonp(name, args) {
    if (isGasHost()) return false;
    if (name === 'saveProject' && args[1] && args[1].data) return false;
    if (!Object.prototype.hasOwnProperty.call(JSONP_FUNCS, name)) return false;
    return (args || []).length === JSONP_FUNCS[name];
  }

  function shouldUseFormPost(name, args) {
    if (isGasHost() || shouldUseJsonp(name, args)) return false;
    return true;
  }

  function callFormPost(functionName, args, success, failure) {
    var gasUrl = getGasExecUrl();
    if (!gasUrl) {
      if (failure) failure({ message: 'ไม่พบ URL API' });
      return;
    }
    var hasFile = args && args.some(function (a) { return a && a.data; });
    var cbName = 'gasForm_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    var timer = setTimeout(function () {
      cleanup();
      if (failure) failure({ message: 'หมดเวลาเชื่อมต่อเซิร์ฟเวอร์' });
    }, hasFile ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
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

    var form = document.createElement('form');
    form.method = 'POST';
    form.action = gasUrl;
    form.target = 'gas-form-frame';
    form.style.display = 'none';
    form.acceptCharset = 'UTF-8';

    function addField(n, v) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = n;
      input.value = v;
      form.appendChild(input);
    }

    addField('action', functionName);
    addField('args', JSON.stringify(args || []));
    addField('callback', cbName);
    document.body.appendChild(form);
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
    var script = document.createElement('script');
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
    document.head.appendChild(script);
  }

  function invokeGas(functionName, args, success, failure) {
    if (isGasHost()) {
      var runner = global.google.script.run;
      if (success) runner = runner.withSuccessHandler(success);
      if (failure) runner = runner.withFailureHandler(failure);
      runner[functionName].apply(runner, args || []);
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
})(typeof window !== 'undefined' ? window : this);
