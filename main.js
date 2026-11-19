// Longboard's site: the download picker and the demonstration TV.
// No dependencies. The one request this makes is to GitHub's public API,
// for the latest release of Longboard.
(function () {
  'use strict';

  var REPO = 'AndrewGBest/Longboard';
  var RELEASE_FEED = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var RELEASE_PAGE = 'https://github.com/' + REPO + '/releases/latest';
  var LATEST_FILE = RELEASE_PAGE + '/download/';

  // ------------------------------------------------------------------
  // Downloads
  // ------------------------------------------------------------------

  // The names a release's files carry for each kind of processor. The
  // AppImage names are the ones Longboard's own updater looks for
  // (src/shared/update.ts), so those two have addresses that work before the
  // release has been read. The other packages are found in the release by
  // their ending and the processor's name.
  var ARCHES = {
    x64: { label: 'x86-64', words: /(x86[_-]64|x64|amd64)/i, appimage: 'Longboard-x86_64.AppImage' },
    arm64: { label: 'ARM64', words: /(arm64|aarch64)/i, appimage: 'Longboard-arm64.AppImage' },
  };
  var FORMATS = {
    appimage: { label: 'AppImage', ending: /\.AppImage$/i, how: function (f) { return 'chmod +x ' + f + '\n./' + f; } },
    flatpak: { label: 'Flatpak bundle', ending: /\.flatpak$/i, how: function (f) { return 'flatpak install --user ./' + f; } },
    targz: { label: 'tar.gz', ending: /\.tar\.gz$/i, how: function (f) { return 'tar -xzf ' + f; } },
  };

  var OS_NAMES = { windows: 'Windows', mac: 'macOS', android: 'Android', ios: 'an iPhone or iPad', chromeos: 'ChromeOS' };

  /** What the visitor's browser says it runs on: {os, arch}. arch is null when it does not say. */
  function detectPlatform() {
    var ua = navigator.userAgent || '';
    var data = navigator.userAgentData;
    var platform = ((data && data.platform) || navigator.platform || '').toLowerCase();
    var os = 'other';
    if (/android/i.test(ua) || platform === 'android') os = 'android';
    else if (/iphone|ipad|ipod/i.test(ua) || (/mac/.test(platform) && navigator.maxTouchPoints > 1)) os = 'ios';
    else if (/cros/i.test(ua) || platform === 'chrome os' || platform === 'chromeos') os = 'chromeos';
    else if (/win/.test(platform) || /windows/i.test(ua)) os = 'windows';
    else if (/mac/.test(platform) || /mac os x/i.test(ua)) os = 'mac';
    else if (/linux|x11/.test(platform) || /linux|x11/i.test(ua)) os = 'linux';

    var arch = null;
    if (/aarch64|arm64|armv8/i.test(ua + ' ' + platform)) arch = 'arm64';
    else if (/x86_64|x64|amd64|win64/i.test(ua + ' ' + platform)) arch = 'x64';
    return { os: os, arch: arch };
  }

  /**
   * Chromium keeps "x86_64" in its user agent on every Linux machine, so
   * where the browser has the newer interface it is asked directly.
   */
  function askArchitecture() {
    var data = navigator.userAgentData;
    if (!data || typeof data.getHighEntropyValues !== 'function') return Promise.resolve(null);
    return data.getHighEntropyValues(['architecture', 'bitness']).then(function (v) {
      if (v.architecture === 'arm') return 'arm64';
      if (v.architecture === 'x86') return 'x64';
      return null;
    }).catch(function () { return null; });
  }

  function megabytes(bytes) {
    return Math.round(bytes / 1e6) + ' MB';
  }

  /** The files of a release, sorted into {arch: {format: {name, url, size}}}. Addresses must be GitHub's. */
  function sortAssets(release) {
    var out = { x64: {}, arm64: {} };
    var assets = Array.isArray(release.assets) ? release.assets : [];
    assets.forEach(function (a) {
      if (!a || typeof a.name !== 'string' || typeof a.browser_download_url !== 'string') return;
      if (a.browser_download_url.indexOf('https://github.com/' + REPO + '/releases/download/') !== 0) return;
      Object.keys(FORMATS).forEach(function (f) {
        if (!FORMATS[f].ending.test(a.name)) return;
        Object.keys(ARCHES).forEach(function (arch) {
          if (ARCHES[arch].words.test(a.name) && !out[arch][f]) {
            out[arch][f] = { name: a.name, url: a.browser_download_url, size: typeof a.size === 'number' ? a.size : 0 };
          }
        });
      });
    });
    return out;
  }

  var state = { platform: detectPlatform(), arch: 'x64', archKnown: false, release: null, files: null };
  if (state.platform.arch) { state.arch = state.platform.arch; state.archKnown = true; }

  function $(id) { return document.getElementById(id); }

  /** The file for a format on the chosen processor: from the release when it has been read, else what is known beforehand. */
  function fileFor(format) {
    var known = state.files && state.files[state.arch][format];
    if (known) return known;
    if (format === 'appimage' && !state.files) {
      var name = ARCHES[state.arch].appimage;
      return { name: name, url: LATEST_FILE + name, size: 0 };
    }
    return null;
  }

  function renderDownloads() {
    var arch = ARCHES[state.arch];
    var os = state.platform.os;
    var version = state.release ? state.release.version : '';

    // The button at the top.
    var top = fileFor('appimage');
    var hero = $('hero-download');
    if (hero) {
      hero.href = top ? top.url : '#download';
      $('hero-download-label').textContent = 'Download for Linux';
      var bits = [arch.label + ' AppImage'];
      if (version) bits.push('version ' + version);
      if (top && top.size) bits.push(megabytes(top.size));
      if (!version) bits.push('latest release');
      $('hero-download-sub').textContent = bits.join(' · ');
    }
    var note = $('hero-note');
    if (note) {
      if (os === 'linux') {
        note.textContent = 'Free, GPL-3.0. No telemetry.' + (state.archKnown ? '' : ' On an ARM box? See all packages.');
      } else if (OS_NAMES[os]) {
        note.textContent = 'You are on ' + OS_NAMES[os] + '. Longboard runs on Linux, so this is for the box behind your TV. Free, GPL-3.0.';
      }
    }

    // The section's opening line.
    var line = $('dl-detected');
    if (line) {
      var tail = ' These always point at the latest release.';
      if (os === 'linux' && state.archKnown) line.textContent = 'This looks like Linux on ' + arch.label + ', so that is what is picked below.' + tail;
      else if (os === 'linux') line.textContent = 'This looks like Linux. Pick the processor your TV box has.' + tail;
      else if (os === 'android') line.textContent = 'You are on Android. Longboard runs on Linux with a desktop session; there is no Android TV version. Pick a package for the box behind your TV.' + tail;
      else if (OS_NAMES[os]) line.textContent = 'You are on ' + OS_NAMES[os] + '. Longboard runs on Linux with a desktop session, so pick a package for the box behind your TV.' + tail;
    }
    var badge = $('dl-version');
    if (badge) badge.textContent = version ? 'v' + version : '';

    // One card per kind of package.
    Object.keys(FORMATS).forEach(function (f) {
      var card = document.querySelector('.package[data-format="' + f + '"]');
      if (!card) return;
      var file = fileFor(f);
      var link = card.querySelector('[data-link]');
      var meta = card.querySelector('[data-meta]');
      var how = card.querySelector('[data-how]');
      var strong = link.querySelector('strong');
      card.classList.toggle('missing', !file);
      if (file) {
        link.href = file.url;
        strong.textContent = 'Download';
        meta.textContent = arch.label + (file.size ? ' · ' + megabytes(file.size) : '');
        how.textContent = FORMATS[f].how(file.name);
      } else {
        link.href = RELEASE_PAGE;
        strong.textContent = state.files ? 'Not in this release' : 'Download';
        meta.textContent = state.files ? 'See the release page' : arch.label + ' · on the release page';
      }
    });

    var radio = document.querySelector('input[name="arch"][value="' + state.arch + '"]');
    if (radio) radio.checked = true;
  }

  function startDownloads() {
    var picker = $('picker');
    if (picker) picker.hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="arch"]'), function (input) {
      input.addEventListener('change', function () {
        if (!input.checked) return;
        state.arch = input.value;
        state.archKnown = true;
        renderDownloads();
      });
    });
    renderDownloads();

    askArchitecture().then(function (arch) {
      // What the visitor chose by hand is not overridden.
      var chosen = document.querySelector('input[name="arch"]:checked');
      if (!arch || (chosen && chosen.value !== state.arch)) return;
      if (state.platform.os !== 'linux' && state.platform.os !== 'chromeos' && state.platform.os !== 'other') return;
      state.arch = arch;
      state.archKnown = true;
      renderDownloads();
    });

    if (typeof fetch !== 'function') return;
    fetch(RELEASE_FEED, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (raw) {
        if (!raw || raw.draft || raw.prerelease) return;
        var m = /^v?(\d{1,5}\.\d{1,5}\.\d{1,5})$/.exec(String(raw.tag_name || '').trim());
        if (!m) return;
        state.release = { version: m[1] };
        state.files = sortAssets(raw);
        renderDownloads();
      })
      .catch(function () { /* The addresses the page started with still work. */ });
  }

  // ------------------------------------------------------------------
  // The demonstration TV: a small copy of how Longboard moves a highlight.
  // ------------------------------------------------------------------

  function startDemo() {
    var tv = $('tv');
    var screen = $('screen');
    var remote = $('remote');
    var toast = $('toast');
    if (!tv || !screen || !remote) return;

    var views = {};
    Array.prototype.forEach.call(screen.querySelectorAll('[data-view]'), function (v) { views[v.getAttribute('data-view')] = v; });
    var stack = ['home'];
    var remembered = {};
    var toastTimer = 0;

    function top() { return views[stack[stack.length - 1]]; }
    function targets() { return Array.prototype.slice.call(top().querySelectorAll('[data-t]')); }
    function focused() { return top().querySelector('[data-focus]'); }

    function focus(el) {
      Array.prototype.forEach.call(screen.querySelectorAll('[data-focus]'), function (e) { e.removeAttribute('data-focus'); });
      if (el) { el.setAttribute('data-focus', ''); remembered[stack[stack.length - 1]] = el; }
    }

    function show() {
      var name = stack[stack.length - 1];
      Object.keys(views).forEach(function (k) {
        // The menu lies over whatever is beneath it.
        views[k].hidden = !(k === name || (name === 'menu' && k === stack[stack.length - 2]));
      });
      var again = remembered[name];
      focus(again && name !== 'menu' && name !== 'site' ? again : top().querySelector('[data-start]') || targets()[0]);
    }

    function say(text) {
      toast.textContent = text;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.hidden = true; }, 2600);
    }

    /**
     * The nearest sensible target in a direction. A target that lines up
     * with the current one beats a nearer one that does not.
     */
    function move(dir) {
      var from = focused();
      var all = targets();
      if (!from) { focus(all[0]); return; }
      var a = from.getBoundingClientRect();
      var best = null;
      var bestScore = Infinity;
      all.forEach(function (el) {
        if (el === from) return;
        var b = el.getBoundingClientRect();
        var along, across, overlap;
        var acx = a.left + a.width / 2, acy = a.top + a.height / 2;
        var bcx = b.left + b.width / 2, bcy = b.top + b.height / 2;
        if (dir === 'left' || dir === 'right') {
          along = dir === 'right' ? b.left - a.right : a.left - b.right;
          if ((dir === 'right' ? bcx - acx : acx - bcx) <= 1) return;
          across = Math.abs(bcy - acy);
          overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
          // Left and right stay inside a row.
          if (!overlap) return;
        } else {
          along = dir === 'down' ? b.top - a.bottom : a.top - b.bottom;
          if ((dir === 'down' ? bcy - acy : acy - bcy) <= 1) return;
          across = Math.abs(bcx - acx);
          overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0;
        }
        var score = Math.max(along, 0) + across * (overlap ? 0.35 : 2);
        if (score < bestScore) { bestScore = score; best = el; }
      });
      if (best) focus(best);
    }

    function back() {
      if (stack.length > 1) { stack.pop(); show(); }
      else say('Already on Home');
    }

    function menu() {
      if (stack[stack.length - 1] === 'menu') { back(); return; }
      stack.push('menu');
      show();
    }

    function ok() {
      var el = focused();
      if (!el) return;
      var action = el.getAttribute('data-do') || '';
      if (action.indexOf('open:') === 0) {
        $('site-name').textContent = action.slice(5);
        stack.push('site');
        show();
      } else if (action.indexOf('say:') === 0) {
        say(action.slice(4));
      } else if (action === 'menu') {
        menu();
      } else if (action === 'home') {
        stack = ['home'];
        show();
      } else if (action === 'toggle') {
        el.querySelector('.switch').classList.toggle('on');
      }
    }

    function press(key) {
      var button = remote.querySelector('[data-key="' + key + '"]');
      if (button) {
        button.classList.add('pressed');
        setTimeout(function () { button.classList.remove('pressed'); }, 160);
      }
      if (key === 'ok') ok();
      else if (key === 'back') back();
      else if (key === 'menu') menu();
      else move(key);
    }

    // Until somebody takes the remote, it plays by itself.
    var script = ['right', 'right', 'down', 'left', 'ok', 'down', 'right', 'right', 'ok', 'up', 'back', 'up', 'up', 'right', 'ok', 'down', 'down', 'ok', 'back', 'down', 'left', 'left', 'left'];
    var step = 0;
    var auto = 0;
    var visible = false;
    var taken = false;
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function tick() {
      if (taken || !visible || document.hidden) return;
      press(script[step % script.length]);
      step++;
    }
    function take() {
      taken = true;
      clearInterval(auto);
    }
    if (!still) {
      auto = setInterval(tick, 1150);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0.4 }).observe(screen);
      } else {
        visible = true;
      }
    }

    remote.addEventListener('click', function (e) {
      var button = e.target.closest ? e.target.closest('[data-key]') : null;
      if (!button) return;
      take();
      press(button.getAttribute('data-key'));
    });

    screen.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-t]') : null;
      if (!el || !top().contains(el)) return;
      take();
      focus(el);
      ok();
    });

    var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Backspace: 'back', Escape: 'back' };
    tv.addEventListener('keydown', function (e) {
      var key = KEYS[e.key];
      if (!key || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      take();
      press(key);
    });

    function clock() {
      var now = new Date();
      $('demo-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      $('demo-day').textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    }
    clock();
    setInterval(clock, 30000);

    show();
  }

  startDownloads();
  startDemo();
})();
