/**
 * 方思照个人网站 — 交互脚本
 * 功能: 粒子背景 / 视差滚动 / 滚动进度 / 打字效果 / 主题切换 / 滚动动画
 */

(function () {
  'use strict';

  /* ========== 粒子背景 (Canvas) ========== */
  const canvas = document.getElementById('particleCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    const PARTICLE_COUNT = 80;

    function resizeCanvas() {
      const hero = document.getElementById('hero');
      if (hero) {
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;
      }
    }

    function createParticles() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2.5 + 0.5,
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: (Math.random() - 0.5) * 0.4 - 0.2,
          opacity: Math.random() * 0.5 + 0.1
        });
      }
    }

    function drawParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(function (p, i) {
        // 更新位置
        p.x += p.speedX;
        p.y += p.speedY;

        // 边界回绕
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        // 绘制粒子
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        // 使用当前主题的强调色
        var isDark = document.documentElement.getAttribute('data-bs-theme') !== 'light';
        var r = isDark ? 59 : 37;
        var g = isDark ? 130 : 99;
        var b = isDark ? 246 : 235;
        ctx.fillStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + p.opacity + ')';
        ctx.fill();

        // 连线（距离近的粒子之间）
        for (var j = i + 1; j < particles.length; j++) {
          var dx = p.x - particles[j].x;
          var dy = p.y - particles[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (0.06 * (1 - dist / 120)) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      // 鼠标交互光点
      if (mouseX > 0 && mouseY > 0) {
        var gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 150);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationId = requestAnimationFrame(drawParticles);
    }

    var mouseX = -100;
    var mouseY = -100;
    var heroSection = document.getElementById('hero');

    if (heroSection) {
      heroSection.addEventListener('mousemove', function (e) {
        var rect = heroSection.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
      });

      heroSection.addEventListener('mouseleave', function () {
        mouseX = -100;
        mouseY = -100;
      });
    }

    resizeCanvas();
    createParticles();
    drawParticles();

    window.addEventListener('resize', function () {
      resizeCanvas();
      createParticles();
    });
  }

  /* ========== 视差滚动 ========== */
  var glow1 = document.querySelector('.hero-glow-1');
  var glow2 = document.querySelector('.hero-glow-2');
  var heroAvatar = document.querySelector('.hero-avatar');

  function updateParallax() {
    var scrollY = window.scrollY;
    var heroHeight = window.innerHeight;

    if (scrollY < heroHeight) {
      var factor = scrollY / heroHeight;
      if (glow1) glow1.style.transform = 'translateY(' + (scrollY * 0.3) + 'px)';
      if (glow2) glow2.style.transform = 'translateY(' + (scrollY * -0.2) + 'px)';
      if (heroAvatar) heroAvatar.style.transform = 'translateY(' + (scrollY * -0.15) + 'px)';
    }
  }

  /* ========== 滚动进度条 ========== */
  var progressBar = document.getElementById('scrollProgress');

  function updateProgressBar() {
    if (!progressBar) return;
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    var progress = Math.min((scrollTop / docHeight) * 100, 100);
    progressBar.style.width = progress + '%';
  }

  /* ========== 主题切换 ========== */
  var html = document.documentElement;
  var themeToggle = document.getElementById('themeToggle');
  var themeIcon = themeToggle ? themeToggle.querySelector('i') : null;

  function getPreferredTheme() {
    var stored = localStorage.getItem('fangsizhao-theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    html.setAttribute('data-bs-theme', theme);
    if (themeIcon) {
      themeIcon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题');
    }
  }

  var currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var newTheme = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem('fangsizhao-theme', newTheme);
    });
  }

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
    if (!localStorage.getItem('fangsizhao-theme')) {
      applyTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    }
  });

  /* ========== 打字机效果 ========== */
  var typingText = document.getElementById('typingText');
  if (typingText) {
    var phrases = [
      '无人机 × 新媒体 双栖实践者',
      '从天空到屏幕的跨界探索',
      '以数据丈量世界，用流量驱动增长',
      '三年航测实操 + 两年抖音运营'
    ];
    var phraseIndex = 0;
    var charIndex = 0;
    var isDeleting = false;
    var typeSpeed = 80;

    function typeLoop() {
      var current = phrases[phraseIndex];

      if (isDeleting) {
        typingText.textContent = current.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 35;
      } else {
        typingText.textContent = current.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 75;
      }

      if (!isDeleting && charIndex === current.length) {
        typeSpeed = 2200;
        isDeleting = true;
      }

      if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 350;
      }

      setTimeout(typeLoop, typeSpeed);
    }

    setTimeout(typeLoop, 600);
  }

  /* ========== 滚动渐入动画 (Intersection Observer) ========== */
  var revealElements = document.querySelectorAll('.reveal');

  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    // 先添加动画门控类（在它之前所有内容保持可见）
    document.body.classList.add('reveal-animated');

    // 立即检查哪些元素已在视口内，直接标记为可见
    revealElements.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('visible');
      }
    });

    // 设置 IntersectionObserver 处理后续滚动
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.05,
      rootMargin: '0px 0px -20px 0px'
    });

    revealElements.forEach(function (el) {
      // 对已可见的元素不再观察
      if (!el.classList.contains('visible')) {
        observer.observe(el);
      }
    });
  } else {
    // 降级：不支持 IntersectionObserver 时全部可见
    revealElements.forEach(function (el) {
      el.classList.add('visible');
    });
  }

  /* ========== 导航栏激活状态 ========== */
  var navLinks = document.querySelectorAll('#mainNav .nav-link');
  var sections = [];

  navLinks.forEach(function (link) {
    var href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      var target = document.getElementById(href.substring(1));
      if (target) {
        sections.push({ link: link, target: target });
      }
    }
  });

  function updateActiveNav() {
    var currentSection = null;
    var scrollPos = window.scrollY + 120;

    sections.forEach(function (item) {
      var top = item.target.offsetTop;
      var bottom = top + item.target.offsetHeight;
      if (scrollPos >= top && scrollPos < bottom) {
        currentSection = item.link;
      }
    });

    navLinks.forEach(function (link) {
      link.classList.remove('active');
    });

    if (currentSection) {
      currentSection.classList.add('active');
    }
  }

  /* ========== 统一滚动处理（节流） ========== */
  var scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (!scrollTicking) {
      requestAnimationFrame(function () {
        updateActiveNav();
        updateProgressBar();
        updateParallax();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  });

  updateActiveNav();
  updateProgressBar();

  /* ========== 导航栏折叠菜单点击后自动收起 ========== */
  var navbarCollapse = document.getElementById('navbarNav');
  var navbarToggler = document.querySelector('.navbar-toggler');

  if (navbarCollapse && navbarToggler) {
    navbarCollapse.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && navbarCollapse.classList.contains('show')) {
        var bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
        if (bsCollapse) {
          bsCollapse.hide();
        }
      }
    });
  }

  /* ========== 视频懒加载（使用 poster 占位，接近视口时开始加载） ========== */
  var videos = document.querySelectorAll('.portfolio-card video');

  if (videos.length > 0 && 'IntersectionObserver' in window) {
    var videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var video = entry.target;
          // 触发加载
          if (video.getAttribute('preload') !== 'auto') {
            video.setAttribute('preload', 'auto');
          }
          video.load();
          videoObserver.unobserve(video);
        }
      });
    }, { threshold: 0.02, rootMargin: '200px 0px' });

    videos.forEach(function (video) {
      videoObserver.observe(video);
    });
  }

  /* ========== 导航栏滚动隐藏/显示效果 ========== */
  var lastScrollY = 0;
  var navbar = document.getElementById('mainNav');

  window.addEventListener('scroll', function () {
    var currentScrollY = window.scrollY;
    if (currentScrollY > 300) {
      if (currentScrollY > lastScrollY + 10) {
        // 向下滚动 - 隐藏
        if (navbar) navbar.style.transform = 'translateY(-100%)';
      } else if (currentScrollY < lastScrollY - 10) {
        // 向上滚动 - 显示
        if (navbar) navbar.style.transform = 'translateY(0)';
      }
    } else {
      if (navbar) navbar.style.transform = 'translateY(0)';
    }
    lastScrollY = currentScrollY;
  });

})();
