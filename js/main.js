(function () {
  'use strict';

  var root = document.documentElement;
  var osReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* "still" is the visitor's own pause switch (set early by the inline head script); it behaves like the OS setting */
  var reduceMotion = osReduce || root.classList.contains('still');
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var lenisRef = null; /* set once Lenis starts, so the mobile menu can pause smooth scrolling */
  root.classList.add('js');

  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };

  /* Pause animations: remembered, and applied by reloading so every engine (scroll, canvases, terminal) starts in its still mode */
  var motionBtn = $('.motion-toggle');
  if (motionBtn) {
    if (osReduce) {
      motionBtn.hidden = true; /* the OS setting already keeps the page still */
    } else {
      var paused = root.classList.contains('still');
      motionBtn.setAttribute('aria-pressed', String(paused));
      motionBtn.setAttribute('aria-label', paused ? 'Resume animations' : 'Pause animations');
      motionBtn.title = paused ? 'Resume animations' : 'Pause animations';
      motionBtn.addEventListener('click', function () {
        try { if (paused) localStorage.removeItem('vb-motion'); else localStorage.setItem('vb-motion', 'off'); } catch (e) { /* storage blocked: the switch cannot persist */ return; }
        location.reload();
      });
    }
  }

  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* Loader: runs once per visit, then slides away and releases the hero animations */
  var loader = $('#loader');
  if (loader) {
    var seen = false;
    try { seen = sessionStorage.getItem('vb-loaded') === '1'; } catch (e) { /* storage blocked: show the loader */ }

    if (reduceMotion || seen) {
      loader.remove();
    } else {
      root.classList.add('loading');
      var pct = $('.lp-pct', loader);
      var start = performance.now();
      var DURATION = 1900;

      var finish = function () {
        loader.classList.add('done');
        root.classList.remove('loading');
        try { sessionStorage.setItem('vb-loaded', '1'); } catch (e) { /* ignore */ }
        setTimeout(function () { loader.remove(); }, 1000);
      };

      var step = function (now) {
        var t = Math.min((now - start) / DURATION, 1);
        pct.textContent = Math.round((1 - Math.pow(1 - t, 3)) * 100) + '%';
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          loader.classList.add('welcome');
          setTimeout(finish, 800);
        }
      };
      requestAnimationFrame(step);
    }
  }

  /* Header state and hero parallax */
  var header = $('.site-header');
  var heroEl = $('#hero');
  /* Parallax writes the element's own `translate`. A custom property (--sy) would be inherited, so every scroll frame
     would restyle the whole terminal subtree under it. */
  var parallax = [[$('.hero-left'), -0.12], [$('.hero-right'), -0.12], [$('.term-wrap'), 0.1]].filter(function (p) { return p[0]; });
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('scrolled', y > 8);
    if (!reduceMotion && y < window.innerHeight * 1.2) {
      parallax.forEach(function (p) { p[0].style.translate = '0 ' + (y * p[1]).toFixed(1) + 'px'; });
    }
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Adaptive quality: if frames are slow while the visitor is actually scrolling (weak GPU, integrated graphics, busy
     laptop), switch to a lighter look (see .lite in the CSS): no background canvases, drifting glows, shadows or cursor
     effects. Fast devices never see it. The decision is remembered for the session. */
  var lite = false;
  function goLite() {
    if (lite) return;
    lite = true;
    root.classList.add('lite');
    try { sessionStorage.setItem('vb-lite', '1'); } catch (e) { /* storage blocked: re-measured next visit */ }
  }
  try { if (sessionStorage.getItem('vb-lite') === '1') goLite(); } catch (e) { /* ignore */ }
  if (!lite && !reduceMotion) {
    var lastScrollAt = 0, prevFrame = 0, slow = 0, total = 0, windows = 0;
    window.addEventListener('scroll', function () { lastScrollAt = performance.now(); }, { passive: true });
    (function probe(now) {
      if (lite || windows >= 4) return; /* a handful of samples is enough; the probe then stops costing anything */
      if (!document.hidden && now - lastScrollAt < 120 && prevFrame) {
        var d = now - prevFrame;
        if (d < 250) { total++; if (d > 28) slow++; } /* ignore gaps from a backgrounded tab */
        if (total >= 90) { windows++; if (slow / total > 0.3) { goLite(); return; } total = 0; slow = 0; }
      }
      prevFrame = now;
      requestAnimationFrame(probe);
    })(performance.now());
  }

  /* Mobile menu */
  var toggle = $('.nav-toggle');
  var links = $('#nav-links');
  function setMenu(open) {
    var was = links.classList.contains('open');
    toggle.setAttribute('aria-expanded', String(open));
    links.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenisRef) { if (open) lenisRef.stop(); else lenisRef.start(); } /* body overflow alone does not stop Lenis */
    if (open && !was) {
      /* The menu fades in, and a still-hidden element cannot take focus, so wait a moment */
      setTimeout(function () {
        var first = links.querySelector('a');
        if (first && links.classList.contains('open')) first.focus();
      }, 60);
    } else if (!open && was && links.contains(document.activeElement)) {
      toggle.focus(); /* do not drop focus onto <body> when a focused menu link is hidden */
    }
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 820) setMenu(false); });

  /* Scroll reveal */
  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* Active nav link */
  var navLinks = $$('a', links);
  var sections = navLinks.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + entry.target.id;
          a.classList.toggle('active', on);
          if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    /* The hero is observed too: when it is in view no nav link matches, so the highlight clears */
    sections.concat([heroEl]).filter(Boolean).forEach(function (s) { spy.observe(s); });
  }

  /* Cursor glow, cursor ring and the terminal tilt (fine pointers only) */
  if (finePointer && !reduceMotion) {
    var glow = $('.cursor-glow');
    var gx = 0, gy = 0, raf = null;
    document.addEventListener('pointermove', function (e) {
      gx = e.clientX; gy = e.clientY;
      glow.classList.add('on');
      if (!raf) raf = requestAnimationFrame(function () {
        glow.style.transform = 'translate(' + gx + 'px,' + gy + 'px)';
        raf = null;
      });
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { glow.classList.remove('on'); });

    /* Cursor ring: trails the pointer and grows over links and buttons */
    var ring = $('.cursor-ring');
    var rx = 0, ry = 0, ringRaf = null;
    function follow() {
      rx += (gx - rx) * 0.18;
      ry += (gy - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      /* Stop the loop once the ring has caught up, so an idle page does no per-frame work */
      ringRaf = (Math.abs(gx - rx) > 0.1 || Math.abs(gy - ry) > 0.1) ? requestAnimationFrame(follow) : null;
    }
    document.addEventListener('pointermove', function () {
      ring.classList.add('on');
      if (!ringRaf) ringRaf = requestAnimationFrame(follow);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { ring.classList.remove('on'); });
    document.addEventListener('pointerover', function (e) {
      ring.classList.toggle('hover', !!e.target.closest('a, button, .work-card, .ts-item, .cert-card'));
    });

    /* The terminal tilts slightly toward the pointer */
    var orb = $('[data-tilt]');
    var hero = $('#hero');
    if (orb && hero) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        orb.style.transform = 'rotateY(' + (x * 7) + 'deg) rotateX(' + (-y * 5) + 'deg)';
      });
      hero.addEventListener('pointerleave', function () { orb.style.transform = ''; });
    }
  }

  /* Hover text slide on nav and resume links */
  if (!reduceMotion) {
    $$('.nav-links a, .resume-link > span:first-child').forEach(function (el) {
      var text = el.textContent.trim();
      el.textContent = '';
      var wrap = document.createElement('span');
      wrap.className = 'hl';
      var a = document.createElement('span');
      a.textContent = text;
      var b = a.cloneNode(true);
      b.setAttribute('aria-hidden', 'true');
      wrap.appendChild(a);
      wrap.appendChild(b);
      el.appendChild(wrap);
    });
  }

  /* Smooth scrolling (Lenis) and scroll-driven effects (GSAP ScrollTrigger).
     Progressive: if the libraries fail to load, or the visitor prefers reduced motion,
     the page keeps its normal stacked layout and native scrolling. */
  var splitWords = function (el) {
    var out = [];
    (function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.appendChild(s);
            out.push(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          wrap(n);
        }
      });
    })(el);
    return out;
  };

  if (window.gsap && window.ScrollTrigger && !reduceMotion) {
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('gsap-on');

    var lenis = null;
    if (window.Lenis) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenisRef = lenis;
      /* The pinned Work section adds page height after Lenis starts, so re-measure whenever ScrollTrigger refreshes. */
      ScrollTrigger.addEventListener('refresh', function () { lenis.resize(); });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }

    /* In-page links scroll through Lenis so they stay smooth */
    $$('a[href^="#"]').forEach(function (a) {
      if (a.classList.contains('skip-link')) return; /* the skip link keeps the browser's native jump and focus behaviour */
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        var target = id === '#top' ? 0 : $(id);
        if (target === null || target === undefined) return;
        e.preventDefault();
        if (lenis) { lenis.resize(); lenis.scrollTo(target, { duration: 1.4 }); }
        else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
        /* Move keyboard focus to the section and keep the URL hash in sync, as a normal anchor would */
        var focusEl = target === 0 ? $('#top') : target;
        if (focusEl) {
          if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
          focusEl.focus({ preventScroll: true });
        }
        if (window.history && history.pushState) history.pushState(null, '', target === 0 ? location.pathname + location.search : id);
      });
    });

    /* My Work: pin the section and slide the cards sideways as the page scrolls (desktop only) */
    var mm = gsap.matchMedia();
    mm.add('(min-width: 992px)', function () {
      var section = $('.work-section');
      var track = $('.work-track');
      if (!section || !track) return;
      section.classList.add('hscroll');
      var dist = function () { return Math.max(0, track.scrollWidth - document.documentElement.clientWidth + 20); };
      gsap.to(track, {
        x: function () { return -dist(); },
        ease: 'none',
        scrollTrigger: { trigger: '.work-pin', start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true }
      });
      return function () { section.classList.remove('hscroll'); };
    });

    /* About: words light up as you scroll through the statement */
    var statement = $('.statement');
    if (statement) {
      var words = splitWords(statement);
      gsap.fromTo(words, { opacity: 0.18 }, {
        opacity: 1, stagger: 0.06, ease: 'none',
        scrollTrigger: { trigger: statement, start: 'top 85%', end: 'bottom 55%', scrub: true }
      });
    }

    /* Journey: the line draws down and each dot lights up as you reach it */
    var timeline = $('.timeline');
    if (timeline) {
      timeline.classList.add('timeline-lit');
      timeline.style.setProperty('--p', 0);
      ScrollTrigger.create({
        trigger: timeline, start: 'top 70%', end: 'bottom 60%', scrub: true,
        onUpdate: function (self) { timeline.style.setProperty('--p', self.progress.toFixed(3)); }
      });
      $$('.tl-item', timeline).forEach(function (item) {
        ScrollTrigger.create({
          trigger: item, start: 'top 70%',
          onEnter: function () { item.classList.add('on'); },
          onLeaveBack: function () { item.classList.remove('on'); }
        });
      });
    }

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  /* Particle network: drifting dots joined by faint lines. Runs behind the hero and the tech stack,
     and pauses while its section is off screen or the tab is hidden. */
  function particleNetwork(canvas, host) {
    if (!canvas || !host || reduceMotion || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var dpr = 1; /* a faint background network does not need retina resolution, and 1x is 4x fewer pixels to clear and draw */
    var W = 0, H = 0, pts = [], running = false, visible = true, rafId = null, last = 0;
    var RGB = '167, 139, 250';

    function size() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(70, Math.max(24, (W * H) / 22000)));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, r: Math.random() * 1.4 + 0.6 });
      }
    }

    function frame() {
      if (lite) { running = false; return; }
      /* Time-based movement, so speed is the same at 60Hz and 120Hz */
      var now = performance.now();
      if (last && now - last < 28) { if (running) rafId = requestAnimationFrame(frame); return; } /* about 35fps is plenty for a soft background */
      var dt = last ? Math.min(3, (now - last) / 16.667) : 1;
      last = now;
      ctx.clearRect(0, 0, W, H);
      var link = Math.min(150, W / 6);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fillStyle = 'rgba(' + RGB + ', .55)';
        ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < link) {
            ctx.strokeStyle = 'rgba(' + RGB + ',' + (0.16 * (1 - d / link)) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      if (running) rafId = requestAnimationFrame(frame);
    }

    function setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) { last = 0; frame(); } else cancelAnimationFrame(rafId);
    }

    size();
    frame();
    var resizeT;
    window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(size, 150); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; setRunning(visible && !document.hidden); }).observe(host);
    } else {
      setRunning(true);
    }
    document.addEventListener('visibilitychange', function () { setRunning(visible && !document.hidden); });
  }

  /* Hero terminal: an AI agent session. A prompt is typed, the agent works through its steps, then the next session starts. */
  (function () {
    var wrap = $('.term-wrap');
    if (!wrap) return;
    var log = $('.term-log', wrap);
    var ptext = $('.pt', wrap);
    var tabs = $$('.term-tab', wrap);

    var SCENES = [
      {
        prompt: 'Tell me about Varun Bawdekar',
        steps: [
          { k: 'tool', name: 'Read', arg: 'resume.pdf', sub: 'Read 2 pages' },
          { k: 'say', text: [
            'Varun is a Python developer and AI engineer based in Pune.',
            '- Jr Python Developer at OneStaff.ai, since Aug 2026',
            '- Built panels for Wealthoak.ai, OneReach and OneHR integrations',
            '- Open to software engineer and AI engineering roles'
          ].join('\n') }
        ]
      },
      {
        prompt: 'What has he built, and with what?',
        steps: [
          { k: 'tool', name: 'Search', arg: 'portfolio projects', sub: 'Found 5 projects' },
          { k: 'say', text: [
            'Five projects, from fintech to HR to sales engagement:',
            '- Wealthoak.ai: React and TypeScript panels for a trading platform',
            '- OneReach: a sales engagement platform, in the style of Apollo.io',
            '- OneHR: recruitment platform integration with Python and FastAPI'
          ].join('\n') }
        ]
      },
      {
        prompt: 'Is he a good fit for a backend and AI role?',
        steps: [
          { k: 'tool', name: 'Read', arg: 'certifications', sub: 'Read 7 certifications' },
          { k: 'say', text: [
            'Yes. He works in Python, FastAPI and PostgreSQL and ships AI-driven features.',
            '- 7 certifications, including Claude Code 101 and AWS',
            '- Reach him on WhatsApp or LinkedIn, links are on this page'
          ].join('\n') }
        ]
      },
      {
        prompt: 'Draft a short note to a recruiter introducing Varun',
        steps: [
          { k: 'tool', name: 'Write', arg: 'intro-note.md', sub: 'Drafted 3 lines, ready for review' },
          { k: 'say', text: [
            'Hi, I am Varun, a Python developer and AI engineer in Pune.',
            'I build backends and web apps with FastAPI and React, and I am open to software engineer and AI engineering roles.',
            'My portfolio and résumé are on this page.'
          ].join('\n') }
        ]
      }
    ];

    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function setTab(i) { tabs.forEach(function (t, k) { t.classList.toggle('on', k === i); }); }
    function line(cls, html) {
      var d = document.createElement('span');
      d.className = 'ln ' + cls;
      d.innerHTML = html;
      log.appendChild(d);
      return d;
    }
    function addStep(st) {
      if (st.k === 'say') return line('ln-say', '<span class="bl">●</span> ');
      line('ln-tool', '<span class="bl">●</span> <b>' + st.name + '</b><span class="ar">(' + esc(st.arg) + ')</span>');
      line('ln-sub', '⎿  ' + st.sub);
      return null;
    }

    /* Reduced motion: show the first session finished, without typing or cycling. */
    if (reduceMotion) {
      line('ln-user', esc(SCENES[0].prompt));
      SCENES[0].steps.forEach(function (st) {
        var el = addStep(st);
        if (el) el.insertAdjacentHTML('beforeend', esc(st.text));
      });
      var caret = $('.term-caret', wrap);
      if (caret) caret.style.display = 'none';
      return;
    }

    var token = 0, inView = true, spinTimer = null;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { inView = e[0].isIntersecting; }).observe(wrap);
    }
    var GLYPHS = ['✻', '✽', '✢', '✳'];

    function play(i) {
      var run = ++token;
      var scene = SCENES[i];
      var n = 0;
      clearInterval(spinTimer);
      setTab(i);
      log.innerHTML = '';
      ptext.textContent = '';

      function later(ms, fn) { setTimeout(function () { if (run === token) fn(); }, ms); }

      function finish() { later(5200, function () { play((i + 1) % SCENES.length); }); }

      function runStep(k) {
        if (k >= scene.steps.length) { finish(); return; }
        var st = scene.steps[k];
        var el = addStep(st);
        if (st.k === 'say') {
          var t = 0;
          (function stream() {
            if (!inView || document.hidden) { later(400, stream); return; }
            t += 1;
            el.innerHTML = '<span class="bl">●</span> ' + esc(st.text.slice(0, t));
            if (t < st.text.length) later(18 + Math.random() * 16, stream); else later(400, function () { runStep(k + 1); });
          })();
        } else {
          later(650, function () { runStep(k + 1); });
        }
      }

      function submit() {
        ptext.textContent = '';
        line('ln-user', esc(scene.prompt));
        var spin = line('ln-spin', '<span class="g">' + GLYPHS[0] + '</span> Thinking… <em>(esc to interrupt)</em>');
        var g = 0;
        spinTimer = setInterval(function () {
          if (run !== token) { clearInterval(spinTimer); return; }
          g = (g + 1) % GLYPHS.length;
          var gl = spin.querySelector('.g');
          if (gl) gl.textContent = GLYPHS[g];
        }, 160);
        later(1300, function () {
          clearInterval(spinTimer);
          spin.remove();
          runStep(0);
        });
      }

      function typeNext() {
        if (!inView || document.hidden) { later(400, typeNext); return; }
        n += 1;
        ptext.textContent = scene.prompt.slice(0, n);
        if (n < scene.prompt.length) later(28 + Math.random() * 34, typeNext); else later(520, submit);
      }

      later(500, typeNext);
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () { play(parseInt(t.getAttribute('data-file'), 10)); });
    });

    play(0);
  })();

  /* Certifications: live counts, topic filter chips, and a foil shine and tilt that follow the pointer */
  (function () {
    var section = $('#certifications');
    if (!section) return;
    var cards = $$('.cert-card', section);
    var chips = $$('.cert-chip', section);

    /* Numbers come from the cards themselves, so editing a card keeps the strip correct */
    var issuers = {};
    cards.forEach(function (c) { issuers[$('.cert-issuer', c).textContent.trim()] = true; });
    var totals = { certs: cards.length, issuers: Object.keys(issuers).length };
    var statEls = $$('[data-stat]', section);
    statEls.forEach(function (el) { el.setAttribute('data-to', totals[el.getAttribute('data-stat')]); el.textContent = totals[el.getAttribute('data-stat')]; });

    chips.forEach(function (chip) {
      var f = chip.getAttribute('data-filter');
      var n = cards.filter(function (c) { return f === 'all' || (' ' + c.getAttribute('data-cat') + ' ').indexOf(' ' + f + ' ') > -1; }).length;
      var small = document.createElement('small');
      small.textContent = n;
      chip.appendChild(small);
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { var on = c === chip; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
        cards.forEach(function (c) {
          var show = f === 'all' || (' ' + c.getAttribute('data-cat') + ' ').indexOf(' ' + f + ' ') > -1;
          c.hidden = !show;
          c.classList.remove('pop');
          if (show) { void c.offsetWidth; c.classList.add('pop'); }
        });
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      });
    });

    /* Count-up when the strip scrolls into view */
    if (!reduceMotion && 'IntersectionObserver' in window) {
      statEls.forEach(function (el) { el.textContent = '0'; });
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          obs.unobserve(e.target);
          var to = parseInt(e.target.getAttribute('data-to'), 10), start = performance.now();
          (function tick(now) {
            var t = Math.min((now - start) / 900, 1);
            e.target.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
            if (t < 1) requestAnimationFrame(tick);
          })(start);
        });
      }, { threshold: 0.6 });
      statEls.forEach(function (el) { obs.observe(el); });
    }

    /* Foil shine and a small 3D tilt (fine pointers only) */
    if (finePointer && !reduceMotion) {
      cards.forEach(function (card) {
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          card.style.setProperty('--mx', (x * 100) + '%');
          card.style.setProperty('--my', (y * 100) + '%');
          card.style.transform = 'perspective(900px) rotateX(' + ((0.5 - y) * 7) + 'deg) rotateY(' + ((x - 0.5) * 9) + 'deg) translateY(-4px)';
        });
        card.addEventListener('pointerleave', function () { card.style.transform = ''; });
      });
    }
  })();

  /* About badge: live Pune time, a barcode generated from the name, and a foil shine and tilt that follow the pointer */
  (function () {
    var timeEl = $('[data-pune-time]');
    if (timeEl) {
      var fmt = null;
      try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { /* no Intl time zones: leave the placeholder */ }
      var tick = function () { if (fmt) timeEl.textContent = fmt.format(new Date()); };
      tick();
      setInterval(tick, 20000);
    }

    var bar = $('[data-barcode]');
    if (bar) {
      var text = bar.getAttribute('data-barcode');
      var frag = document.createDocumentFragment();
      for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i);
        [1 + (code % 3), 1 + ((code >> 2) % 4), 1 + ((code >> 1) % 2)].forEach(function (w, k) {
          var b = document.createElement('i');
          b.style.width = w + 'px';
          if (k === 2) b.style.marginRight = '2px';
          frag.appendChild(b);
        });
      }
      bar.appendChild(frag);
    }

    var card = $('[data-badge]');
    if (card && finePointer && !reduceMotion) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', (x * 100) + '%');
        card.style.setProperty('--my', (y * 100) + '%');
        card.style.transform = 'perspective(900px) rotateX(' + ((0.5 - y) * 9) + 'deg) rotateY(' + ((x - 0.5) * 12) + 'deg)';
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    }
  })();

  particleNetwork($('.hero-canvas'), $('#hero'));
  particleNetwork($('.ts-canvas'), $('#stack'));
})();
