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
      var fallback = 'https://via.placeholder.com/400x200.png?text=No+Image';
      if (!url) return fallback;
      if (/drive\.google\.com\/thumbnail/i.test(url)) {
        return url.replace(/sz=w\d+/i, 'sz=w400');
      }
      return url;
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
      gasRun()
        .withSuccessHandler(function (data) {
          initApp(data, { silent: true });
        })
        .withFailureHandler(function () {})
        .getInitialData();
    }

    document.addEventListener('DOMContentLoaded', function() {
      syncThemeIcon();
      loadFontAwesomeDeferred();
      loadSarabunDeferred();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      }
      var hadCache = tryHydrateFromCache();
      if (hadCache) {
        refreshDataInBackground();
        return;
      }
      var loadTimer = setTimeout(function() {
        var el = document.getElementById('loading-state');
        var main = document.getElementById('main-content');
        if (el && main && main.classList.contains('hidden')) {
          el.innerHTML = '<p class="text-center text-red-500 px-4">โหลดข้อมูลไม่สำเร็จ โปรดรีเฟรชหน้า</p>';
        }
      }, 25000);
      gasRun()
        .withSuccessHandler(function(data) {
          clearTimeout(loadTimer);
          initApp(data, { fromCache: false });
        })
        .withFailureHandler(function(err) {
          clearTimeout(loadTimer);
          console.error(err);
          var el = document.getElementById('loading-state');
          if (el) el.innerHTML = '<p class="text-center text-red-500 px-4">โหลดข้อมูลไม่สำเร็จ โปรดรีเฟรชหน้า</p>';
        })
        .getInitialData();
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
      document.getElementById('user-email').innerText = data.email;
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

      document.getElementById('loading-state').classList.add('hidden');
      document.getElementById('main-content').classList.remove('hidden');
      renderApps();

      if (!opts.silent) {
        persistCache(data);
      }
    }

    function renderBanner() {
      const banner = document.getElementById('top-banner');
      const textDisplay = document.getElementById('banner-text-display');
      
      if (globalBannerVisible && globalBannerText.trim() !== '') {
        textDisplay.innerHTML = globalBannerText.replace(/\n/g, ' &nbsp;&nbsp;&nbsp; ');
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
      gasRun().withSuccessHandler(function() {
        invalidateSessionCache();
        globalBannerText = text;
        globalBannerVisible = isVisible;
        renderBanner(); 
        restoreAdminUI();
      }).updateBanner(text, isVisible);
    }

    function renderApps() {
      const grid = document.getElementById('app-grid');
      grid.innerHTML = '';
      const sortType = document.getElementById('sort-select').value;
      let sortedApps = [...appData];
      
      if(sortType === 'popular') sortedApps.sort((a, b) => b.clicks - a.clicks);
      else sortedApps.sort((a, b) => a.name.localeCompare(b.name));

      sortedApps.forEach(app => {
        const isReady = app.status === 'พร้อมใช้งาน';
        const cardClass = isReady ? 'glass-card hover:-translate-y-1 transition-transform cursor-pointer' : 'glass-card grayscale-card';
        const badgeClass = isReady ? 'bg-[#f0e6f5] dark:bg-[#473b4d] text-[#9b82c3] dark:text-[#d0b3e8]' : 'bg-[#f2f2f2] dark:bg-[#332b3d] text-[#8b7a96] dark:text-[#a994b5]';
        const imgUrl = thumbUrl(app.imageUrl);

        const adminControls = isAdmin 
          ? `<div class="flex items-center gap-3">
               <span class="text-xs text-[#a994b5] dark:text-[#cbbcd6] bg-[#f8f6fb] dark:bg-[#1a1423] px-2 py-1 rounded-md transition-colors"><i class="fa-solid fa-chart-simple mr-1"></i> ${app.clicks}</span>
               <button onclick="event.stopPropagation(); editApp('${app.id}')" class="text-[#b19cd9] hover:text-[#9b82c3] transition" title="แก้ไข"><i class="fa-solid fa-pen-to-square text-lg"></i></button>
               <button onclick="event.stopPropagation(); deleteApp('${app.id}')" class="text-[#d69f9f] hover:text-[#c48787] transition" title="ลบ"><i class="fa-solid fa-trash text-lg"></i></button>
             </div>` : ``;

        grid.innerHTML += `
          <div class="rounded-3xl overflow-hidden flex flex-col ${cardClass}" onclick="openApp('${app.id}', '${app.name}', '${app.url}', ${isReady})">
            <div class="h-40 w-full overflow-hidden border-b border-[#ede6f2] dark:border-[#473b4d] transition-colors bg-[#ede6f2] dark:bg-[#332b3d]">
              <img src="${imgUrl}" alt="" class="h-40 w-full object-cover" width="400" height="160" loading="lazy" decoding="async" fetchpriority="low" />
            </div>
            <div class="p-6 flex-grow flex flex-col justify-between">
              <div>
                <h3 class="font-bold text-lg mb-2 text-[#473b4d] dark:text-[#f8f6fb] break-words transition-colors">${app.name}</h3>
                <span class="text-xs font-medium px-3 py-1 rounded-full ${badgeClass} transition-colors">${app.status}</span>
              </div>
              <div class="mt-5 flex justify-between items-end">
                <div class="w-8 h-8 rounded-full bg-[#f8f6fb] dark:bg-[#1a1423] flex items-center justify-center text-[#b19cd9] shadow-inner transition-colors">
                  <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                </div>
                ${adminControls}
              </div>
            </div>
          </div>`;
      });
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

    function confirmCrop() {
      if (!cropper) return;
      const canvas = cropper.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200 });
      const fileInput = document.getElementById('new-img-file').files.length > 0 ? document.getElementById('new-img-file') : document.getElementById('upload-file');
      const originalFile = fileInput.files[0];
      const base64Url = canvas.toDataURL(originalFile.type);
      croppedFileData = { data: base64Url.split(',')[1], mimeType: originalFile.type, name: originalFile.name };
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
      gasRun().withSuccessHandler(res => {
        if(res) { isAdmin = true; document.getElementById('btn-login').classList.add('hidden'); document.getElementById('btn-logout').classList.remove('hidden'); document.getElementById('btn-admin-panel').classList.remove('hidden'); showAdminPanel(); } 
        else { alert('รหัสผ่านไม่ถูกต้อง'); document.getElementById('loading-state').classList.add('hidden'); document.getElementById('main-content').classList.remove('hidden'); }
      }).verifyLogin(user, pass);
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
      document.getElementById('project-modal').classList.add('hidden'); showLoadingUI();
      const p = { id: editingAppId, name: n, url: u, status: s, imageUrl: "" };
      
      if (croppedFileData) {
        gasRun().withSuccessHandler(res => { invalidateSessionCache(); appData = res; editingAppId = null; croppedFileData = null; restoreAdminUI(); loadDashboardData(); }).saveProject(p, croppedFileData);
      } else {
        gasRun().withSuccessHandler(res => { invalidateSessionCache(); appData = res; editingAppId = null; restoreAdminUI(); loadDashboardData(); }).saveProject(p, null);
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
        confirmButtonColor: '#d69f9f',
        cancelButtonColor: '#b19cd9',
        confirmButtonText: '<i class="fa-solid fa-trash mr-2"></i>ใช่, ลบเลย!',
        cancelButtonText: 'ยกเลิก',
        background: document.documentElement.classList.contains('dark') ? '#2d2337' : '#ffffff',
        color: document.documentElement.classList.contains('dark') ? '#f8f6fb' : '#473b4d'
      }).then((result) => {
        if (result.isConfirmed) {
          showLoadingUI();
          gasRun().withSuccessHandler(res => {
            invalidateSessionCache();
            appData = res; 
            restoreAdminUI(); 
            loadDashboardData(); 
            
            Swal.fire({
              title: 'ลบสำเร็จ!',
              text: 'โปรเจกต์ถูกลบออกจากระบบแล้ว',
              icon: 'success',
              confirmButtonColor: '#b19cd9',
              background: document.documentElement.classList.contains('dark') ? '#2d2337' : '#ffffff',
              color: document.documentElement.classList.contains('dark') ? '#f8f6fb' : '#473b4d'
            });
            
          }).deleteProject(id);
        }
      });
    }
    function toggleBgModal() { uploadTarget = 'bg'; document.getElementById('upload-title').innerText = 'เปลี่ยนรูปพื้นหลัง'; document.getElementById('upload-modal').classList.remove('hidden'); document.getElementById('upload-file').value=''; croppedFileData = null; document.getElementById('crop-status-upload').classList.add('hidden'); }
    function toggleLogoModal() { uploadTarget = 'logo'; document.getElementById('upload-title').innerText = 'เปลี่ยนโลโก้'; document.getElementById('upload-modal').classList.remove('hidden'); document.getElementById('upload-file').value=''; croppedFileData = null; document.getElementById('crop-status-upload').classList.add('hidden'); }
    function closeUploadModal() { document.getElementById('upload-modal').classList.add('hidden'); croppedFileData = null; }

    document.getElementById('btn-submit-upload').onclick = function() {
      if(!croppedFileData) return alert('กรุณาเลือกไฟล์และกดยืนยันการตัดรูปภาพก่อนครับ');
      closeUploadModal(); showLoadingUI();
      if(uploadTarget === 'bg') {
        gasRun().withSuccessHandler(url => { invalidateSessionCache(); if(url) document.body.style.backgroundImage = `url('${url}')`; croppedFileData = null; restoreAdminUI(); }).updateBackgroundImage(croppedFileData);
      } else {
        gasRun().withSuccessHandler(url => { 
          invalidateSessionCache();
          if(url) { document.getElementById('site-logo').src = url; document.getElementById('site-logo').classList.remove('hidden'); document.getElementById('default-logo-icon').classList.add('hidden'); } 
          croppedFileData = null; restoreAdminUI(); 
        }).updateLogoImage(croppedFileData);
      }
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
      gasRun().withSuccessHandler(renderAdminDashboard).getAdminDashboardData();
    }

    function renderAdminDashboard(data) {
      const tbody = document.getElementById('log-table-body');
      tbody.innerHTML = data.logs.map(log => `
        <tr class="hover:bg-[#f8f6fb] dark:hover:bg-[#3b2d47] transition border-b border-[#ede6f2] dark:border-[#473b4d] last:border-0">
          <td class="py-3 pl-2 whitespace-nowrap text-[#a994b5] dark:text-[#cbbcd6] text-xs transition-colors">${log.time}</td>
          <td class="py-3 pr-2">
            <div class="font-medium text-[#524459] dark:text-[#f8f6fb] transition-colors">${log.appName}</div>
            <div class="text-[11px] text-[#8b7a96] dark:text-[#cbbcd6] bg-[#f8f6fb] dark:bg-[#1a1423] inline-block px-2 py-0.5 rounded mt-1 transition-colors">${log.email}</div>
          </td>
        </tr>`).join('');

      const ctx = document.getElementById('usageChart').getContext('2d');
      if(chartInstance) chartInstance.destroy();
      
      const isDark = document.documentElement.classList.contains('dark');
      const gridColor = isDark ? '#473b4d' : '#ede6f2';
      const tickColor = isDark ? '#cbbcd6' : '#8b7a96';

      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: appData.map(a => a.name), datasets: [{ label: 'ยอดใช้งาน', data: appData.map(a => a.clicks), backgroundColor: '#b19cd9', borderRadius: 6, maxBarThickness: 40 }] },
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

