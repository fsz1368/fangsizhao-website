/**
 * 方思照个人网站 — 交互脚本
 * 功能: 粒子背景 / 视差滚动 / 滚动进度 / 打字效果 / 主题切换 / 滚动动画 / 技能雷达 / 导航动态
 */
(function () {
  'use strict';

  /* ========== 低多边形无人机动画 ========== */
  var droneCanvas = document.getElementById('droneCanvas');
  if (droneCanvas) {
    (function () {
      var dctx = droneCanvas.getContext('2d'), W, H, t = 0;
      function resize() { W = droneCanvas.offsetWidth; H = droneCanvas.offsetHeight; droneCanvas.width = W; droneCanvas.height = H; }
      resize(); window.addEventListener('resize', resize);
      function poly(pts, fill, stroke, cx, cy, s, osc) {
        dctx.beginPath(); dctx.moveTo(cx + pts[0] * s, cy + osc + pts[1] * s);
        for (var i = 2; i < pts.length; i += 2) dctx.lineTo(cx + pts[i] * s, cy + osc + pts[i + 1] * s);
        dctx.closePath();
        if (fill) { dctx.fillStyle = fill; dctx.fill(); }
        if (stroke) { dctx.strokeStyle = stroke; dctx.lineWidth = 1.5; dctx.stroke(); }
      }
      function draw() {
        dctx.clearRect(0, 0, W, H); t += 0.006;
        var cx = W * 0.5, cy = H * 0.38, s = Math.min(W, H) * 0.35;
        var osc = Math.sin(t) * s * 0.08;
        var rot = Math.sin(t * 0.7) * 0.05;
        // 保存旋转
        dctx.save(); dctx.translate(cx, cy + osc); dctx.rotate(rot); dctx.translate(-cx, -(cy + osc));
        // 机臂
        poly([-0.6, 0, 0.6, 0], null, 'rgba(59,130,246,0.2)', cx, cy + osc, s);
        poly([0, -0.4, 0, 0.5], null, 'rgba(59,130,246,0.15)', cx, cy + osc, s);
        // 机身
        poly([0, -0.45, -0.2, 0.15, -0.12, 0.3, 0.12, 0.3, 0.2, 0.15], 'rgba(59,130,246,0.1)', 'rgba(59,130,246,0.5)', cx, cy + osc, s);
        // 机翼 - 左
        poly([-0.65, 0.05, -0.15, 0.05, -0.05, -0.1, -0.55, -0.1], 'rgba(99,102,241,0.06)', 'rgba(99,102,241,0.35)', cx, cy + osc, s);
        // 机翼 - 右
        poly([0.65, 0.05, 0.15, 0.05, 0.05, -0.1, 0.55, -0.1], 'rgba(99,102,241,0.06)', 'rgba(99,102,241,0.35)', cx, cy + osc, s);
        dctx.restore();
        // 螺旋桨光环
        var propellers = [[cx - 0.6 * s, cy + osc], [cx + 0.6 * s, cy + osc], [cx, cy + osc - 0.4 * s], [cx, cy + osc + 0.5 * s]];
        propellers.forEach(function (p) {
          var grad = dctx.createRadialGradient(p[0], p[1], s * 0.02, p[0], p[1], s * 0.15);
          grad.addColorStop(0, 'rgba(59,130,246,' + (0.3 + Math.sin(t * 3) * 0.2) + ')');
          grad.addColorStop(1, 'rgba(59,130,246,0)');
          dctx.beginPath(); dctx.arc(p[0], p[1], s * 0.15, 0, Math.PI * 2);
          dctx.fillStyle = grad; dctx.fill();
        });
        requestAnimationFrame(draw);
      }
      draw();
    })();
  }

  /* ========== 粒子背景 ========== */
  var canvas = document.getElementById('particleCanvas');
  if (canvas) {
    var ctx = canvas.getContext('2d'), particles = [], animId;
    var PARTICLE_COUNT = 80, mouseX = -100, mouseY = -100;
    function resizeCanvas() { var hero = document.getElementById('hero'); if (hero) { canvas.width = hero.offsetWidth; canvas.height = hero.offsetHeight; } }
    function createParticles() {
      particles = [];
      for (var i = 0; i < PARTICLE_COUNT; i++) particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2.5 + 0.5, speedX: (Math.random() - 0.5) * 0.4, speedY: (Math.random() - 0.5) * 0.4 - 0.2, opacity: Math.random() * 0.5 + 0.1 });
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(function (p, i) {
        p.x += p.speedX; p.y += p.speedY;
        if (p.x < -10) p.x = canvas.width + 10; if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10; if (p.y > canvas.height + 10) p.y = -10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        var isDark = document.documentElement.getAttribute('data-bs-theme') !== 'light';
        var r = isDark ? 59 : 37, g = isDark ? 130 : 99, b = isDark ? 246 : 235;
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + p.opacity + ')'; ctx.fill();
        for (var j = i + 1; j < particles.length; j++) { var dx = p.x - particles[j].x, dy = p.y - particles[j].y, dist = Math.sqrt(dx * dx + dy * dy); if (dist < 120) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(particles[j].x, particles[j].y); ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.06 * (1 - dist / 120)) + ')'; ctx.lineWidth = 0.5; ctx.stroke(); } }
      });
      if (mouseX > 0 && mouseY > 0) { var g = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 150); g.addColorStop(0, 'rgba(59,130,246,0.08)'); g.addColorStop(1, 'rgba(59,130,246,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      animId = requestAnimationFrame(draw);
    }
    var heroEl = document.getElementById('hero');
    if (heroEl) {
      heroEl.addEventListener('mousemove', function (e) { var rect = heroEl.getBoundingClientRect(); mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top; });
      heroEl.addEventListener('mouseleave', function () { mouseX = -100; mouseY = -100; });
      // Hero 不可见时暂停粒子动画
      var paused = false;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting && paused) { draw(); paused = false; }
          else if (!entries[0].isIntersecting && !paused) { cancelAnimationFrame(animId); paused = true; }
        }, { threshold: 0 }).observe(heroEl);
      }
    }
    resizeCanvas(); createParticles(); draw();
    window.addEventListener('resize', function () { resizeCanvas(); createParticles(); });
  }

  /* ========== 视差滚动 ========== */
  var glow1 = document.querySelector('.hero-glow-1'), glow2 = document.querySelector('.hero-glow-2'), heroAvatar = document.querySelector('.hero-avatar');
  function updateParallax() { var sy = window.scrollY, h = window.innerHeight; if (sy < h) { if (glow1) glow1.style.transform = 'translateY(' + (sy * 0.3) + 'px)'; if (glow2) glow2.style.transform = 'translateY(' + (sy * -0.2) + 'px)'; if (heroAvatar) heroAvatar.style.transform = 'translateY(' + (sy * -0.15) + 'px)'; } }

  /* ========== 滚动进度条 ========== */
  var progressBar = document.getElementById('scrollProgress');
  function updateProgressBar() { if (!progressBar) return; var st = window.scrollY, dh = document.documentElement.scrollHeight - window.innerHeight; if (dh <= 0) return; progressBar.style.width = Math.min((st / dh) * 100, 100) + '%'; }

  /* ========== 主题切换 ========== */
  var html = document.documentElement, themeToggle = document.getElementById('themeToggle'), themeIcon = themeToggle ? themeToggle.querySelector('i') : null;
  function getPreferredTheme() { var s = localStorage.getItem('fangsizhao-theme'); return s || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); }
  function applyTheme(theme) { html.setAttribute('data-bs-theme', theme); if (themeIcon) themeIcon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill'; if (themeToggle) themeToggle.setAttribute('aria-label', theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'); }
  applyTheme(getPreferredTheme());
  if (themeToggle) themeToggle.addEventListener('click', function () { var t = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark'; applyTheme(t); localStorage.setItem('fangsizhao-theme', t); });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (!localStorage.getItem('fangsizhao-theme')) applyTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); });

  /* ========== 打字机效果 ========== */
  var typingText = document.getElementById('typingText');
  if (typingText) {
    var phrases = ['无人机 × 新媒体 双栖实践者', '从天空到屏幕的跨界探索', '以数据丈量世界，用流量驱动增长', '三年航测实操 + 两年抖音运营'];
    var pi = 0, ci = 0, del = false, sp = 80;
    function type() { var cur = phrases[pi]; if (del) { typingText.textContent = cur.substring(0, ci - 1); ci--; sp = 35; } else { typingText.textContent = cur.substring(0, ci + 1); ci++; sp = 75; } if (!del && ci === cur.length) { sp = 2200; del = true; } if (del && ci === 0) { del = false; pi = (pi + 1) % phrases.length; sp = 350; } setTimeout(type, sp); }
    setTimeout(type, 600);
  }

  /* ========== 滚动渐入动画 ========== */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    document.body.classList.add('reveal-animated');
    reveals.forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('visible'); });
    var obs = new IntersectionObserver(function (entries) { entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }); }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
    reveals.forEach(function (el) { if (!el.classList.contains('visible')) obs.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('visible'); }); }

  /* ========== 导航激活 + 动态样式 ========== */
  var navLinks = document.querySelectorAll('#mainNav .nav-link'), sections = [];
  navLinks.forEach(function (l) { var h = l.getAttribute('href'); if (h && h.startsWith('#')) { var t = document.getElementById(h.substring(1)); if (t) sections.push({ link: l, target: t }); } });
  function updateActiveNav() { var cur = null, sp = window.scrollY + 120; sections.forEach(function (s) { var t = s.target.offsetTop, b = t + s.target.offsetHeight; if (sp >= t && sp < b) cur = s.link; }); navLinks.forEach(function (l) { l.classList.remove('active'); }); if (cur) cur.classList.add('active'); }

  /* ========== 统一滚动处理（合并导航/进度/视差/显隐/回顶） ========== */
  var navbar = document.getElementById('mainNav'), scrollTicking = false, lastScrollY = 0;
  window.addEventListener('scroll', function () {
    if (!scrollTicking) { requestAnimationFrame(function () {
      var cur = window.scrollY, nh = navbar ? navbar.offsetHeight : 60;
      updateActiveNav(); updateProgressBar(); updateParallax();
      // 导航栏滚动样式
      if (navbar) { if (cur > 50) navbar.classList.add('scrolled'); else navbar.classList.remove('scrolled'); }
      // 导航显示/隐藏
      if (cur > nh * 3) { if (cur > lastScrollY + 8 && navbar) navbar.style.transform = 'translateY(-100%)'; else if (cur < lastScrollY - 8 && navbar) navbar.style.transform = 'translateY(0)'; }
      else { if (navbar) navbar.style.transform = 'translateY(0)'; }
      // 回顶按钮
      if (backBtn) { if (cur > 600) backBtn.classList.add('visible'); else backBtn.classList.remove('visible'); }
      lastScrollY = cur; scrollTicking = false;
    }); scrollTicking = true; }
  });
  updateActiveNav(); updateProgressBar();

  /* ========== 折叠菜单自动收起 ========== */
  var nc = document.getElementById('navbarNav');
  if (nc) nc.addEventListener('click', function (e) { if (e.target.tagName === 'A' && nc.classList.contains('show')) { var bs = bootstrap.Collapse.getInstance(nc); if (bs) bs.hide(); } });

  /* ========== 按钮点击反馈 ========== */
  document.addEventListener('click', function (e) { var btn = e.target.closest('.btn'); if (!btn || btn.closest('#downloadResume')) return; btn.style.transition = 'transform 0.15s ease-out'; btn.style.transform = 'scale(0.96)'; setTimeout(function () { btn.style.transform = ''; }, 180); });

  /* ========== 回到顶部按钮 ========== */
  var backBtn = document.createElement('button');
  backBtn.id = 'backToTop'; backBtn.className = 'back-to-top'; backBtn.title = '回到顶部';
  backBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
  document.body.appendChild(backBtn);

  backBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ========== 下载按钮 ========== */
  var dlBtn = document.getElementById('downloadResume');
  if (dlBtn) {
    dlBtn.addEventListener('click', function () {
      var file = this.getAttribute('data-file');
      if (!file) return;
      var ready = this.querySelector('.download-ready');
      var loading = this.querySelector('.download-loading');
      this.classList.add('loading');
      if (ready) ready.classList.add('d-none');
      if (loading) loading.classList.remove('d-none');
      setTimeout(function () {
        var a = document.createElement('a');
        a.href = file; a.download = file; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        if (dlBtn) { dlBtn.classList.remove('loading'); if (ready) ready.classList.remove('d-none'); if (loading) loading.classList.add('d-none'); }
      }, 600);
    });
  }

  /* ========== 技能雷达图 ========== */
  var radarCanvas = document.getElementById('skillRadar');
  if (radarCanvas) {
    var skills = [
      { label: '无人机测绘', value: 90, color: '#3B82F6' },
      { label: '新媒体运营', value: 85, color: '#F59E0B' },
      { label: '视觉设计', value: 70, color: '#A855F7' },
      { label: '数据分析', value: 78, color: '#10B981' },
      { label: '项目管理', value: 75, color: '#F43F5E' },
      { label: '客户服务', value: 88, color: '#06B6D4' }
    ];
    var legendEl = document.getElementById('radarLegend');
    if (legendEl) { var lh = ''; skills.forEach(function (s) { lh += '<div class="radar-legend-item"><span class="radar-legend-dot" style="background:' + s.color + '"></span><span>' + s.label + '</span><span class="radar-legend-value">' + s.value + '%</span></div>'; }); legendEl.innerHTML = lh; }
    var rctx = radarCanvas.getContext('2d'), cx = 200, cy = 200, rr = 160, n = skills.length, step = (Math.PI * 2) / n;
    function drawRadar() {
      rctx.clearRect(0, 0, 400, 400);
      for (var lv = 1; lv <= 4; lv++) { var lr = (rr / 4) * lv; rctx.beginPath(); for (var i = 0; i <= n; i++) { var a = step * i - Math.PI / 2, x = cx + lr * Math.cos(a), y = cy + lr * Math.sin(a); if (i === 0) rctx.moveTo(x, y); else rctx.lineTo(x, y); } rctx.closePath(); rctx.strokeStyle = 'rgba(148,163,184,0.15)'; rctx.lineWidth = 1; rctx.stroke(); }
      for (var i = 0; i < n; i++) { var a = step * i - Math.PI / 2; rctx.beginPath(); rctx.moveTo(cx, cy); rctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); rctx.strokeStyle = 'rgba(148,163,184,0.1)'; rctx.stroke(); rctx.fillStyle = '#94A3B8'; rctx.font = '13px -apple-system, "PingFang SC", sans-serif'; rctx.textAlign = 'center'; rctx.textBaseline = 'middle'; rctx.fillText(skills[i].label, cx + (rr + 32) * Math.cos(a), cy + (rr + 32) * Math.sin(a)); }
      rctx.beginPath(); for (var i = 0; i < n; i++) { var a = step * i - Math.PI / 2, vr = (rr / 100) * skills[i].value, x = cx + vr * Math.cos(a), y = cy + vr * Math.sin(a); if (i === 0) rctx.moveTo(x, y); else rctx.lineTo(x, y); } rctx.closePath(); rctx.fillStyle = 'rgba(59,130,246,0.12)'; rctx.fill(); rctx.strokeStyle = 'rgba(59,130,246,0.5)'; rctx.lineWidth = 2.5; rctx.stroke();
      for (var i = 0; i < n; i++) { var a = step * i - Math.PI / 2, vr = (rr / 100) * skills[i].value, dx = cx + vr * Math.cos(a), dy = cy + vr * Math.sin(a); rctx.beginPath(); rctx.arc(dx, dy, 5, 0, Math.PI * 2); rctx.fillStyle = skills[i].color; rctx.fill(); rctx.strokeStyle = '#fff'; rctx.lineWidth = 2; rctx.stroke(); }
    }
    drawRadar();
    window.addEventListener('resize', drawRadar);
  }

})();
