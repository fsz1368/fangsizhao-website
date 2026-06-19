/**
 * 方思照个人网站 — 作品瀑布流管理器
 * IndexedDB 持久存储 + 拖拽上传 + 拖动排序 + 分类筛选 + 注解
 */
(function () {
  'use strict';

  var DB_NAME = 'fangsizhao-portfolio';
  var DB_VERSION = 2;
  var STORE_NAME = 'media';
  var db = null;
  var currentItems = [];
  var currentLightboxId = null;
  var currentFilter = 'all';

  var masonryGrid = document.getElementById('masonryGrid');
  var dropOverlay = document.getElementById('dropOverlay');
  var dropHint = document.getElementById('dropHint');
  var lightbox = document.getElementById('lightbox');
  var lightboxContent = document.getElementById('lightboxContent');
  var lightboxClose = document.getElementById('lightboxClose');
  var lightboxDelete = document.getElementById('lightboxDelete');
  var filterContainer = document.getElementById('portfolioFilters');

  /* ========== IndexedDB ========== */
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          d.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = function (e) { db = e.target.result; resolve(db); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function saveItem(item) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(item);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  }

  function loadAllItems() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = function () {
        resolve((req.result || []).sort(function (a, b) {
          return (b.createdAt || 0) - (a.createdAt || 0);
        }));
      };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function deleteItem(id) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  }

  /* ========== 缩略图生成 ========== */
  function generateVideoThumb(file) {
    return new Promise(function (resolve) {
      var resolved = false;
      var url = URL.createObjectURL(file);
      var video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.muted = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
      video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(video);

      function capture() {
        if (resolved) return;
        try {
          var canvas = document.createElement('canvas');
          var w = video.videoWidth || 400, h = video.videoHeight || (w * 0.75);
          var maxW = 400; if (w > maxW) { h = (maxW / w) * h; w = maxW; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(video, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          cleanup(); resolved = true;
          resolve({ thumb: dataUrl, width: w, height: h });
        } catch (e) { fallback(); }
      }
      function fallback() { if (resolved) return; cleanup(); resolved = true; resolve({ thumb: null, width: 400, height: 300 }); }
      function cleanup() { try { video.pause(); video.src = ''; } catch(e) {} try { URL.revokeObjectURL(url); } catch(e) {} try { document.body.removeChild(video); } catch(e) {} }

      video.onloadedmetadata = function () {
        video.currentTime = 0;
        video.play().then(function () {
          setTimeout(function () { video.pause(); capture(); }, 150);
        }).catch(function () { video.currentTime = 0.1; });
      };
      video.onseeked = function () { if (video.currentTime > 0 && !resolved) capture(); };
      video.onerror = fallback;
      video.src = url; video.load();
      setTimeout(function () { if (resolved) return; if (video.videoWidth > 0) capture(); else fallback(); }, 6000);
    });
  }

  function readImageFile(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () { resolve({ thumb: e.target.result, width: img.width, height: img.height }); };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.readAsDataURL(file);
    });
  }

  /* ========== 分类推断 ========== */
  function inferCategory(file) {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    return 'all';
  }

  /* ========== 文件处理 ========== */
  function processFiles(files) {
    var promises = files.map(function (file) {
      var isVideo = file.type.startsWith('video/');
      var cat = inferCategory(file);

      if (isVideo) {
        return generateVideoThumb(file).then(function (result) {
          return readFileAsDataURL(file).then(function (dataUrl) {
            return {
              id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
              type: 'video', category: cat,
              name: file.name.replace(/\.[^.]+$/, ''),
              desc: '',
              mime: file.type, dataUrl: dataUrl,
              thumb: result.thumb, thumbW: result.width, thumbH: result.height,
              size: file.size, createdAt: Date.now()
            };
          });
        });
      } else {
        return readImageFile(file).then(function (result) {
          return readFileAsDataURL(file).then(function (dataUrl) {
            return {
              id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
              type: 'image', category: cat,
              name: file.name.replace(/\.[^.]+$/, ''),
              desc: '',
              mime: file.type, dataUrl: dataUrl,
              thumb: result.thumb, thumbW: result.width, thumbH: result.height,
              size: file.size, createdAt: Date.now()
            };
          });
        });
      }
    });

    Promise.all(promises).then(function (items) {
      var savePromises = items.map(function (item) { return saveItem(item); });
      Promise.all(savePromises).then(function () {
        currentItems = items.concat(currentItems);
        renderGrid();
        if (dropHint) dropHint.style.display = 'none';
      });
    }).catch(function (err) { console.error('文件处理失败:', err); });
  }

  /* ========== 拖拽（文件上传） ========== */
  var dragCounter = 0;
  document.addEventListener('dragenter', function (e) {
    if (e.dataTransfer.types.indexOf('Files') === -1) return;
    e.preventDefault(); dragCounter++;
    if (dragCounter === 1 && dropOverlay) dropOverlay.classList.add('active');
  });
  document.addEventListener('dragleave', function (e) {
    if (e.dataTransfer.types.indexOf('Files') === -1) return;
    e.preventDefault(); dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; if (dropOverlay) dropOverlay.classList.remove('active'); }
  });
  document.addEventListener('dragover', function (e) {
    if (e.dataTransfer.types.indexOf('Files') === -1) return; e.preventDefault();
  });
  document.addEventListener('drop', function (e) {
    if (e.defaultPrevented) return;
    e.preventDefault(); dragCounter = 0;
    if (dropOverlay) dropOverlay.classList.remove('active');
    var files = Array.prototype.slice.call(e.dataTransfer.files);
    var mediaFiles = files.filter(function (f) { return f.type.startsWith('video/') || f.type.startsWith('image/'); });
    if (mediaFiles.length > 0) processFiles(mediaFiles);
  });

  /* ========== 渲染瀑布流 ========== */
  function renderGrid() {
    if (!masonryGrid) return;

    var filtered = currentFilter === 'all' ? currentItems : currentItems.filter(function (it) { return it.category === currentFilter; });

    if (filtered.length === 0) {
      masonryGrid.innerHTML = '<div class="masonry-empty"><i class="bi bi-images"></i><p>还没有作品，拖拽视频或图片进来吧</p></div>';
      return;
    }

    var html = '';
    filtered.forEach(function (item, index) {
      var thumbSrc = item.thumb || item.dataUrl;
      var aspectHint = item.thumbW && item.thumbH ? ' style="aspect-ratio:' + item.thumbW + '/' + item.thumbH + '"' : '';
      var catLabel = item.category === 'video' ? '短视频' : item.category === 'image' ? '图片' : '航测';

      html += '<div class="masonry-item" draggable="true" data-id="' + item.id + '" data-index="' + index + '">';
      html += '<img src="' + thumbSrc + '" alt="' + esc(item.name) + '"' + aspectHint + ' loading="lazy">';
      if (item.type === 'video') html += '<div class="play-overlay-mini"><div class="play-btn-mini"><i class="bi bi-play-fill"></i></div></div>';
      html += '<button class="delete-btn" title="删除" data-delete="' + item.id + '"><i class="bi bi-x-lg"></i></button>';
      html += '<span class="type-badge">' + (item.type === 'video' ? '视频' : '图片') + '</span>';
      html += '<div class="item-info">';
      html += '<span class="item-cat ' + item.category + '">' + catLabel + '</span>';
      html += '<div class="item-title">' + esc(item.name) + '</div>';
      if (item.desc) html += '<div class="item-desc">' + esc(item.desc) + '</div>';
      html += '</div></div>';
    });

    masonryGrid.innerHTML = html;

    // 删除按钮
    masonryGrid.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.stopPropagation(); removeItem(this.getAttribute('data-delete')); });
    });
    // 点击播放
    masonryGrid.querySelectorAll('.masonry-item').forEach(function (el) {
      el.addEventListener('click', function (e) { if (!el.classList.contains('dragging')) openLightbox(this.getAttribute('data-id')); });
    });
    // 拖动排序
    bindDragSort(masonryGrid.querySelectorAll('.masonry-item'));
  }

  function esc(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  /* ========== 拖动排序 ========== */
  var dragSrcId = null;
  function bindDragSort(items) {
    items.forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        dragSrcId = this.getAttribute('data-id'); this.classList.add('dragging'); this.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragSrcId);
      });
      el.addEventListener('dragend', function () { this.classList.remove('dragging'); this.style.opacity = ''; dragSrcId = null; items.forEach(function (it) { it.classList.remove('drag-over'); }); });
      el.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; if (this.getAttribute('data-id') !== dragSrcId) this.classList.add('drag-over'); });
      el.addEventListener('dragleave', function () { this.classList.remove('drag-over'); });
      el.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation(); this.classList.remove('drag-over');
        var targetId = this.getAttribute('data-id');
        if (!dragSrcId || dragSrcId === targetId) return;
        var srcIdx = -1, tgtIdx = -1;
        for (var i = 0; i < currentItems.length; i++) { if (currentItems[i].id === dragSrcId) srcIdx = i; if (currentItems[i].id === targetId) tgtIdx = i; }
        if (srcIdx >= 0 && tgtIdx >= 0) { var moved = currentItems.splice(srcIdx, 1)[0]; currentItems.splice(tgtIdx, 0, moved); saveOrder(); renderGrid(); }
      });
    });
  }

  function saveOrder() { var now = Date.now(); for (var i = currentItems.length - 1; i >= 0; i--) { currentItems[i].sortOrder = i; currentItems[i].updatedAt = now - i; saveItem(currentItems[i]); } }

  /* ========== 分类筛选 ========== */
  if (filterContainer) {
    filterContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filterContainer.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderGrid();
    });
  }

  /* ========== 灯箱播放 ========== */
  function openLightbox(id) {
    var item = currentItems.find(function (it) { return it.id === id; }); if (!item) return;
    currentLightboxId = id; lightboxContent.innerHTML = '';
    if (item.type === 'video') {
      var v = document.createElement('video'); v.src = item.dataUrl; v.controls = true; v.autoplay = true; v.playsInline = true;
      v.setAttribute('controlsList', 'nodownload'); v.style.maxWidth = '90vw'; v.style.maxHeight = '90vh'; v.style.borderRadius = '8px';
      lightboxContent.appendChild(v);
    } else {
      var img = document.createElement('img'); img.src = item.dataUrl; img.alt = item.name; img.setAttribute('draggable', 'false');
      lightboxContent.appendChild(img);
    }
    lightbox.classList.add('active'); document.body.style.overflow = 'hidden';
  }
  function closeLightbox() { var v = lightboxContent.querySelector('video'); if (v) { v.pause(); v.src = ''; } lightboxContent.innerHTML = ''; lightbox.classList.remove('active'); currentLightboxId = null; document.body.style.overflow = ''; }
  function removeItem(id) { if (currentLightboxId === id) closeLightbox(); deleteItem(id).then(function () { currentItems = currentItems.filter(function (it) { return it.id !== id; }); renderGrid(); if (currentItems.length === 0 && dropHint) dropHint.style.display = ''; }); }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxDelete) lightboxDelete.addEventListener('click', function () { if (currentLightboxId) removeItem(currentLightboxId); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox(); });
  if (lightbox) lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('contextmenu', function (e) { if (e.target.closest('.masonry-item') || e.target.closest('.lightbox-content')) e.preventDefault(); });

  /* ========== 启动 ========== */
  openDB().then(function () { return loadAllItems(); }).then(function (items) { currentItems = items; renderGrid(); if (currentItems.length > 0 && dropHint) dropHint.style.display = 'none'; }).catch(function (err) { console.error('作品库加载失败:', err); renderGrid(); });
})();
