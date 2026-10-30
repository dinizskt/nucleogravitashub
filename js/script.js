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

// Anel de Saturno do método: o anel e as 4 frentes giram em 3D conforme a página rola
(() => {
  const orbit = document.querySelector('.orbit');
  if (!orbit) return;
  const nodes = [...orbit.querySelectorAll('.orbit__node')];
  const R = 162;               // raio do anel (meio da faixa principal)
  const FLAT = 0.4;            // achatamento, igual ao scaleY do anel
  const TILT = -14 * Math.PI / 180;
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);

  const place = (spinDeg) => {
    orbit.style.setProperty('--spin', spinDeg.toFixed(1) + 'deg');
    nodes.forEach((node, i) => {
      const a = (spinDeg + 45 + i * 90) * Math.PI / 180;
      const ex = R * Math.cos(a);
      const ey = R * FLAT * Math.sin(a);
      const x = ex * cosT - ey * sinT;
      const y = ex * sinT + ey * cosT;
      const depth = Math.sin(a);              // 1 = na frente, -1 = atras do logo
      const scale = 0.8 + 0.2 * (depth + 1) / 2;
      node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -22px) scale(${scale.toFixed(3)})`;
      node.style.opacity = (0.45 + 0.55 * (depth + 1) / 2).toFixed(2);
      node.style.zIndex = depth >= 0 ? 5 : 2;
      // nome some quando a frente passa por tras do logo
      node.style.setProperty('--label', Math.min(1, Math.max(0, (depth + 0.35) / 0.6)).toFixed(2));
    });
  };

  place(0);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const r = orbit.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < -200 || r.top > vh + 200) return;
    const progress = (vh - r.top) / (vh + r.height);
    place(progress * 360);
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
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
