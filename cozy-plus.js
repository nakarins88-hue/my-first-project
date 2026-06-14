/* ==========================================================================
   Cozy Plus — add-on features for the Jeff Bernat Cozy Music Lounge
   --------------------------------------------------------------------------
   Fully decoupled: talks to the page only through DOM ids / element clicks,
   never touches player-v8.js internals. Safe to load/unload independently.

     • Sleep Timer (fade-out + auto-pause)
     • Playback Speed cycle
     • Expanded keyboard shortcuts + help overlay
     • Listening Insights (play counts, total time, most played)
     • "Now Playing" browser-tab title
     • Personalised time-of-day greeting for หมูเล็ก
   ========================================================================== */
(function () {
  'use strict';

  // ---- tiny helpers --------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  function lsGet(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota/disabled */ }
  }
  // Reuse the app's toast if available, else fall back to a console note
  function toast(title, desc, dur) {
    if (typeof window.showToast === 'function') { window.showToast(title, desc, dur || 6000); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const audio = $('main-audio');
    if (!audio) return; // nothing to enhance without the player

    const ORIGINAL_TITLE = document.title;

    /* =====================================================================
       1) PLAYBACK SPEED
       ===================================================================== */
    (function initSpeed() {
      const btn = $('speed-btn');
      if (!btn) return;
      const label = btn.querySelector('.speed-label');
      const SPEEDS = [1, 1.25, 1.5, 0.75];
      let speed = parseFloat(lsGet('cozy_playback_speed', 1)) || 1;

      function apply(showToast) {
        try { audio.playbackRate = speed; } catch (e) { /* ignore */ }
        // keep the app's own settings object in sync if it exists
        try { if (typeof appSettings === 'object' && appSettings) appSettings.playbackSpeed = speed; } catch (e) { /* ignore */ }
        if (label) label.textContent = speed + 'x';
        btn.classList.toggle('is-altered', speed !== 1);
        if (showToast) toast('ความเร็ว ' + speed + 'x 🎚️', speed === 1 ? 'กลับมาความเร็วปกติแล้ว' : 'ปรับจังหวะเพลงให้ฟินขึ้นอีกนิด');
      }

      btn.addEventListener('click', () => {
        const i = SPEEDS.indexOf(speed);
        speed = SPEEDS[(i + 1) % SPEEDS.length];
        lsSet('cozy_playback_speed', speed);
        apply(true);
      });

      // Re-apply after a new track loads (changing src can reset playbackRate)
      ['loadeddata', 'playing'].forEach(ev => audio.addEventListener(ev, () => {
        if (audio.playbackRate !== speed) { try { audio.playbackRate = speed; } catch (e) {} }
      }));

      apply(false);
    })();

    /* =====================================================================
       2) SLEEP TIMER (gentle fade-out, then pause)
       ===================================================================== */
    const sleep = (function initSleep() {
      const btn = $('sleep-timer-btn');
      const pop = $('sleep-timer-popover');
      const activeRow = $('sleep-active-row');
      const remainEl = $('sleep-remaining');
      const cancelBtn = $('sleep-cancel-btn');
      if (!btn || !pop) return { cancel() {}, toggle() {} };

      let deadline = 0;       // timestamp (ms) when fade should begin
      let tick = null;        // 1s countdown interval
      let fadeRAF = null;     // fade animation handle
      let chosenMin = 0;

      function fmt(ms) {
        const s = Math.max(0, Math.round(ms / 1000));
        const m = Math.floor(s / 60), ss = s % 60;
        return m + ':' + String(ss).padStart(2, '0');
      }

      function clearAll() {
        if (tick) { clearInterval(tick); tick = null; }
        if (fadeRAF) { cancelAnimationFrame(fadeRAF); fadeRAF = null; }
      }

      function disarm() {
        clearAll();
        deadline = 0; chosenMin = 0;
        btn.classList.remove('is-armed');
        if (activeRow) activeRow.classList.remove('show');
        pop.querySelectorAll('.sleep-opt').forEach(o => o.classList.remove('active'));
      }

      function fadeAndStop() {
        clearAll();
        const original = audio.volume;
        const start = performance.now();
        const DUR = 7000; // 7s gentle fade
        const step = (now) => {
          const p = clamp((now - start) / DUR, 0, 1);
          try { audio.volume = original * (1 - p); } catch (e) {}
          if (p < 1) { fadeRAF = requestAnimationFrame(step); }
          else {
            fadeRAF = null;
            const playBtn = $('play-btn');
            if (!audio.paused && playBtn) playBtn.click(); // pause via the real control
            try { audio.volume = original; } catch (e) {}   // restore for next play
            disarm();
            toast('ราตรีสวัสดิ์ 🌙', 'ปิดเพลงให้เรียบร้อยแล้ว ฝันดีนะหมูเล็ก 💤', 8000);
          }
        };
        fadeRAF = requestAnimationFrame(step);
      }

      function start(min) {
        clearAll();
        chosenMin = min;
        deadline = Date.now() + min * 60000;
        btn.classList.add('is-armed');
        if (activeRow) activeRow.classList.add('show');
        pop.querySelectorAll('.sleep-opt').forEach(o =>
          o.classList.toggle('active', parseInt(o.dataset.min, 10) === min));
        if (remainEl) remainEl.textContent = fmt(deadline - Date.now());
        tick = setInterval(() => {
          const left = deadline - Date.now();
          if (remainEl) remainEl.textContent = fmt(left);
          if (left <= 0) { clearInterval(tick); tick = null; fadeAndStop(); }
        }, 1000);
        const human = min >= 60 ? (min / 60) + ' ชั่วโมง' : min + ' นาที';
        toast('ตั้งเวลานอนแล้ว 💤', 'เพลงจะค่อย ๆ เบาลงแล้วหยุดใน ' + human + ' นะ', 5000);
      }

      pop.querySelectorAll('.sleep-opt').forEach(opt => {
        opt.addEventListener('click', () => start(parseInt(opt.dataset.min, 10)));
      });
      if (cancelBtn) cancelBtn.addEventListener('click', () => {
        disarm();
        toast('ยกเลิกเวลานอนแล้ว', 'เล่นเพลงต่อได้เลย ☺️', 3500);
      });

      // open / close the sleep popover from its toolbar button
      btn.addEventListener('click', () => togglePopover(pop, btn));

      return {
        toggle: () => togglePopover(pop, btn),
        isArmed: () => deadline > 0,
        cancel: disarm
      };
    })();

    /* =====================================================================
       3) LISTENING INSIGHTS (play counts + total time + most played)
       ===================================================================== */
    const insights = (function initInsights() {
      const KEY = 'cozy_listen_stats_v1';
      const btn = $('insights-btn');
      const pop = $('insights-popover');
      let stats = lsGet(KEY, { plays: {}, totalSeconds: 0 });
      if (!stats.plays) stats.plays = {};
      if (typeof stats.totalSeconds !== 'number') stats.totalSeconds = 0;

      let lastCount = { name: '', ts: 0 };
      let saveAt = 0;

      function currentName() {
        const el = $('player-track-title');
        return el ? (el.textContent || '').trim() : '';
      }
      function save(force) {
        const now = Date.now();
        if (force || now - saveAt > 12000) { saveAt = now; lsSet(KEY, stats); }
      }

      // Count a play when a track starts from the beginning
      audio.addEventListener('play', () => {
        if (audio.currentTime > 2) return;            // resumed, not a fresh start
        const name = currentName();
        if (!name || name === 'กรุณาเลือกเพลง') return;
        const now = Date.now();
        if (name === lastCount.name && now - lastCount.ts < 3000) return; // de-dupe
        lastCount = { name, ts: now };
        stats.plays[name] = (stats.plays[name] || 0) + 1;
        save(true);
      });

      // Accumulate listening time
      setInterval(() => {
        if (audio && !audio.paused && !audio.seeking && audio.currentTime > 0) {
          stats.totalSeconds += 1;
          save(false);
        }
      }, 1000);
      audio.addEventListener('pause', () => save(true));
      document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
      window.addEventListener('beforeunload', () => save(true));

      function fmtTime(sec) {
        if (sec < 60) return sec + ' วิ';
        const m = Math.round(sec / 60);
        if (m < 60) return m + ' นาที';
        const h = Math.floor(m / 60), mm = m % 60;
        return h + ' ชม.' + (mm ? ' ' + mm + ' น.' : '');
      }

      function render() {
        const entries = Object.entries(stats.plays).filter(([, c]) => c > 0);
        const totalPlays = entries.reduce((a, [, c]) => a + c, 0);
        const tp = $('insight-total-plays'); if (tp) tp.textContent = totalPlays;
        const tt = $('insight-total-time'); if (tt) tt.textContent = fmtTime(stats.totalSeconds);
        const uq = $('insight-unique'); if (uq) uq.textContent = entries.length;

        const list = $('insight-top-list');
        if (list) {
          const top = entries.sort((a, b) => b[1] - a[1]).slice(0, 5);
          if (!top.length) {
            list.innerHTML = '<li class="insight-empty">ยังไม่มีข้อมูล เริ่มฟังเพลงกันเลย 🎵</li>';
          } else {
            list.innerHTML = top.map(([name, c], i) =>
              '<li><span class="insight-rank">' + (i + 1) + '</span>' +
              '<span class="insight-song-name">' + escapeHtml(name) + '</span>' +
              '<span class="insight-song-count">' + c + ' ครั้ง</span></li>'
            ).join('');
          }
        }
      }

      function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      }

      if (btn && pop) {
        btn.addEventListener('click', () => { render(); togglePopover(pop, btn); });
      }
      return { render };
    })();

    /* =====================================================================
       4) "NOW PLAYING" browser-tab title
       ===================================================================== */
    (function initTabTitle() {
      function name() {
        const el = $('player-track-title');
        const n = el ? (el.textContent || '').trim() : '';
        return (n && n !== 'กรุณาเลือกเพลง') ? n : '';
      }
      audio.addEventListener('play', () => {
        const n = name();
        document.title = n ? ('▶ ' + n + ' · Cozy Lounge') : ORIGINAL_TITLE;
      });
      const restore = () => { document.title = ORIGINAL_TITLE; };
      audio.addEventListener('pause', restore);
      audio.addEventListener('ended', restore);
    })();

    /* =====================================================================
       5) POPOVER open/close machinery (shared)
       ===================================================================== */
    function positionPopover(pop, btn) {
      if (isMobile()) return; // mobile uses CSS bottom-sheet via !important
      const r = btn.getBoundingClientRect();
      const left = clamp(r.left + r.width / 2 - pop.offsetWidth / 2, 8, window.innerWidth - pop.offsetWidth - 8);
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = 'auto';
      pop.style.bottom = Math.round(window.innerHeight - r.top + 12) + 'px';
    }
    function closeAllPopovers(except) {
      document.querySelectorAll('.cozy-popover.active').forEach(p => { if (p !== except) p.classList.remove('active'); });
    }
    function togglePopover(pop, btn) {
      const willOpen = !pop.classList.contains('active');
      closeAllPopovers(pop);
      if (willOpen) { positionPopover(pop, btn); pop.classList.add('active'); }
      else { pop.classList.remove('active'); }
    }
    // Outside-click closes popovers
    document.addEventListener('click', (e) => {
      if (e.target.closest('.cozy-popover') || e.target.closest('.cozy-extra-btn')) return;
      closeAllPopovers(null);
    });
    window.addEventListener('resize', () => closeAllPopovers(null));

    /* =====================================================================
       6) KEYBOARD SHORTCUTS HELP overlay
       ===================================================================== */
    const help = (function initHelp() {
      const overlay = $('kbd-help-overlay');
      const openBtn = $('kbd-help-btn');
      const closeBtn = $('kbd-help-close');
      if (!overlay) return { toggle() {}, close() {} };
      const open = () => overlay.classList.add('active');
      const close = () => overlay.classList.remove('active');
      const toggle = () => overlay.classList.toggle('active');
      if (openBtn) openBtn.addEventListener('click', toggle);
      if (closeBtn) closeBtn.addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      return { toggle, close, isOpen: () => overlay.classList.contains('active') };
    })();

    /* =====================================================================
       7) EXPANDED KEYBOARD SHORTCUTS
       (only NEW keys — Space / ← / → stay owned by player-v8.js)
       ===================================================================== */
    function clickIf(id) { const el = $(id); if (el) el.click(); }
    function nudgeVolume(delta) {
      const slider = $('player-volume');
      if (!slider) return;
      slider.value = clamp(parseInt(slider.value, 10) + delta, 0, 100);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function seekRelative(sec) {
      if (!isFinite(audio.duration)) return;
      audio.currentTime = clamp(audio.currentTime + sec, 0, audio.duration);
    }
    function seekPercent(p) {
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = clamp(audio.duration * p, 0, audio.duration);
    }

    document.addEventListener('keydown', (e) => {
      // never hijack typing
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'ArrowUp':   e.preventDefault(); nudgeVolume(+5); break;
        case 'ArrowDown': e.preventDefault(); nudgeVolume(-5); break;
        case 'm': case 'M':
          clickIf('player-volume-icon'); break;
        case 'f': case 'F':
          clickIf('heart-current-btn'); break;
        case 's': case 'S':
          clickIf('shuffle-btn'); break;
        case 'r': case 'R':
          clickIf('repeat-btn'); break;
        case 't': case 'T':
          e.preventDefault(); if (sleep && sleep.toggle) sleep.toggle(); break;
        case ',': case '<': seekRelative(-5); break;
        case '.': case '>': seekRelative(+5); break;
        case '?':
          e.preventDefault(); if (help && help.toggle) help.toggle(); break;
        case 'Escape':
          closeAllPopovers(null); if (help && help.close) help.close(); break;
        default:
          if (e.key >= '0' && e.key <= '9') { seekPercent(parseInt(e.key, 10) / 10); }
      }
    });

    /* =====================================================================
       8) PERSONALISED TIME-OF-DAY GREETING for หมูเล็ก
       ===================================================================== */
    (function initGreeting() {
      // Show at most once every 4 hours so it stays special, not spammy
      const last = lsGet('cozy_greet_ts', 0);
      if (Date.now() - last < 4 * 3600 * 1000) return;

      const h = new Date().getHours();
      let title, desc;
      if (h >= 5 && h < 11)       { title = 'อรุณสวัสดิ์ หมูเล็ก ☀️'; desc = 'เริ่มเช้านี้ด้วยเพลงอุ่น ๆ กันนะ ☕'; }
      else if (h >= 11 && h < 16) { title = 'สวัสดีตอนกลางวัน 🌤️';   desc = 'พักหายใจ ฟังเพลงชิล ๆ สักเพลงไหม 🎵'; }
      else if (h >= 16 && h < 19) { title = 'เย็นนี้เป็นไงบ้าง 🌇';     desc = 'ฟังเพลงคลายเหนื่อยกันเถอะ 💛'; }
      else if (h >= 19 && h < 23) { title = 'ค่ำคืนนี้เป็นของเรา 🌙';   desc = 'เปิดมู้ดฟิน ๆ แล้วฟังด้วยกันนะ 💕'; }
      else                        { title = 'ดึกแล้วนะ หมูเล็ก 🌙';     desc = 'ตั้งเวลานอนไว้ได้นะ เดี๋ยวเพลงกล่อมเอง 💤'; }

      setTimeout(() => { toast(title, desc, 8000); lsSet('cozy_greet_ts', Date.now()); }, 1400);
    })();

    console.log('[Cozy Plus] enhancements ready 💖');
  });
})();
