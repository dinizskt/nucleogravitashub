document.addEventListener('DOMContentLoaded', () => {

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('nav--open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('nav--open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Proof carousels (infinite auto-scroll, pause on touch so it stays readable on mobile)
  document.querySelectorAll('.carousel').forEach(carousel => {
    carousel.addEventListener('touchstart', () => carousel.classList.add('is-touched'), { passive: true });
    carousel.addEventListener('touchend', () => {
      setTimeout(() => carousel.classList.remove('is-touched'), 2500);
    }, { passive: true });
  });

  // FAQ accordion
  document.querySelectorAll('.faq-item__q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('active');
        i.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
      });
      if (!wasActive) {
        item.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Floating mobile CTA: appears after the hero CTA scrolls away, steps aside while another
  // checkout button is already on screen or the menu is open
  const fab = document.querySelector('.mobile-fab');
  const heroCta = document.querySelector('.hs__cta');
  const inlineCtas = document.querySelectorAll('main a[data-cta]:not(.hs__cta)');
  if (fab && heroCta) {
    const onScreen = el => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    };
    const updateFab = () => {
      const show = heroCta.getBoundingClientRect().bottom < 0
        && ![...inlineCtas].some(onScreen)
        && !(nav && nav.classList.contains('nav--open'));
      fab.classList.toggle('is-visible', show);
    };
    window.addEventListener('scroll', updateFab, { passive: true });
    window.addEventListener('resize', updateFab, { passive: true });
    if (navToggle) navToggle.addEventListener('click', updateFab);
    updateFab();
  }

  // Measurement: every checkout button has data-cta with its location. Events go to whichever
  // analytics tool is installed on the page (Google Tag Manager/GA4, Meta Pixel, Vercel Analytics)
  document.querySelectorAll('a[data-cta]').forEach(link => {
    link.addEventListener('click', () => {
      const location = link.dataset.cta;
      (window.dataLayer = window.dataLayer || []).push({ event: 'checkout_click', cta_location: location, link_url: link.href });
      if (typeof window.gtag === 'function') window.gtag('event', 'begin_checkout', { cta_location: location });
      if (typeof window.fbq === 'function') window.fbq('track', 'InitiateCheckout', { content_name: location });
      if (typeof window.va === 'function') window.va('event', { name: 'checkout_click', data: { cta_location: location } });
    });
  });

  // Header background intensifies on scroll
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 10 ? '0 8px 30px -18px rgba(0,0,0,0.6)' : 'none';
    });
  }

  // Count-up animation for result stat values
  const statValues = document.querySelectorAll('.results-stats strong');
  const animateValue = (el) => {
    const text = el.childNodes[0].nodeValue.trim();
    const match = text.match(/([\d.,]+)/);
    if (!match) return;
    const numStr = match[1];
    const prefix = text.slice(0, match.index);
    const suffix = text.slice(match.index + numStr.length);

    let numeric, isBRDecimal = false, isPlainDecimal = false;
    if (numStr.includes(',')) {
      isBRDecimal = true;
      numeric = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    } else if (/\.\d{1,2}$/.test(numStr) && (numStr.match(/\./g) || []).length === 1) {
      isPlainDecimal = true;
      numeric = parseFloat(numStr);
    } else {
      numeric = parseFloat(numStr.replace(/\./g, ''));
    }
    if (isNaN(numeric)) return;

    const duration = 1200;
    const start = performance.now();

    const frame = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numeric * eased;
      const formatted = isBRDecimal
        ? current.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : isPlainDecimal
          ? current.toFixed(1)
          : Math.round(current).toLocaleString('pt-BR');
      el.childNodes[0].nodeValue = prefix + formatted + suffix;
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateValue(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  statValues.forEach(el => observer.observe(el));
});

// Hub do método: linhas do núcleo até cada frente, com pacotes de dados; as frentes acendem uma a uma no scroll
(() => {
  const hub = document.querySelector('.hub');
  if (!hub) return;
  const svg = hub.querySelector('.hub__lines');
  const core = hub.querySelector('.hub__core');
  const nodes = [...hub.querySelectorAll('.hub__node')];
  const dots = [...hub.querySelectorAll('.hub__dot')];
  const COLORS = ['#b98af0', '#3ddc84', '#38bdf8', '#f3d27a'];
  const NS = 'http://www.w3.org/2000/svg';
  let links = [];
  const center = el => {
    const h = hub.getBoundingClientRect(), r = el.getBoundingClientRect();
    return [r.left - h.left + r.width / 2, r.top - h.top + r.height / 2];
  };
  const curve = ([x1, y1], [x2, y2]) => `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${(x1 + (x2 - x1) * 0.6).toFixed(1)} ${(y1 + (y2 - y1) * 0.08).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  const build = () => {
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${hub.clientWidth} ${hub.clientHeight}`);
    const c = center(core);
    links = [...nodes, ...dots].filter(el => el.offsetParent).map((el, i) => {
      const d = curve(c, center(el));
      const line = document.createElementNS(NS, 'path');
      line.setAttribute('d', d); line.setAttribute('pathLength', '100'); line.setAttribute('class', 'hub__line');
      const packet = document.createElementNS(NS, 'path');
      packet.setAttribute('d', d); packet.setAttribute('pathLength', '100'); packet.setAttribute('class', 'hub__packet');
      packet.style.stroke = COLORS[i % COLORS.length];
      packet.style.animationDelay = (-i * 0.7) + 's';
      svg.append(line, packet);
      return { el, line, packet, node: el.classList.contains('hub__node') };
    });
    update();
  };
  const setOn = (l, on) => { l.line.classList.toggle('is-on', on); l.packet.classList.toggle('is-on', on); if (l.node) l.el.classList.toggle('is-on', on); };
  const update = () => {
    const r = hub.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (r.height + vh * 0.35)));
    let n = 0;
    links.forEach(l => {
      if (l.node) { setOn(l, p > 0.14 + n * 0.14); n++; }
      else setOn(l, p > 0.08);
    });
  };
  build();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { links.forEach(l => setOn(l, true)); return; }
  window.addEventListener('scroll', update, { passive: true });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 150); }, { passive: true });
})();

// Resultados: barra do aluno top 1 enche quando aparece na tela
(() => {
  const hero = document.querySelector('.rhero');
  if (!hero) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { hero.classList.add('is-in'); io.disconnect(); } });
  }, { threshold: 0.4 });
  io.observe(hero);
})();

// Hero: notificações de venda aprovada caindo na tela do notebook (valores tirados de um print real)
(() => {
  const box = document.querySelector('.lscreen__ntfs');
  if (!box) return;
  const VALUES = ['47,00', '777,00', '87,30', '47,00', '472,00', '47,00', '87,30', '777,00'];
  const TIMES = ['agora', 'há 1min', 'há 3min', 'há 6min', 'há 11min'];
  const MAX = 4;
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M6.5 4.5v8a5.5 5.5 0 0 0 11 0v-8"/></svg>';
  let k = 0;
  const make = () => {
    const el = document.createElement('div');
    el.className = 'ntf';
    el.innerHTML = `<span class="ntf__icon">${ICON}</span><span class="ntf__body"><strong>Venda aprovada!</strong><span>Valor: R$ ${VALUES[k++ % VALUES.length]}</span></span><span class="ntf__time"></span>`;
    return el;
  };
  const layout = () => {
    [...box.children].forEach((el, i) => {
      el.style.setProperty('--i', i);
      el.querySelector('.ntf__time').textContent = TIMES[Math.min(i, TIMES.length - 1)];
    });
  };
  // começa com a pilha cheia
  for (let i = 0; i < MAX - 1; i++) box.appendChild(make());
  layout();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const push = () => {
    const el = make();
    el.classList.add('is-new');
    box.prepend(el);
    layout();
    const items = [...box.children];
    if (items.length > MAX) {
      const old = items[items.length - 1];
      old.classList.add('is-out');
      setTimeout(() => old.remove(), 950);
    }
  };
  let timer = null;
  const start = () => { if (!timer) timer = setInterval(push, 1600); };
  const stop = () => { clearInterval(timer); timer = null; };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(box.closest('.hs__scene'));
  } else start();
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
})();

// Hero: encaixa a tela HTML no quadrilátero da tela do notebook renderizado (homografia -> matrix3d)
(() => {
  const scene = document.querySelector('.hs__scene');
  const screen = scene && scene.querySelector('.lscreen');
  if (!screen) return;
  // cantos da tela no render (fração da largura/altura da imagem): sup. esq., sup. dir., inf. dir., inf. esq.
  const QUAD = [[0.2479, 0.1006], [0.70408, 0.0776], [0.7219, 0.6024], [0.27419, 0.6883]];
  const SW = 1000, SH = 633;
  const solve = (A, b) => {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  };
  const fit = () => {
    const w = scene.clientWidth, h = scene.clientHeight;
    if (!w || !h) return;
    const src = [[0, 0], [SW, 0], [SW, SH], [0, SH]];
    const dst = QUAD.map(([x, y]) => [x * w, y * h]);
    const A = [], b = [];
    src.forEach(([x, y], i) => {
      const [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    });
    const [a, bb, c, d, e, f, g, hh] = solve(A, b);
    screen.style.transform = `matrix3d(${a},${d},0,${g},${bb},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
    screen.classList.add('is-on');
  };
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(scene);
  else window.addEventListener('resize', fit, { passive: true });
})();
