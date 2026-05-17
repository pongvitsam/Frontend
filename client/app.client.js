let appData = [];
    let isAdmin = false;
    let chartInstance = null;
    let editingAppId = null; 
    let uploadTarget = ''; 

    let globalBannerText = '';
    let globalBannerVisible = false;

    let cropper = null;
    let croppedFileData = null; 

    function loadScriptOnce(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-src="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === '1') return resolve();
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('โหลดสคริปต์ไม่สำเร็จ')), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.defer = true;
        s.dataset.src = src;
        s.addEventListener('load', () => {
          s.dataset.loaded = '1';
          resolve();
        }, { once: true });
        s.addEventListener('error', () => reject(new Error('โหลดสคริปต์ไม่สำเร็จ')), { once: true });
        document.head.appendChild(s);
      });
    }

    function ensureCropperCss() {
      return new Promise(function(resolve, reject) {
        if (document.querySelector('link[data-cropper-css]')) return resolve();
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css';
        l.dataset.cropperCss = '1';
        l.onload = function() { resolve(); };
        l.onerror = function() { reject(new Error('cropper css')); };
        document.head.appendChild(l);
      });
    }

    function ensureSwalReady() {
      if (typeof window.Swal !== 'undefined') return Promise.resolve();
      return loadScriptOnce('https://cdn.jsdelivr.net/npm/sweetalert2@11');
    }

    function loadFontAwesomeDeferred() {
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
      link.crossOrigin = 'anonymous';
      link.onload = function() { link.onload = null; link.rel = 'stylesheet'; };
      document.head.appendChild(link);
    }

    function loadSarabunDeferred() {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap';
      link.media = 'print';
      link.onload = function() { link.media = 'all'; };
      document.head.appendChild(link);
    }

    var SESSION_CACHE_KEY = 'pk2_initial_v4';
    var SESSION_CACHE_MS = 8 * 60 * 1000;
    var LOCAL_CACHE_KEY = 'pk2_initial_ls_v1';
    var LOCAL_CACHE_MS = 24 * 60 * 60 * 1000;
    var GAS_EXEC_FALLBACK = 'https://script.google.com/macros/s/AKfycby8V8L2CRZINAgkEcqfwjduA8w_7Yrl9t5AoQmISqtzq9BsghYbVjKOlZHvMuZdVUsagw/exec';
    var bootFinished = false;

    window.addEventListener('pk2-prefetch-ready', function (ev) {
      if (ev.detail && ev.detail.apps) window.__PK2_PENDING_DATA__ = ev.detail;
    });

    function invalidateSessionCache() {
      try { sessionStorage.removeItem(SESSION_CACHE_KEY); } catch (e) {}
      try { localStorage.removeItem(LOCAL_CACHE_KEY); } catch (e) {}
    }

    function persistCache(data) {
      var payload = JSON.stringify({ t: Date.now(), data: data });
      try { sessionStorage.setItem(SESSION_CACHE_KEY, payload); } catch (e) {}
      try { localStorage.setItem(LOCAL_CACHE_KEY, payload); } catch (e) {}
    }

    function readCachedPayload() {
      if (window.__PREFETCH_DATA__ && window.__PREFETCH_DATA__.apps) {
        return { t: Date.now(), data: window.__PREFETCH_DATA__ };
      }
      if (window.__BOOT_DATA__ && window.__BOOT_DATA__.apps) {
        return { t: Date.now(), data: window.__BOOT_DATA__ };
      }
      try {
        var raw = sessionStorage.getItem(SESSION_CACHE_KEY) || localStorage.getItem(LOCAL_CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    function thumbUrl(url) {
      var fallback = 'https://via.placeholder.com/320x112.png?text=No+Image';
      if (!url) return fallback;
      if (/drive\.google\.com\/thumbnail/i.test(url)) {
        return url.replace(/sz=w\d+/i, 'sz=w240');
      }
      return url;
    }

    function escHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function escJs(value) {
      return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '')
        .replace(/\n/g, '\\n');
    }

    function handleApiError(err, msg) {
      restoreAdminUI();
      alert((err && err.message) || msg || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    }

    function tryHydrateFromCache() {
      var o = readCachedPayload();
      if (!o || !o.data || !Array.isArray(o.data.apps)) return false;
      var maxAge = o.data === window.__BOOT_DATA__ || o.data === window.__PREFETCH_DATA__
        ? LOCAL_CACHE_MS
        : (localStorage.getItem(LOCAL_CACHE_KEY) ? LOCAL_CACHE_MS : SESSION_CACHE_MS);
      if (Date.now() - o.t > maxAge) return false;
      initApp(o.data, { fromCache: true });
      return true;
    }

    function syncThemeIcon() {
      var icon = document.getElementById('theme-icon');
      if (!icon) return;
      if (document.documentElement.classList.contains('dark')) {
        icon.classList.replace('fa-moon', 'fa-sun');
      }
    }

    async function ensureChartReady() {
      if (typeof window.Chart !== 'undefined') return;
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/chart.js');
    }

    async function ensureCropperReady() {
      if (typeof window.Cropper !== 'undefined') return;
      await ensureCropperCss();
      await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js');
    }

    function refreshDataInBackground() {
      loadInitialData(
        function (data) { initApp(data, { silent: true }); },
        function () {}
      );
    }

    function purgeStaleCachesAsync(expectedV) {
      try { localStorage.setItem('pk2_asset_v', expectedV); } catch (e) {}
      var p = Promise.resolve();
      if ('caches' in window) {
        p = caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        });
      }
      p.then(function () {
        if ('serviceWorker' in navigator) {
          return navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister(); }));
          });
        }
      }).catch(function () {});
    }

    function getGasExecUrl() {
      var cfg = window.APP_CONFIG || {};
      return cfg.gasExecUrl || GAS_EXEC_FALLBACK;
    }

    function setLoadingMessage(text) {
      var el = document.getElementById('loading-message');
      if (el) el.textContent = text;
    }

    function fetchInitialDataJsonp(success, failure) {
      var gasUrl = getGasExecUrl();
      var cbName = 'gasInit_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      var script = document.createElement('script');
      var timer = setTimeout(function () {
        cleanup();
        if (failure) failure({ message: 'หมดเวลาเชื่อมต่อเซิร์ฟเวอร์' });
      }, 10000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cbName]; } catch (e) {}
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = function (res) {
        cleanup();
        if (res && res.ok && res.data) {
          if (success) success(res.data);
        } else if (failure) {
          failure({ message: (res && res.error) || 'API error' });
        }
      };

      script.onerror = function () {
        cleanup();
        if (failure) failure({ message: 'โหลด API ไม่สำเร็จ' });
      };
      script.src = gasUrl + '?action=getInitialData&callback=' + encodeURIComponent(cbName) + '&_=' + Date.now();
      document.head.appendChild(script);
    }

    function tryStaleCacheFallback() {
      try {
        var raw = sessionStorage.getItem(SESSION_CACHE_KEY) || localStorage.getItem(LOCAL_CACHE_KEY);
        if (!raw) return false;
        var o = JSON.parse(raw);
        if (!o || !o.data || !Array.isArray(o.data.apps)) return false;
        initApp(o.data, { fromCache: true, silent: true });
        setLoadingMessage('แสดงข้อมูลที่บันทึกไว้ (ออฟไลน์) — กำลังอัปเดต...');
        return true;
      } catch (e) {
        return false;
      }
    }

    function fetchInitialWithRetry(success, failure, attempt) {
      attempt = attempt || 0;
      setLoadingMessage(attempt > 0 ? 'กำลังลองเชื่อมต่ออีกครั้ง (' + (attempt + 1) + '/4)...' : 'กำลังเชื่อมต่อข้อมูล...');
      fetchInitialDataJsonp(
        success,
        function (err) {
          if (attempt < 3) {
            setTimeout(function () { fetchInitialWithRetry(success, failure, attempt + 1); }, 1200);
          } else if (failure) {
            failure(err);
          }
        }
      );
    }

    function loadInitialData(success, failure) {
      if (window.__PREFETCH_DATA__ && window.__PREFETCH_DATA__.apps) {
        success(window.__PREFETCH_DATA__);
        return;
      }
      if (window.__BOOT_DATA__ && window.__BOOT_DATA__.apps) {
        success(window.__BOOT_DATA__);
        return;
      }
      var host = window.location && window.location.hostname;
      var onPages = host === 'pongvitsam.github.io' || (host && host.endsWith('.github.io'));
      if (onPages) {
        fetchInitialDataJsonp(success, failure);
        return;
      }
      gasRun().withSuccessHandler(success).withFailureHandler(function (err) {
        fetchInitialDataJsonp(success, failure);
      }).getInitialData();
    }

    function cleanupLegacyServiceWorker() {
      if ('caches' in window) {
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }).catch(function () {});
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        }).catch(function () {});
      }
    }

    function startApplicationBoot() {
      if (bootFinished) return;
      var pending = window.__PK2_PENDING_DATA__ || window.__PREFETCH_DATA__ || window.__BOOT_DATA__;
      if (pending && pending.apps) {
        bootFinished = true;
        initApp(pending, { fromCache: true });
        cleanupLegacyServiceWorker();
        refreshDataInBackground();
        return;
      }
      if (tryHydrateFromCache()) {
        bootFinished = true;
        cleanupLegacyServiceWorker();
        refreshDataInBackground();
        return;
      }
      var retryBtnTimer = setTimeout(function () {
        var btn = document.getElementById('btn-retry-load');
        if (btn) btn.classList.remove('hidden');
      }, 5000);
      fetchInitialWithRetry(
        function (data) {
          clearTimeout(retryBtnTimer);
          bootFinished = true;
          initApp(data, { fromCache: false });
          cleanupLegacyServiceWorker();
        },
        function (err) {
          clearTimeout(retryBtnTimer);
          console.error(err);
          if (!tryStaleCacheFallback()) {
            showLoadError('โหลดข้อมูลไม่สำเร็จ — กดปุ่มด้านล่างหรือ Ctrl+Shift+R');
            var btn = document.getElementById('btn-retry-load');
            if (btn) btn.classList.remove('hidden');
          } else {
            bootFinished = true;
            cleanupLegacyServiceWorker();
            refreshDataInBackground();
          }
        }
      );
    }

    function retryLoadData() {
      bootFinished = false;
      var btn = document.getElementById('btn-retry-load');
      if (btn) btn.classList.add('hidden');
      var loading = document.getElementById('loading-state');
      var main = document.getElementById('main-content');
      if (loading) loading.classList.remove('hidden');
      if (main) main.classList.add('hidden');
      setLoadingMessage('กำลังเชื่อมต่อข้อมูล...');
      startApplicationBoot();
    }
    window.retryLoadData = retryLoadData;

    var SORT_LABELS = { popular: 'เรียงตามความนิยม', az: 'เรียงตามตัวอักษร (A-Z)' };

    function initSortDropdown() {
      var toggle = document.getElementById('sort-toggle');
      var menu = document.getElementById('sort-menu');
      var hidden = document.getElementById('sort-select');
      var label = document.getElementById('sort-label');
      var wrap = document.getElementById('sort-dropdown-wrap');
      if (!toggle || !menu || !hidden) return;

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.classList.toggle('hidden');
      });

      menu.querySelectorAll('[data-sort]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var val = btn.getAttribute('data-sort');
          hidden.value = val;
          if (label) label.textContent = SORT_LABELS[val] || val;
          menu.querySelectorAll('[data-sort]').forEach(function (b) {
            b.classList.toggle('sort-opt-active', b === btn);
          });
          menu.classList.add('hidden');
          renderApps();
        });
      });

      if (wrap) {
        wrap.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      document.addEventListener('click', function () {
        menu.classList.add('hidden');
      });
    }

    document.addEventListener('DOMContentLoaded', function() {
      syncThemeIcon();
      loadFontAwesomeDeferred();
      loadSarabunDeferred();
      initSortDropdown();
      cleanupLegacyServiceWorker();
      var expectedV = (window.APP_CONFIG && window.APP_CONFIG.assetVersion) || '';
      if (expectedV && localStorage.getItem('pk2_asset_v') !== expectedV) {
        purgeStaleCachesAsync(expectedV);
      }
      startApplicationBoot();
    });

    // ฟังก์ชันสลับโหมด มืด/สว่าง
    function toggleDarkMode() {
      const htmlClass = document.documentElement.classList;
      const icon = document.getElementById('theme-icon');
      
      if (htmlClass.contains('dark')) {
        htmlClass.remove('dark');
        localStorage.theme = 'light';
        icon.classList.replace('fa-sun', 'fa-moon');
      } else {
        htmlClass.add('dark');
        localStorage.theme = 'dark';
        icon.classList.replace('fa-moon', 'fa-sun');
      }
      // โหลดกราฟใหม่เพื่อให้สีตัวหนังสือเข้ากับธีม
      if (chartInstance && isAdmin) loadDashboardData();
    }

    function initApp(data, opts) {
      opts = opts || {};
      if (!data || !Array.isArray(data.apps)) {
        showLoadError('ข้อมูลไม่ถูกต้อง');
        return;
      }
      try {
        var emailEl = document.getElementById('user-email');
        if (emailEl) emailEl.innerText = data.email || '';
        appData = data.apps;

        globalBannerText = data.bannerText || '';
        globalBannerVisible = (data.bannerVisible === true || data.bannerVisible === 'true');
        renderBanner();

        if (data.bgImage) document.body.style.backgroundImage = 'url(\'' + data.bgImage + '\')';
        if (data.logoImage) {
          document.getElementById('site-logo').src = data.logoImage;
          document.getElementById('site-logo').classList.remove('hidden');
          document.getElementById('default-logo-icon').classList.add('hidden');
        }

        var loadingEl = document.getElementById('loading-state');
        var mainEl = document.getElementById('main-content');
        if (loadingEl) loadingEl.classList.add('hidden');
        if (mainEl) mainEl.classList.remove('hidden');
        renderApps();

        if (!opts.silent) {
          persistCache(data);
        }
      } catch (err) {
        console.error(err);
        showLoadError('แสดงผลไม่สำเร็จ โปรดรีเฟรชหน้า');
      }
    }

    function showLoadError(msg) {
      var el = document.getElementById('loading-message');
      if (el) {
        el.className = 'text-center text-red-500 px-4 text-sm';
        el.textContent = msg;
      }
      var spin = document.querySelector('#loading-state .animate-spin');
      if (spin) spin.classList.add('hidden');
    }

    function renderBanner() {
      const banner = document.getElementById('top-banner');
      const textDisplay = document.getElementById('banner-text-display');
      
      if (globalBannerVisible && globalBannerText.trim() !== '') {
        textDisplay.textContent = globalBannerText.replace(/\s+/g, ' ');
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    function toggleBannerModal() {
      const modal = document.getElementById('banner-modal');
      if (modal.classList.contains('hidden')) {
        document.getElementById('edit-banner-text').value = globalBannerText;
        document.getElementById('edit-banner-visible').checked = globalBannerVisible;
      }
      modal.classList.toggle('hidden');
    }

    function saveBanner() {
      const text = document.getElementById('edit-banner-text').value;
      const isVisible = document.getElementById('edit-banner-visible').checked;
      document.getElementById('banner-modal').classList.add('hidden');
      showLoadingUI(); 
      gasRun()
        .withSuccessHandler(function() {
          invalidateSessionCache();
          globalBannerText = text;
          globalBannerVisible = isVisible;
          renderBanner();
          restoreAdminUI();
        })
        .withFailureHandler(function(err) { handleApiError(err, 'บันทึกประกาศไม่สำเร็จ'); })
        .updateBanner(text, isVisible);
    }

    function renderApps() {
      const grid = document.getElementById('app-grid');
      if (!grid) return;
      const sortEl = document.getElementById('sort-select');
      const sortType = sortEl ? sortEl.value : 'popular';
      let sortedApps = [...appData];
      
      if(sortType === 'popular') sortedApps.sort((a, b) => b.clicks - a.clicks);
      else sortedApps.sort((a, b) => a.name.localeCompare(b.name));

      var cardsHtml = '';
      sortedApps.forEach(app => {
        const isReady = app.status === 'พร้อมใช้งาน';
        const cardClass = isReady ? 'lux-app-card--active' : 'lux-app-card--disabled';
        const badgeClass = isReady ? 'app-card-badge app-card-badge--ready' : 'app-card-badge app-card-badge--wait';
        const imgUrl = thumbUrl(app.imageUrl);

        const adminControls = isAdmin 
          ? `<div class="flex items-center gap-3">
               <span class="text-xs text-[#8a96a3] dark:text-[#b8c0c8] bg-[#f5f3ee] dark:bg-[#121820] px-2.5 py-1 rounded-full transition-colors"><i class="fa-solid fa-chart-simple mr-1"></i> ${app.clicks}</span>
               <button onclick="event.stopPropagation(); editApp('${escJs(app.id)}')" class="text-[#2c3548] hover:text-[#8b7355] transition" title="แก้ไข"><i class="fa-solid fa-pen-to-square text-lg"></i></button>
               <button onclick="event.stopPropagation(); deleteApp('${escJs(app.id)}')" class="text-[#9a7b6a] hover:text-[#7d5e52] transition" title="ลบ"><i class="fa-solid fa-trash text-lg"></i></button>
             </div>` : ``;

        cardsHtml += `
          <div class="lux-app-card ${cardClass}" onclick="openApp('${escJs(app.id)}', '${escJs(app.name)}', '${escJs(app.url)}', ${isReady})">
            <article class="app-card-shell">
              <div class="app-card-visual">
                <img class="app-card-thumb" src="${escHtml(imgUrl)}" alt="${escHtml(app.name)}" width="128" height="128" loading="lazy" decoding="async" fetchpriority="low" />
              </div>
              <div class="app-card-body">
                <h3 class="app-card-title">${escHtml(app.name)}</h3>
                <span class="${badgeClass}">${escHtml(app.status)}</span>
                <div class="app-card-footer">
                  <div class="app-card-action"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
                  ${adminControls}
                </div>
              </div>
            </article>
          </div>`;
      });
      grid.innerHTML = cardsHtml;
    }

    function openApp(id, name, url, isReady) {
      if (!isReady) return; 
      gasRun().recordClick(id, name);
      const userEmail = document.getElementById('user-email').innerText;
      let targetUrl = url;
      if (userEmail && userEmail !== "ผู้ใช้งานทั่วไป" && userEmail !== "") {
        const separator = url.indexOf('?') !== -1 ? '&' : '?';
        targetUrl = url + separator + 'user_email=' + encodeURIComponent(userEmail);
      }
      window.open(targetUrl, '_blank');
      const appIndex = appData.findIndex(a => a.id == id);
      if(appIndex > -1) { appData[appIndex].clicks++; if(isAdmin) renderApps(); }
    }

    // --- ระบบตัดรูปภาพ (Cropper) ---
    async function handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        await ensureCropperReady();
      } catch (err) {
        alert('ไม่สามารถโหลดเครื่องมือตัดรูปภาพได้');
        event.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('cropper-image').src = e.target.result;
        document.getElementById('cropper-modal').classList.remove('hidden');
        let aspectRatio = NaN; 
        if (event.target.id === 'new-img-file') aspectRatio = 16 / 9; 
        if (event.target.id === 'upload-file' && uploadTarget === 'logo') aspectRatio = 1 / 1; 
        if (event.target.id === 'upload-file' && uploadTarget === 'bg') aspectRatio = 16 / 9; 
        if (cropper) cropper.destroy();
        cropper = new Cropper(document.getElementById('cropper-image'), { aspectRatio: aspectRatio, viewMode: 1, autoCropArea: 1 });
      };
      reader.readAsDataURL(file);
    }

    document.getElementById('new-img-file').addEventListener('change', handleFileSelect);
    document.getElementById('upload-file').addEventListener('change', handleFileSelect);

    function cancelCrop() {
      document.getElementById('cropper-modal').classList.add('hidden');
      if (cropper) cropper.destroy();
      document.getElementById('new-img-file').value = '';
      document.getElementById('upload-file').value = '';
      croppedFileData = null;
      document.getElementById('crop-status-proj').classList.add('hidden');
      document.getElementById('crop-status-upload').classList.add('hidden');
    }

    function handleUploadError(err) {
      restoreAdminUI();
      alert((err && err.message) || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
    }

    function uploadImageFile(fileData, onSuccess, onProgress) {
      if (onProgress) onProgress('กำลังอัปโหลดรูป...');
      gasRun()
        .withSuccessHandler(onSuccess)
        .withFailureHandler(handleUploadError)
        .uploadImage(fileData);
    }

    function afterProjectSaved(res) {
      invalidateSessionCache();
      appData = res;
      editingAppId = null;
      croppedFileData = null;
      restoreAdminUI();
      loadDashboardData();
    }

    function confirmCrop() {
      if (!cropper) return;
      const fileInput = document.getElementById('new-img-file').files.length > 0 ? document.getElementById('new-img-file') : document.getElementById('upload-file');
      const originalFile = fileInput.files[0];
      const isBranding = document.getElementById('new-img-file').files.length === 0;
      const maxSide = isBranding ? 560 : 400;
      const quality = isBranding ? 0.8 : 0.72;
      const canvas = cropper.getCroppedCanvas({
        maxWidth: maxSide,
        maxHeight: maxSide,
        imageSmoothingQuality: 'medium',
      });
      const baseName = (originalFile.name || 'image').replace(/\.[^.]+$/, '');
      const mime = 'image/jpeg';
      const base64Url = canvas.toDataURL(mime, quality);
      croppedFileData = {
        data: base64Url.split(',')[1],
        mimeType: mime,
        name: baseName + '.jpg',
        thumbSize: isBranding ? 'w800' : 'w480',
      };
      document.getElementById('cropper-modal').classList.add('hidden');
      if (cropper) cropper.destroy();
      if(document.getElementById('new-img-file').files.length > 0) {
        document.getElementById('crop-status-proj').classList.remove('hidden');
      } else {
        document.getElementById('crop-status-upload').classList.remove('hidden');
      }
    }

    // --- ระบบ Admin ปกติ ---
    function toggleLoginModal() { document.getElementById('login-modal').classList.toggle('hidden'); }
    function doLogin() {
      const user = document.getElementById('username').value;
      const pass = document.getElementById('password').value;
      toggleLoginModal(); showLoadingUI();
      gasRun()
        .withSuccessHandler(function(res) {
          if (res) {
            isAdmin = true;
            document.getElementById('btn-login').classList.add('hidden');
            document.getElementById('btn-logout').classList.remove('hidden');
            document.getElementById('btn-admin-panel').classList.remove('hidden');
            showAdminPanel();
          } else {
            alert('รหัสผ่านไม่ถูกต้อง');
            document.getElementById('loading-state').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
          }
        })
        .withFailureHandler(function(err) { handleApiError(err, 'เข้าสู่ระบบไม่สำเร็จ'); })
        .verifyLogin(user, pass);
    }
    function logout() { isAdmin = false; document.getElementById('btn-login').classList.remove('hidden'); document.getElementById('btn-logout').classList.add('hidden'); document.getElementById('btn-admin-panel').classList.add('hidden'); hideAdminPanel(); }
    
    function showAdminPanel() { document.getElementById('main-content').classList.add('hidden'); document.getElementById('admin-dashboard').classList.remove('hidden'); document.getElementById('loading-state').classList.add('hidden'); loadDashboardData(); renderApps(); }
    function hideAdminPanel() { document.getElementById('admin-dashboard').classList.add('hidden'); document.getElementById('main-content').classList.remove('hidden'); renderApps(); }

    function toggleProjectModal() {
      const m = document.getElementById('project-modal');
      if(m.classList.contains('hidden') && !editingAppId) {
        document.getElementById('modal-title').innerText = 'เพิ่มโครงการใหม่';
        document.getElementById('new-name').value = ''; document.getElementById('new-url').value = ''; document.getElementById('new-img-file').value = '';
      }
      if(!m.classList.contains('hidden')) { editingAppId = null; croppedFileData = null; document.getElementById('crop-status-proj').classList.add('hidden'); }
      m.classList.toggle('hidden');
    }

    function editApp(id) {
      const app = appData.find(a => a.id == id);
      if(!app) return;
      editingAppId = app.id;
      document.getElementById('modal-title').innerText = 'แก้ไขโครงการ';
      document.getElementById('new-name').value = app.name;
      document.getElementById('new-url').value = app.url;
      document.getElementById('new-status').value = app.status;
      document.getElementById('new-img-file').value = '';
      croppedFileData = null;
      document.getElementById('crop-status-proj').classList.add('hidden');
      document.getElementById('project-modal').classList.remove('hidden');
    }

    function submitProject() {
      const n = document.getElementById('new-name').value, u = document.getElementById('new-url').value, s = document.getElementById('new-status').value;
      if(!n || !u) return alert('กรอกชื่อและ URL');
      document.getElementById('project-modal').classList.add('hidden');
      showLoadingUI();
      const p = { id: editingAppId, name: n, url: u, status: s, imageUrl: "" };

      if (croppedFileData) {
        setLoadingMessage('กำลังอัปโหลดและบันทึกโครงการ...');
        gasRun()
          .withSuccessHandler(afterProjectSaved)
          .withFailureHandler(function (err) {
            uploadImageFile(croppedFileData, function (imageUrl) {
              p.imageUrl = imageUrl;
              setLoadingMessage('กำลังบันทึกโครงการ...');
              gasRun()
                .withSuccessHandler(afterProjectSaved)
                .withFailureHandler(handleUploadError)
                .saveProject(p, null);
            }, setLoadingMessage);
          })
          .saveProject(p, croppedFileData);
      } else {
        setLoadingMessage('กำลังบันทึกโครงการ...');
        gasRun()
          .withSuccessHandler(afterProjectSaved)
          .withFailureHandler(handleUploadError)
          .saveProject(p, null);
      }
    }
      async function deleteApp(id) {
      try {
        await ensureSwalReady();
      } catch (e) {
        alert('โหลดกล่องโต้ตอบไม่สำเร็จ');
        return;
      }
      Swal.fire({
        title: 'คุณแน่ใจหรือไม่?',
        text: "ข้อมูลโปรเจกต์นี้จะไม่สามารถกู้คืนได้!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#9a7b6a',
        cancelButtonColor: '#2c3548',
        confirmButtonText: '<i class="fa-solid fa-trash mr-2"></i>ใช่, ลบเลย!',
        cancelButtonText: 'ยกเลิก',
        background: document.documentElement.classList.contains('dark') ? '#1a2029' : '#ffffff',
        color: document.documentElement.classList.contains('dark') ? '#f5f3ee' : '#1f2933'
      }).then((result) => {
        if (result.isConfirmed) {
          showLoadingUI();
          gasRun()
            .withSuccessHandler(function(res) {
              invalidateSessionCache();
              appData = res;
              restoreAdminUI();
              loadDashboardData();
              Swal.fire({
                title: 'ลบสำเร็จ!',
                text: 'โปรเจกต์ถูกลบออกจากระบบแล้ว',
                icon: 'success',
                confirmButtonColor: '#2c3548',
                background: document.documentElement.classList.contains('dark') ? '#1a2029' : '#ffffff',
                color: document.documentElement.classList.contains('dark') ? '#f5f3ee' : '#1f2933'
              });
            })
            .withFailureHandler(function(err) { handleApiError(err, 'ลบโปรเจกต์ไม่สำเร็จ'); })
            .deleteProject(id);
        }
      });
    }
    function toggleBgModal() { uploadTarget = 'bg'; document.getElementById('upload-title').innerText = 'เปลี่ยนรูปพื้นหลัง'; document.getElementById('upload-modal').classList.remove('hidden'); document.getElementById('upload-file').value=''; croppedFileData = null; document.getElementById('crop-status-upload').classList.add('hidden'); }
    function toggleLogoModal() { uploadTarget = 'logo'; document.getElementById('upload-title').innerText = 'เปลี่ยนโลโก้'; document.getElementById('upload-modal').classList.remove('hidden'); document.getElementById('upload-file').value=''; croppedFileData = null; document.getElementById('crop-status-upload').classList.add('hidden'); }
    function closeUploadModal() { document.getElementById('upload-modal').classList.add('hidden'); croppedFileData = null; }

    document.getElementById('btn-submit-upload').onclick = function() {
      if(!croppedFileData) return alert('กรุณาเลือกไฟล์และกดยืนยันการตัดรูปภาพก่อนครับ');
      closeUploadModal();
      showLoadingUI();
      const settingKey = uploadTarget === 'bg' ? 'BackgroundImage' : 'LogoImage';
      const fileToUpload = croppedFileData;
      const apiName = uploadTarget === 'bg' ? 'updateBackgroundImage' : 'updateLogoImage';
      setLoadingMessage('กำลังอัปโหลดรูป...');
      var uploadRunner = gasRun()
        .withSuccessHandler(function (url) {
          invalidateSessionCache();
          if (uploadTarget === 'bg' && url) {
            document.body.style.backgroundImage = "url('" + url.replace(/'/g, "\\'") + "')";
          } else if (url) {
            document.getElementById('site-logo').src = url;
            document.getElementById('site-logo').classList.remove('hidden');
            document.getElementById('default-logo-icon').classList.add('hidden');
          }
          croppedFileData = null;
          restoreAdminUI();
        })
        .withFailureHandler(function () {
          uploadImageFile(fileToUpload, function (imageUrl) {
            setLoadingMessage('กำลังบันทึกการตั้งค่า...');
            gasRun()
              .withSuccessHandler(function (url) {
                invalidateSessionCache();
                if (uploadTarget === 'bg' && url) {
                  document.body.style.backgroundImage = "url('" + url.replace(/'/g, "\\'") + "')";
                } else if (url) {
                  document.getElementById('site-logo').src = url;
                  document.getElementById('site-logo').classList.remove('hidden');
                  document.getElementById('default-logo-icon').classList.add('hidden');
                }
                croppedFileData = null;
                restoreAdminUI();
              })
              .withFailureHandler(handleUploadError)
              .setSettingImage(settingKey, imageUrl);
          }, setLoadingMessage);
        });
      uploadRunner[apiName](fileToUpload);
    };

    function showLoadingUI() { document.getElementById('loading-state').classList.remove('hidden'); document.getElementById('admin-dashboard').classList.add('hidden'); document.getElementById('main-content').classList.add('hidden'); }
    function restoreAdminUI() { document.getElementById('loading-state').classList.add('hidden'); if(isAdmin) document.getElementById('admin-dashboard').classList.remove('hidden'); else document.getElementById('main-content').classList.remove('hidden'); renderApps(); }
    async function loadDashboardData() {
      try {
        await ensureChartReady();
      } catch (err) {
        alert('ไม่สามารถโหลดกราฟได้');
        return;
      }
      gasRun()
        .withSuccessHandler(renderAdminDashboard)
        .withFailureHandler(function(err) { console.warn('dashboard', err); })
        .getAdminDashboardData();
    }

    function renderAdminDashboard(data) {
      if (!data || !Array.isArray(data.logs)) return;
      const tbody = document.getElementById('log-table-body');
      tbody.innerHTML = data.logs.map(log => `
        <tr class="hover:bg-[#f5f3ee] dark:hover:bg-[#2a3340] transition border-b border-[#e3ddd2] dark:border-[#2d3544] last:border-0">
          <td class="py-3 pl-2 whitespace-nowrap text-[#8a96a3] dark:text-[#b8c0c8] text-xs transition-colors">${escHtml(log.time)}</td>
          <td class="py-3 pr-2">
            <div class="font-medium text-[#2c3542] dark:text-[#f5f3ee] transition-colors">${escHtml(log.appName)}</div>
            <div class="text-[11px] text-[#6b7885] dark:text-[#b8c0c8] bg-[#f5f3ee] dark:bg-[#121820] inline-block px-2 py-0.5 rounded mt-1 transition-colors">${escHtml(log.email)}</div>
          </td>
        </tr>`).join('');

      const ctx = document.getElementById('usageChart').getContext('2d');
      if(chartInstance) chartInstance.destroy();
      
      const isDark = document.documentElement.classList.contains('dark');
      const gridColor = isDark ? '#1f2933' : '#e3ddd2';
      const tickColor = isDark ? '#b8c0c8' : '#6b7885';

      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: appData.map(a => a.name), datasets: [{ label: 'ยอดใช้งาน', data: appData.map(a => a.clicks), backgroundColor: '#2c3548', borderRadius: 6, maxBarThickness: 40 }] },
        options: { 
          responsive: true, maintainAspectRatio: false, 
          plugins: { legend: { display: false } }, 
          scales: { 
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } }, 
            x: { grid: { display: false }, ticks: { color: tickColor } } 
          } 
        }
      });
    }
