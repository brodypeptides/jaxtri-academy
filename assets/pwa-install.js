(function () {
  const LATER_KEY = 'jaxtri_install_later_until';
  const NEVER_KEY = 'jaxtri_install_never';
  let deferredPrompt = null;
  let booted = false;
  let currentUser = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  }

  function supportsInstallPrompt() {
    return Boolean(deferredPrompt);
  }

  function canShowBanner() {
    if (isStandalone()) return false;
    if (localStorage.getItem(NEVER_KEY) === '1') return false;
    const until = Number(localStorage.getItem(LATER_KEY) || 0);
    if (Number.isFinite(until) && until > Date.now()) return false;
    return supportsInstallPrompt() || isIos();
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
  }

  function ensureBanner() {
    if (document.getElementById('jaxtriInstallBanner')) return document.getElementById('jaxtriInstallBanner');
    const banner = document.createElement('section');
    banner.id = 'jaxtriInstallBanner';
    banner.className = 'jaxtri-install-banner';
    banner.innerHTML = `
      <div>
        <h3>Install Jaxtri Academy</h3>
        <p id="jaxtriInstallCopy">Get app-style access from your home screen. Optional, no pressure.</p>
      </div>
      <div class="actions">
        <button class="btn primary" type="button" id="jaxtriInstallBtn">Install App</button>
        <button class="btn" type="button" id="jaxtriInstallLaterBtn">Maybe later</button>
        <button class="btn" type="button" id="jaxtriInstallNeverBtn">Don’t show again</button>
      </div>`;
    document.body.appendChild(banner);
    document.getElementById('jaxtriInstallBtn')?.addEventListener('click', installApp);
    document.getElementById('jaxtriInstallLaterBtn')?.addEventListener('click', () => dismissForDays(14));
    document.getElementById('jaxtriInstallNeverBtn')?.addEventListener('click', dismissForever);
    return banner;
  }

  function refreshBanner() {
    const banner = ensureBanner();
    const copy = document.getElementById('jaxtriInstallCopy');
    const installBtn = document.getElementById('jaxtriInstallBtn');

    if (isIos() && !supportsInstallPrompt()) {
      if (installBtn) installBtn.textContent = 'Show iPhone Steps';
      if (copy) copy.textContent = 'On iPhone, install from Safari: Share → Add to Home Screen.';
    } else {
      if (installBtn) installBtn.textContent = 'Install App';
      if (copy) copy.textContent = 'Get app-style access from your home screen. Optional, no pressure.';
    }

    banner.classList.toggle('show', canShowBanner());
  }

  async function installApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      refreshBanner();
      renderPwaPanel();
      return;
    }

    if (isIos()) {
      alert('On iPhone: open this site in Safari, tap the Share icon, then tap Add to Home Screen. After it is installed, open Jaxtri from the new home screen icon.');
      dismissForDays(7);
    }
  }

  function dismissForDays(days) {
    localStorage.setItem(LATER_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
    refreshBanner();
  }

  function dismissForever() {
    localStorage.setItem(NEVER_KEY, '1');
    refreshBanner();
  }

  function resetInstallPrompt() {
    localStorage.removeItem(LATER_KEY);
    localStorage.removeItem(NEVER_KEY);
    refreshBanner();
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function notificationSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async function getRegistration() {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported on this browser.');
    return await navigator.serviceWorker.ready;
  }

  async function getPublicKey() {
    const response = await fetch('/api/push/public-key');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load Web Push key.');
    if (!data.configured || !data.public_key) throw new Error('Web Push is not configured yet. Add the Cloudflare Web Push variables first.');
    return data.public_key;
  }

  function deviceLabel() {
    const ua = navigator.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone / iPad';
    if (/android/i.test(ua)) return 'Android';
    if (/windows/i.test(ua)) return 'Windows desktop';
    if (/macintosh|mac os/i.test(ua)) return 'Mac desktop';
    return 'Browser device';
  }

  async function loadPushState() {
    const state = { supported: notificationSupported(), permission: Notification?.permission || 'unsupported', browserSubscription: null, server: null, error: null };
    try {
      if (state.supported) {
        const registration = await getRegistration();
        state.browserSubscription = await registration.pushManager.getSubscription();
      }
      const response = await fetch('/api/push/subscription');
      const data = await response.json().catch(() => ({}));
      if (response.ok) state.server = data;
      else state.error = data.error || 'Push database is not ready yet.';
    } catch (error) {
      state.error = error.message || 'Could not load push state.';
    }
    return state;
  }

  async function enablePush() {
    try {
      setPushStatus('Requesting notification permission...');
      if (!notificationSupported()) throw new Error('This browser does not support web push notifications.');
      if (isIos() && !isStandalone()) {
        throw new Error('On iPhone, install Jaxtri to your Home Screen first, then open the installed app and enable notifications.');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');

      const publicKey = await getPublicKey();
      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const payload = subscription.toJSON();
      payload.device_label = deviceLabel();
      const response = await fetch('/api/push/subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save push subscription.');

      setPushStatus('Push notifications enabled.', 'success');
      renderPwaPanel();
    } catch (error) {
      setPushStatus(error.message || 'Could not enable push notifications.', 'error');
    }
  }

  async function disablePush() {
    try {
      setPushStatus('Disabling push notifications...');
      let endpoint = null;
      if (notificationSupported()) {
        const registration = await getRegistration();
        const subscription = await registration.pushManager.getSubscription();
        endpoint = subscription?.endpoint || null;
        if (subscription) await subscription.unsubscribe().catch(() => null);
      }

      const response = await fetch('/api/push/subscription', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not disable push notifications.');

      setPushStatus('Push notifications disabled.', 'success');
      renderPwaPanel();
    } catch (error) {
      setPushStatus(error.message || 'Could not disable push notifications.', 'error');
    }
  }

  async function sendTestPush() {
    try {
      setPushStatus('Sending test notification...');
      const response = await fetch('/api/push/test', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not send test push.');
      setPushStatus(`Test sent to ${data.sent} device${data.sent === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      setPushStatus(error.message || 'Could not send test notification.', 'error');
    }
  }

  function setPushStatus(message, type = '') {
    const el = document.getElementById('jaxtriPushStatus');
    if (!el) return;
    el.className = `notice jaxtri-pwa-status ${type}`.trim();
    el.textContent = message;
  }

  function installPanelHtml() {
    const iPhoneSteps = `
      <ol class="jaxtri-ios-steps">
        <li>Open jaxtrilabsacademy.com in Safari.</li>
        <li>Tap the Share icon.</li>
        <li>Tap Add to Home Screen.</li>
        <li>Open Jaxtri from the new app icon.</li>
      </ol>`;

    return `
      <section class="card compact-card jaxtri-pwa-panel" id="jaxtriPwaPanelInner">
        <div class="section-head-row">
          <div>
            <p class="eyebrow">Mobile app</p>
            <h2>Install + push notifications</h2>
            <p class="small">Optional. Users can keep using the website normally, or install it like an app and turn on phone alerts.</p>
          </div>
          <span id="jaxtriPwaInstallState" class="jaxtri-status-pill off">Checking...</span>
        </div>
        <div class="jaxtri-pwa-grid">
          <div class="jaxtri-pwa-box">
            <h3>Add to Home Screen</h3>
            <p class="small">Install Jaxtri as an app-style shortcut. Android can show an install popup. iPhone uses the Safari Share menu.</p>
            ${isIos() ? iPhoneSteps : ''}
            <div class="actions" style="margin-top:12px">
              <button class="btn primary" type="button" id="jaxtriPanelInstallBtn">Install / Instructions</button>
              <button class="btn" type="button" id="jaxtriPanelResetInstallBtn">Show install banner</button>
            </div>
          </div>
          <div class="jaxtri-pwa-box">
            <h3>Push notifications</h3>
            <p class="small">Enable app-style alerts for payouts, commissions, applications, team messages, and webhook warnings.</p>
            <div class="actions" style="margin-top:12px">
              <button class="btn primary" type="button" id="jaxtriEnablePushBtn">Enable notifications</button>
              <button class="btn" type="button" id="jaxtriDisablePushBtn">Disable</button>
              <button class="btn" type="button" id="jaxtriTestPushBtn">Send test</button>
            </div>
            <div id="jaxtriPushStatus" class="notice jaxtri-pwa-status">Checking push status...</div>
            <div id="jaxtriDeviceList" class="jaxtri-device-list"></div>
          </div>
        </div>
      </section>`;
  }

  async function renderPwaPanel() {
    const mount = document.getElementById('pwaInstallPanel');
    if (!mount) return;
    mount.innerHTML = installPanelHtml();

    document.getElementById('jaxtriPanelInstallBtn')?.addEventListener('click', installApp);
    document.getElementById('jaxtriPanelResetInstallBtn')?.addEventListener('click', () => { resetInstallPrompt(); alert('Install banner can show again when this browser supports it.'); });
    document.getElementById('jaxtriEnablePushBtn')?.addEventListener('click', enablePush);
    document.getElementById('jaxtriDisablePushBtn')?.addEventListener('click', disablePush);
    document.getElementById('jaxtriTestPushBtn')?.addEventListener('click', sendTestPush);

    const installState = document.getElementById('jaxtriPwaInstallState');
    if (installState) {
      installState.textContent = isStandalone() ? 'Installed' : 'Optional';
      installState.className = `jaxtri-status-pill ${isStandalone() ? '' : 'off'}`;
    }

    const state = await loadPushState();
    const enableBtn = document.getElementById('jaxtriEnablePushBtn');
    const disableBtn = document.getElementById('jaxtriDisablePushBtn');
    const testBtn = document.getElementById('jaxtriTestPushBtn');
    const list = document.getElementById('jaxtriDeviceList');

    const activeDevices = (state.server?.subscriptions || []).filter((sub) => sub.status === 'active');
    const enabled = Boolean(state.browserSubscription || activeDevices.length);

    if (!state.supported) {
      setPushStatus('This browser does not support web push notifications.', 'error');
      if (enableBtn) enableBtn.disabled = true;
      if (disableBtn) disableBtn.disabled = true;
      if (testBtn) testBtn.disabled = true;
    } else if (state.error) {
      setPushStatus(state.error, 'error');
      if (testBtn) testBtn.disabled = true;
    } else {
      setPushStatus(enabled ? `Push is enabled. Permission: ${state.permission}.` : `Push is off. Permission: ${state.permission}.`, enabled ? 'success' : '');
      if (testBtn) testBtn.disabled = !enabled;
    }

    if (list) {
      if (!activeDevices.length) {
        list.innerHTML = '<div class="jaxtri-device-item"><span>No active devices yet.</span><span class="jaxtri-status-pill off">Off</span></div>';
      } else {
        list.innerHTML = activeDevices.map((sub) => `
          <div class="jaxtri-device-item">
            <span><strong>${escapeHtml(sub.device_label || 'Device')}</strong><br><small>${escapeHtml(sub.endpoint_tail || '')}</small></span>
            <span class="jaxtri-status-pill">Active</span>
          </div>`).join('');
      }
    }
  }

  function boot(user) {
    if (booted) return;
    booted = true;
    currentUser = user || null;
    refreshBanner();
    renderPwaPanel();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    refreshBanner();
    renderPwaPanel();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    localStorage.setItem(NEVER_KEY, '1');
    refreshBanner();
    renderPwaPanel();
  });

  window.JaxtriPwa = { boot, enablePush, disablePush, sendTestPush, renderPwaPanel, resetInstallPrompt };

  if (window.JaxtriCurrentUser) boot(window.JaxtriCurrentUser);
})();
