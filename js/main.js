/* ==========================================================
   Heliora Solar Energy — interactions & animations
   ========================================================== */
(function () {
  'use strict';

  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- smooth scroll (Lenis, with native fallback) ---------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({
      duration: 1.15,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    lenis.stop();
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollY = () => (lenis ? lenis.scroll : window.scrollY);

  function scrollToTarget(target) {
    const offset = target === 0 ? 0 : -90;
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth' });
  }

  /* ---------- sunrise loader ---------- */
  const loader = $('#loader');
  const ringEl = $('#loaderRing');
  const pctEl = $('#loaderPct');
  const msgEl = $('#loaderMsg');
  const panels = $$('.loader__panels i');
  const RING = 389.6;
  const messages = [[0, 'Catching the first rays…'], [35, 'Charging the panels…'], [70, 'Powering up your home…'], [96, 'Let there be light!']];
  const sources = new Set($$('img').map(i => i.currentSrc || i.src));
  ['images/hero-bg.webp', 'images/hero-fg.webp'].forEach(s => sources.add(s));
  const total = sources.size;
  let loaded = 0, shown = 0, finished = false, lastMsg = '';
  const start = performance.now();
  const MIN_TIME = 1800;

  sources.forEach(src => {
    const im = new Image();
    im.onload = im.onerror = () => { loaded++; };
    im.src = src;
  });

  function tickLoader() {
    const timeCap = Math.min(1, (performance.now() - start) / MIN_TIME);
    const target = Math.min(loaded / total, timeCap) * 100;
    shown += (target - shown) * 0.12;
    if (target - shown < 0.4) shown = target;
    const p = Math.round(shown);
    ringEl.style.strokeDashoffset = RING - (RING * shown) / 100;
    pctEl.textContent = p;
    panels.forEach((el, i) => el.classList.toggle('on', shown >= ((i + 1) / panels.length) * 100 - 0.5));
    const msg = messages.filter(m => p >= m[0]).pop()[1];
    if (msg !== lastMsg) { msgEl.textContent = msg; lastMsg = msg; }
    if (shown >= 99.9 && !finished) { clearInterval(loaderTimer); finishLoading(); }
  }
  // interval (not rAF) so the loader also completes in background tabs
  const loaderTimer = setInterval(tickLoader, 30);
  setTimeout(() => { loaded = total; }, 7000);

  function finishLoading() {
    finished = true;
    setTimeout(() => {
      loader.classList.add('done');
      body.classList.remove('is-loading');
      setTimeout(() => {
        body.classList.add('ready');
        if (lenis) lenis.start();
        $$('.hero [data-count], .stats [data-count]').forEach(countUp);
      }, 650);
      setTimeout(() => loader.remove(), 2000);
    }, 300);
  }

  /* ---------- reveal on scroll ---------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => revealIO.observe(el));

  /* ---------- counters ---------- */
  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    const end = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || 0, 10);
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / 2000);
      const v = end * (1 - Math.pow(1 - p, 4));
      el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-GB');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && body.classList.contains('ready')) { countUp(e.target); countIO.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => { if (!el.closest('.hero')) countIO.observe(el); });

  /* ---------- scroll-driven UI ---------- */
  const progress = $('#progress');
  const sticky = $('#sticky');
  const totop = $('#totop');
  const ring = $('#totopRing');
  const hero = $('.hero');
  const heroWord = $('[data-hero-parallax]');
  const parallaxEls = $$('[data-parallax]');
  const parallaxImgs = $$('[data-parallax-img]');
  let ticking = false;

  function onScroll() {
    const y = scrollY();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, y / max) : 0;
    progress.style.transform = `scaleX(${p})`;
    ring.style.strokeDashoffset = 132 - 132 * p;
    sticky.classList.toggle('show', y > hero.offsetHeight * 0.75);
    totop.classList.toggle('show', y > window.innerHeight * 0.8);

    if (!reduceMotion) {
      if (heroWord && y < hero.offsetHeight) heroWord.style.transform = `translate3d(0,${y * parseFloat(heroWord.dataset.heroParallax)}px,0)`;
      const vh = window.innerHeight;
      parallaxEls.forEach(el => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        // never move further than the extra bleed the layer has, so no gaps show
        const limit = Math.max(0, (el.offsetHeight - r.height) / 2 - 2);
        const raw = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
        el.style.transform = `translate3d(0,${Math.max(-limit, Math.min(limit, raw))}px,0)`;
      });
      parallaxImgs.forEach(img => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const prog = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        img.style.transform = `translate3d(0,${-prog * 13}%,0)`;
      });
    }
    ticking = false;
  }
  const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  if (lenis) lenis.on('scroll', requestTick);
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  onScroll();

  /* ---------- anchor links + mobile menu ---------- */
  const mmenu = $('#mmenu');
  const burgers = $$('.burger');
  function closeMenu() {
    mmenu.classList.remove('open');
    burgers.forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (lenis) lenis.start(); else body.style.overflow = '';
  }
  function openMenu() {
    mmenu.classList.add('open');
    burgers.forEach(b => b.setAttribute('aria-expanded', 'true'));
    if (lenis) lenis.stop(); else body.style.overflow = 'hidden';
  }
  burgers.forEach(b => b.addEventListener('click', openMenu));
  $('#mmenuClose').addEventListener('click', closeMenu);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && mmenu.classList.contains('open')) closeMenu(); });

  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return e.preventDefault();
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (mmenu.classList.contains('open')) closeMenu();
      scrollToTarget(target);
    });
  });

  /* ---------- savings calculator ---------- */
  const bill = $('#bill');
  if (bill) {
    const fmt = n => Math.round(n).toLocaleString('en-GB');
    const profiles = {           // share of bill saved, system cost per kW
      home: { save: 0.70, perKw: 1460 },
      business: { save: 0.65, perKw: 1250 },
      farm: { save: 0.75, perKw: 1150 }
    };
    let type = 'home';
    const out = {
      bill: $('#billOut'), save: $('#rSave'), kw: $('#rKw'), pay: $('#rPay'), co2: $('#rCo2')
    };
    function setText(el, v) {
      if (el.textContent === v) return;
      el.textContent = v;
      const b = el.closest('b');
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    }
    function calc() {
      const b = +bill.value;
      const pr = profiles[type];
      const annual = b * 12 * pr.save;
      const kw = b / 28;
      const payback = (kw * pr.perKw) / annual;
      out.bill.textContent = b;
      setText(out.save, fmt(annual));
      setText(out.kw, kw.toFixed(1));
      setText(out.pay, payback.toFixed(1));
      setText(out.co2, (kw * 0.48).toFixed(1));
      const pct = ((b - bill.min) / (bill.max - bill.min)) * 100;
      bill.parentElement.style.setProperty('--p', pct + '%');
    }
    bill.addEventListener('input', calc);
    $$('.tabs button').forEach(btn => btn.addEventListener('click', () => {
      $$('.tabs button').forEach(x => x.classList.toggle('on', x === btn));
      type = btn.dataset.type;
      calc();
    }));
    calc();
  }

  /* live "today's generation" ticker */
  const gen = $('#liveGen');
  if (gen && !reduceMotion) {
    let g = 24.8;
    setInterval(() => { g += Math.random() * 0.06; gen.textContent = g.toFixed(1); }, 2500);
  }

  /* ---------- FAQ accordion ---------- */
  $$('.qi__q').forEach(btn => {
    btn.setAttribute('aria-expanded', btn.parentElement.classList.contains('open'));
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const open = !item.classList.contains('open');
      $$('.qi').forEach(q => { q.classList.remove('open'); $('.qi__q', q).setAttribute('aria-expanded', 'false'); });
      if (open) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      setTimeout(() => lenis && lenis.resize && lenis.resize(), 650);
    });
  });

  /* ---------- forms ---------- */
  const form = $('#quote');
  const note = $('#formNote');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    $$('input[required]', form).forEach(inp => {
      const bad = !inp.value.trim() || (inp.type === 'email' && !/^\S+@\S+\.\S+$/.test(inp.value));
      inp.classList.toggle('err', bad);
      if (bad) ok = false;
    });
    if (!ok) { note.classList.remove('ok'); note.textContent = 'Please fill in your name, phone and a valid email.'; return; }
    note.classList.add('ok');
    note.textContent = 'Thanks! A solar specialist will be in touch within 24 hours.';
    form.reset();
  });

  const news = $('#news');
  news.addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('input', news);
    if (!/^\S+@\S+\.\S+$/.test(inp.value)) { inp.focus(); return; }
    news.classList.add('ok');
    inp.value = '';
    inp.placeholder = 'Subscribed — thank you!';
  });
})();
