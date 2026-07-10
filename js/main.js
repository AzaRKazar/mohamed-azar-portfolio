/* ============================================================
   MOHAMED AZARUDEEN — PORTFOLIO
   Vanilla JS. No dependencies. Safe with file:// and http://.
   Modules: preloader · nav · menu · reveals · film scrub engine ·
   parallax · cursor · magnetic · scramble · clock · fallbacks
   ============================================================ */
(() => {
  "use strict";

  /* ---------- utils ---------- */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  let vh = window.innerHeight;
  window.addEventListener("resize", () => { vh = window.innerHeight; }, { passive: true });

  /* ============================================================
     PRELOADER — quick, never blocks
     ============================================================ */
  const preloader = $("#preloader");
  const preloaderInit = () => {
    if (!preloader) { document.body.classList.add("is-loaded"); return; }
    if (reducedMotion) {
      preloader.classList.add("is-done");
      document.body.classList.add("is-loaded");
      return;
    }
    const countEl = $("#preloaderCount");
    const barEl = $("#preloaderBar");
    const t0 = performance.now();
    const DURATION = 1050;
    const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const tick = (now) => {
      const t = clamp((now - t0) / DURATION, 0, 1);
      const v = easeOutExpo(t);
      if (countEl) countEl.textContent = String(Math.round(v * 100)).padStart(2, "0");
      if (barEl) barEl.style.transform = `scaleX(${v})`;
      if (t < 1) { requestAnimationFrame(tick); return; }
      preloader.classList.add("is-done");
      document.body.classList.add("is-loaded");
    };
    requestAnimationFrame(tick);
    // hard guarantee: never trap the page behind the preloader
    setTimeout(() => {
      preloader.classList.add("is-done");
      document.body.classList.add("is-loaded");
    }, 3000);
  };

  /* ============================================================
     NAV — scrolled state, hide on scroll down, active section
     ============================================================ */
  const nav = $("#nav");
  let lastScrollY = window.scrollY;

  const navOnScroll = () => {
    if (!nav) return;
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 10);
    const goingDown = y > lastScrollY + 4;
    const goingUp = y < lastScrollY - 4;
    if (goingDown && y > 240 && !document.body.classList.contains("menu-open")) {
      nav.classList.add("is-hidden");
    } else if (goingUp || y <= 240) {
      nav.classList.remove("is-hidden");
    }
    lastScrollY = y;
  };

  const activeLinkInit = () => {
    const links = $$(".nav__link");
    if (!links.length || !("IntersectionObserver" in window)) return;
    const byId = new Map(links.map((l) => [l.getAttribute("href"), l]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((l) => l.classList.remove("is-active"));
        const link = byId.get(`#${e.target.id}`);
        if (link) link.classList.add("is-active");
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    ["about", "experience", "projects", "skills", "contact"]
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .forEach((s) => io.observe(s));
  };

  /* ============================================================
     FULLSCREEN MENU
     ============================================================ */
  const menuInit = () => {
    const burger = $("#navBurger");
    const menu = $("#menu");
    if (!burger || !menu) return;

    const setOpen = (open) => {
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", String(!open));
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("menu-open", open);
      if (open) {
        const first = $(".menu__link", menu);
        if (first) first.focus({ preventScroll: true });
      }
    };

    burger.addEventListener("click", () =>
      setOpen(!menu.classList.contains("is-open")));
    $$(".menu__link, .menu__foot a", menu).forEach((a) =>
      a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        setOpen(false);
        burger.focus();
      }
    });
  };

  /* ============================================================
     SCROLL-LINKED REVEALS (IntersectionObserver)
     ============================================================ */
  const revealsInit = () => {
    const els = $$("[data-reveal]");
    if (!els.length) return;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  };

  /* ============================================================
     FILM SECTIONS — scroll-scrubbed video engine
     ------------------------------------------------------------
     Technique: the video stays paused; scroll progress through the
     tall spacer maps to a target timestamp; a rAF loop lerps a
     virtual playhead toward it and seeks only when the previous
     seek has completed. This keeps seeking smooth on every browser
     instead of flooding the pipeline with currentTime writes.
     ============================================================ */
  const films = [];

  const filmsInit = () => {
    $$("[data-film]").forEach((section) => {
      const spacer = $(".film__spacer", section);
      const stage = $(".film__stage", section);
      const video = $(".film__video", section);
      const timecode = $("[data-timecode]", section);
      const lines = $$("[data-line]", section);
      if (!spacer || !stage) return;

      const reel = section.dataset.reel || "--";
      const film = {
        section, spacer, video, timecode, lines, reel,
        progress: 0,
        playhead: 0,       // virtual (lerped) playhead in seconds
        seekPending: false,
        hasVideo: false,
        missing: false,
        upgraded: false,   // preload bumped to auto
        lastP: -1,
      };

      if (video) {
        const source = $("source", video);
        const markMissing = () => {
          film.missing = true;
          film.hasVideo = false;
          section.classList.remove("has-video");
          if (timecode) timecode.textContent = `REEL ${reel} — AWAITING FOOTAGE (${(source && source.getAttribute("src")) || "video"})`;
        };
        const markReady = () => {
          if (film.missing) return;
          film.hasVideo = true;
          section.classList.add("has-video");
          // nudge so the first frame actually paints (iOS/Safari)
          try { video.currentTime = 0.001; } catch (_) { /* not seekable yet */ }
        };
        // iOS Safari: ignores preload, and won't decode/paint a paused video
        // until it has gone through a (muted, inline) play/pause cycle.
        video.setAttribute("webkit-playsinline", "");
        film.prime = () => {
          if (film.primed || film.missing) return;
          film.primed = true;
          if (video.readyState === 0) { try { video.load(); } catch (_) {} }
          const p = video.play();
          if (p && p.then) {
            p.then(() => { video.pause(); })
             .catch(() => { film.primed = false; }); // blocked (e.g. Low Power Mode) — retry on first gesture
          } else {
            video.pause();
          }
        };
        video.addEventListener("loadedmetadata", markReady);
        video.addEventListener("error", markMissing);
        if (source) source.addEventListener("error", markMissing);
        video.addEventListener("seeked", () => { film.seekPending = false; });
        if (video.readyState >= 1) markReady();
        if (video.preload === "auto") film.prime();
      }

      films.push(film);
    });

    // if autoplay-priming was blocked, retry on the first user gesture
    const gesturePrime = () => films.forEach((f) => f.prime && f.prime());
    window.addEventListener("touchstart", gesturePrime, { once: true, passive: true });
    window.addEventListener("pointerdown", gesturePrime, { once: true, passive: true });

    // bump lazy films to full preload as they approach the viewport
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const film = films.find((f) => f.section === e.target);
          if (film && film.video && !film.upgraded) {
            film.upgraded = true;
            if (film.video.preload !== "auto") {
              film.video.preload = "auto";
              if (film.video.readyState < 2 && !film.missing) film.video.load();
            }
            if (film.prime) film.prime();
          }
          io.unobserve(e.target);
        });
      }, { rootMargin: "100% 0px" });
      films.forEach((f) => io.observe(f.section));
    }

    if (reducedMotion) {
      // static presentation: everything visible, no scrubbing
      films.forEach((f) => f.lines.forEach((l) => l.classList.add("is-on")));
    }
  };

  const formatTime = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return `${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}`;
  };

  const filmsFrame = () => {
    for (const film of films) {
      const rect = film.spacer.getBoundingClientRect();
      const onScreen = rect.top < vh && rect.bottom > 0;
      if (!onScreen && film.lastP !== -1) continue;

      const denom = Math.max(rect.height - vh, 1);
      const p = clamp(-rect.top / denom, 0, 1);
      film.progress = p;

      // choreography variable (hero title drift/fade lives in CSS)
      if (Math.abs(p - film.lastP) > 0.0005) {
        film.section.style.setProperty("--p", p.toFixed(4));
        film.lastP = p;
      }

      // staggered text lines with slight hysteresis
      if (!reducedMotion) {
        film.lines.forEach((line) => {
          const i = Number(line.dataset.line) || 0;
          const on = p >= 0.1 + i * 0.09;
          const off = p < 0.06 + i * 0.09;
          if (on) line.classList.add("is-on");
          else if (off) line.classList.remove("is-on");
        });
      }

      // video scrub
      const v = film.video;
      if (v && film.hasVideo && !reducedMotion && v.duration && isFinite(v.duration)) {
        const target = p * Math.max(v.duration - 0.05, 0);
        film.playhead = lerp(film.playhead, target, 0.14);
        if (Math.abs(film.playhead - target) < 0.002) film.playhead = target;
        // watchdog: some browsers drop the `seeked` event on stalled seeks
        if (film.seekPending && performance.now() - film.seekStamp > 600) {
          film.seekPending = false;
        }
        if (!film.seekPending && Math.abs(v.currentTime - film.playhead) > 0.01) {
          film.seekPending = true;
          film.seekStamp = performance.now();
          try { v.currentTime = film.playhead; }
          catch (_) { film.seekPending = false; }
        }
        if (film.timecode) {
          film.timecode.textContent =
            `REEL ${film.reel} — ${formatTime(film.playhead)} / ${formatTime(v.duration)}`;
        }
      }
    }
  };

  /* ============================================================
     PARALLAX — project media drift
     ============================================================ */
  const parallaxEls = [];
  const parallaxInit = () => {
    if (reducedMotion) return;
    $$("[data-parallax]").forEach((el) => parallaxEls.push({ el, py: 0 }));
  };
  const parallaxFrame = () => {
    for (const item of parallaxEls) {
      const rect = item.el.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > vh + 80) continue;
      const center = rect.top + rect.height / 2;
      const target = clamp((center - vh / 2) * -0.055, -26, 26);
      item.py = lerp(item.py, target, 0.12);
      item.el.style.setProperty("--py", `${item.py.toFixed(2)}px`);
    }
  };

  /* ============================================================
     CURSOR — dot + trailing ring (fine pointers only)
     ============================================================ */
  const cursor = { x: 0, y: 0, dx: 0, dy: 0, rx: 0, ry: 0, active: false };
  let cursorDot = null;
  let cursorRing = null;

  const cursorInit = () => {
    if (!finePointer || reducedMotion) return;
    cursorDot = $("#cursorDot");
    cursorRing = $("#cursorRing");
    if (!cursorDot || !cursorRing) return;

    window.addEventListener("pointermove", (e) => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      if (!cursor.active) {
        cursor.active = true;
        cursor.dx = cursor.rx = cursor.x;
        cursor.dy = cursor.ry = cursor.y;
        document.body.classList.add("cursor-active");
      }
    }, { passive: true });

    document.addEventListener("mouseleave", () => {
      document.body.classList.remove("cursor-active");
      cursor.active = false;
    });

    const HOVER_SEL = "a, button, [data-magnetic], .tags li";
    document.addEventListener("mouseover", (e) => {
      document.body.classList.toggle("cursor-hover", !!e.target.closest(HOVER_SEL));
    });
  };

  const cursorFrame = () => {
    if (!cursorDot || !cursor.active) return;
    cursor.dx = lerp(cursor.dx, cursor.x, 0.55);
    cursor.dy = lerp(cursor.dy, cursor.y, 0.55);
    cursor.rx = lerp(cursor.rx, cursor.x, 0.16);
    cursor.ry = lerp(cursor.ry, cursor.y, 0.16);
    cursorDot.style.transform = `translate(${cursor.dx - 3}px, ${cursor.dy - 3}px)`;
    cursorRing.style.transform = `translate(${cursor.rx - 17}px, ${cursor.ry - 17}px)`;
  };

  /* ============================================================
     MAGNETIC BUTTONS
     ============================================================ */
  const magneticInit = () => {
    if (!finePointer || reducedMotion) return;
    $$("[data-magnetic]").forEach((el) => {
      const strength = 0.35;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = (e.clientX - (r.left + r.width / 2)) * strength;
        const my = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transition = "transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)";
        el.style.transform = "";
        setTimeout(() => { el.style.transition = ""; }, 500);
      });
    });
  };

  /* ============================================================
     SCRAMBLE HOVER — nav links
     ============================================================ */
  const scrambleInit = () => {
    if (!finePointer || reducedMotion) return;
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ/·—01";
    $$("[data-scramble]").forEach((el) => {
      const original = el.textContent;
      let raf = null;
      el.addEventListener("mouseenter", () => {
        if (raf) cancelAnimationFrame(raf);
        const t0 = performance.now();
        const DUR = 380;
        const step = (now) => {
          const t = clamp((now - t0) / DUR, 0, 1);
          const settled = Math.floor(t * original.length);
          let out = original.slice(0, settled);
          for (let i = settled; i < original.length; i++) {
            out += original[i] === " " ? " "
              : CHARS[(Math.random() * CHARS.length) | 0];
          }
          el.textContent = out;
          if (t < 1) raf = requestAnimationFrame(step);
          else { el.textContent = original; raf = null; }
        };
        raf = requestAnimationFrame(step);
      });
    });
  };

  /* ============================================================
     SCROLL PROGRESS HAIRLINE
     ============================================================ */
  const progressBar = $("#scrollProgress");
  const progressFrame = () => {
    if (!progressBar) return;
    const max = document.documentElement.scrollHeight - vh;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    progressBar.style.transform = `scaleX(${p.toFixed(4)})`;
  };

  /* ============================================================
     MARQUEE — pause offscreen
     ============================================================ */
  const marqueeInit = () => {
    const marquee = $(".marquee");
    if (!marquee || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => marquee.classList.toggle("is-paused", !e.isIntersecting));
    });
    io.observe(marquee);
  };

  /* ============================================================
     MEDIA FALLBACKS — never show a broken image
     ============================================================ */
  const fallbacksInit = () => {
    // project screenshots → styled placeholder panel
    $$(".media img").forEach((img) => {
      const flag = () => {
        const media = img.closest(".media");
        if (media) media.classList.add("media--missing");
      };
      img.addEventListener("error", flag);
      if (img.complete && img.naturalWidth === 0 && img.currentSrc) flag();
    });
    // nav logo → text monogram
    const logo = $(".nav__logo");
    const brand = $(".nav__brand");
    if (logo && brand) {
      const flag = () => brand.classList.add("logo-missing");
      logo.addEventListener("error", flag);
      if (logo.complete && logo.naturalWidth === 0) flag();
    }
  };

  /* ============================================================
     FOOTER — year + New York clock
     ============================================================ */
  const footerInit = () => {
    const yearEl = $("#footerYear");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    const clockEl = $("#footerClock");
    if (!clockEl) return;
    let fmt = null;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/New_York",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      });
    } catch (_) { /* keep static text */ }
    if (!fmt) return;
    const tickClock = () => {
      clockEl.textContent = `NEW YORK — ${fmt.format(new Date())}`;
    };
    tickClock();
    setInterval(tickClock, 1000);
  };

  /* ============================================================
     MASTER LOOP
     ============================================================ */
  const frame = () => {
    navOnScroll();
    progressFrame();
    if (!reducedMotion) {
      filmsFrame();
      parallaxFrame();
      cursorFrame();
    } else {
      filmsFrame(); // still maintains has-video state + timecode text
    }
    requestAnimationFrame(frame);
  };

  /* ---------- boot ---------- */
  const boot = () => {
    preloaderInit();
    menuInit();
    activeLinkInit();
    revealsInit();
    filmsInit();
    parallaxInit();
    cursorInit();
    magneticInit();
    scrambleInit();
    marqueeInit();
    fallbacksInit();
    footerInit();
    requestAnimationFrame(frame);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
