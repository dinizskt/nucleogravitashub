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

  // Proof carousel (infinite auto-scroll, pause on touch so it stays readable on mobile)
  const carousel = document.getElementById('carousel');
  if (carousel) {
    carousel.addEventListener('touchstart', () => carousel.classList.add('is-touched'), { passive: true });
    carousel.addEventListener('touchend', () => {
      setTimeout(() => carousel.classList.remove('is-touched'), 2500);
    }, { passive: true });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-item__q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!wasActive) item.classList.add('active');
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
