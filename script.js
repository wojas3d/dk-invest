(function () {
  var header = document.getElementById('header');
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  function onScroll() { header.classList.toggle('solid', window.scrollY > 40 || header.hasAttribute('data-solid')); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile: the bar shows the first three links; the burger opens a panel with the full menu.
  var mnav = document.createElement('div');
  mnav.className = 'mnav'; mnav.id = 'mnav';
  mnav.setAttribute('aria-label', 'Menu');
  nav.querySelectorAll('a').forEach(function (a) { mnav.appendChild(a.cloneNode(true)); });
  header.appendChild(mnav);
  burger.setAttribute('aria-controls', 'mnav');
  function setMenu(open) {
    mnav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
  }
  burger.addEventListener('click', function () { setMenu(!mnav.classList.contains('open')); });
  mnav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // Hero slideshow: change every 6 s, slow zoom on the active slide
  var slides = document.querySelectorAll('.slide');
  var bars = document.querySelectorAll('#progress i');
  var cur = 0, timer;
  function show(n) {
    var prev = slides[cur];
    prev.classList.remove('active');
    prev.classList.add('leaving');
    setTimeout(function () { prev.classList.remove('leaving'); }, 1500);
    cur = n;
    slides[cur].classList.remove('leaving');
    void slides[cur].offsetWidth; // restart zoom animation
    slides[cur].classList.add('active');
    bars.forEach(function (b, i) {
      b.classList.toggle('done', i < cur);
      b.classList.remove('on');
      void b.offsetWidth;
      if (i === cur) b.classList.add('on');
    });
  }
  function start() { stop(); timer = setInterval(function () { show((cur + 1) % slides.length); }, 6000); }
  function stop() { clearInterval(timer); }
  if (slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bars[0].classList.add('on');
    start();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else { show(cur); start(); }
    });
  }

  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add('in'); }); }

  // Contact form. Posted to send.php on the same server (recipient is set there).
  var form = document.getElementById('form');
  var status = document.getElementById('status');
  // Same behaviour as the original Contact Form 7 form: only the e-mail is required,
  // and "Wyślij" stays disabled until the consent box is ticked.
  if (form) {
    var consentBox = form.elements.consent, sendBtn = form.querySelector('button[type=submit]');
    var syncSend = function () { sendBtn.disabled = !consentBox.checked; };
    consentBox.addEventListener('change', syncSend);
    form.addEventListener('reset', function () { setTimeout(syncSend); });
    syncSend();
  }
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = [];
    form.querySelectorAll('[required]').forEach(function (f) {
      var invalid = f.type === 'checkbox' ? !f.checked : !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.setAttribute('aria-invalid', invalid);
      if (invalid) bad.push(f);
    });
    status.className = 'status';
    if (bad.length) {
      status.classList.add('err');
      status.textContent = 'Podaj poprawny adres e-mail i zaznacz zgodę na przetwarzanie danych.';
      bad[0].focus();
      return;
    }
    var btn = form.querySelector('button[type=submit]');
    var data = {
      'Imię i nazwisko': form.elements.name.value.trim(),
      'Firma': form.elements.company.value.trim(),
      'Telefon': form.elements.phone.value.trim(),
      'E-mail': form.elements.email.value.trim(),
      'Wiadomość': form.elements.message.value.trim(),
      _subject: 'Nowa wiadomość ze strony DK Invest',
      _replyto: form.elements.email.value.trim(),
      _template: 'table',
      _captcha: 'false',
      _honey: form.elements._honey ? form.elements._honey.value : ''
    };
    btn.disabled = true;
    status.classList.add('ok');
    status.textContent = 'Wysyłanie…';
    fetch('send.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok || res.body.success !== true) throw new Error('send failed');
        status.className = 'status ok';
        status.textContent = 'Dziękujemy! Wiadomość została wysłana – skontaktujemy się wkrótce.';
        form.reset();
      })
      .catch(function () {
        status.className = 'status err';
        status.textContent = 'Nie udało się wysłać wiadomości. Spróbuj ponownie lub zadzwoń: +48 503 054 554.';
      })
      .then(function () { btn.disabled = !form.elements.consent.checked; });
  });

  // Lightbox for gallery and floor plans, with previous/next navigation inside the clicked group
  var lb = document.getElementById('lightbox');
  if (lb && lb.showModal) {
    var lbImg = document.getElementById('lbImg');
    var group = [], idx = 0;
    var mkBtn = function (cls, label, txt) {
      var b = document.createElement('button');
      b.className = 'lb-nav ' + cls; b.type = 'button'; b.setAttribute('aria-label', label); b.textContent = txt;
      lb.appendChild(b); return b;
    };
    var prevBtn = mkBtn('lb-prev', 'Poprzednie zdjęcie', '‹');
    var nextBtn = mkBtn('lb-next', 'Następne zdjęcie', '›');
    var counter = document.createElement('div');
    counter.className = 'lb-count'; lb.appendChild(counter);
    var show = function (i) {
      idx = (i + group.length) % group.length;
      var a = group[idx];
      lbImg.src = a.dataset.full;
      lbImg.alt = a.querySelector('img').alt;
      counter.textContent = (idx + 1) + ' / ' + group.length;
      var multi = group.length > 1;
      prevBtn.hidden = nextBtn.hidden = counter.hidden = !multi;
    };
    document.querySelectorAll('[data-full]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var box = a.closest('.gallery, .plans, .units') || document;
        group = Array.prototype.slice.call(box.querySelectorAll('[data-full]'));
        show(group.indexOf(a));
        lb.showModal();
      });
    });
    prevBtn.addEventListener('click', function () { show(idx - 1); });
    nextBtn.addEventListener('click', function () { show(idx + 1); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    });
    var touchX = null;
    lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null || group.length < 2) return;
      var dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
    document.getElementById('lbClose').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  }
})();
