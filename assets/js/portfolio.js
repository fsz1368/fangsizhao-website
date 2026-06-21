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
  var currentSort = 'newest';
  var uploadProgress = document.getElementById('uploadProgress');
  var uploadProgressText = document.getElementById('uploadProgressText');
  var sortSelect = document.getElementById('sortSelect');

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

  /* ========== 分类推断 ========== */
  function inferCategory(file) {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    return 'all';
  }

  /* ========== 排序 ========== */
  function getSortedItems() {
    var all = currentFilter === 'all' ? currentItems.slice() : currentItems.filter(function (it) { return it.category === currentFilter; });
    switch (currentSort) {
      case 'oldest': all.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }); break;
      case 'name': all.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }); break;
      case 'size': all.sort(function (a, b) { return (b.size || 0) - (a.size || 0); }); break;
      default: /* newest */ all.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    }
    return all;
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', function () { currentSort = this.value; renderGrid(); });
  }

  /* ========== 文件处理 ========== */
  function processFiles(files) {
    if (!files.length) return;
    if (uploadProgress) { uploadProgress.style.display = ''; if (uploadProgressText) uploadProgressText.textContent = '处理 0/' + files.length; }

    var total = files.length, done = 0;
    var MAX_SIZE = 200 * 1024 * 1024; // 200MB 上限
    var promises = files.map(function (file) {
      var isVideo = file.type.startsWith('video/');
      var cat = inferCategory(file);

      if (file.size > MAX_SIZE) {
        alert('文件 "' + file.name + '" 超过 200MB 上限，已跳过');
        return null;
      }

      if (isVideo) {
        return generateVideoThumb(file).then(function (result) {
          // 视频：存储 Blob（非 Base64）+ 缩略图 JPEG
          var id = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          return {
            id: id, type: 'video', category: cat,
            name: file.name.replace(/\.[^.]+$/, ''),
            desc: '',
            mime: file.type, blob: file,
            thumb: result.thumb, thumbW: result.width, thumbH: result.height,
            size: file.size, createdAt: Date.now()
          };
        });
      } else {
        return readImageFile(file).then(function (result) {
          var id = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          return {
            id: id, type: 'image', category: cat,
            name: file.name.replace(/\.[^.]+$/, ''),
            desc: '',
            mime: file.type, blob: file,
            thumb: result.thumb, thumbW: result.width, thumbH: result.height,
            size: file.size, createdAt: Date.now()
          };
        });
      }
    }).filter(function (p) { return p !== null; });

    Promise.all(promises).then(function (items) {
      if (uploadProgressText) uploadProgressText.textContent = '保存...';
      var chain = Promise.resolve();
      var saved = 0;
      items.forEach(function (item) {
        chain = chain.then(function () {
          return saveItem(item).then(function () {
            saved++;
            if (uploadProgressText) uploadProgressText.textContent = '已保存 ' + saved + '/' + total;
          });
        });
      });
      return chain.then(function () {
        currentItems = items.concat(currentItems);
        renderGrid();
        if (dropHint) dropHint.style.display = 'none';
        if (uploadProgress) uploadProgress.style.display = 'none';
      });
    }).catch(function (err) {
      console.error('文件处理失败:', err);
      if (uploadProgress) uploadProgress.style.display = 'none';
    });
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
    var filtered = getSortedItems();
    masonryGrid.innerHTML = '';

    if (filtered.length === 0) {
      var empty = document.createElement('div'); empty.className = 'masonry-empty';
      empty.innerHTML = '<i class="bi bi-images"></i><p>还没有作品，拖拽视频或图片进来吧</p>';
      masonryGrid.appendChild(empty); return;
    }

    filtered.forEach(function (item, index) {
      var el = document.createElement('div'); el.className = 'masonry-item';
      el.setAttribute('draggable', 'true'); el.dataset.id = item.id; el.dataset.index = index;

      // 缩略图：优先用预生成的 JPEG，无则用 Blob URL
      var thumbSrc = item.thumb || (item.blob ? URL.createObjectURL(item.blob) : '');
      // 缓存已创建的 blob URL 避免重复创建
      if (!item.thumb && item.blob) item._blobUrl = thumbSrc;

      var img = document.createElement('img'); img.src = thumbSrc;
      img.alt = item.name; img.setAttribute('loading', 'lazy');
      if (item.thumbW && item.thumbH) img.style.aspectRatio = item.thumbW + '/' + item.thumbH;
      el.appendChild(img);

      if (item.type === 'video') { var ply = document.createElement('div'); ply.className = 'play-overlay-mini'; ply.innerHTML = '<div class="play-btn-mini"><i class="bi bi-play-fill"></i></div>'; el.appendChild(ply); }

      var del = document.createElement('button'); del.className = 'delete-btn'; del.title = '删除';
      del.dataset.delete = item.id; del.innerHTML = '<i class="bi bi-x-lg"></i>';
      del.addEventListener('click', function (e) { e.stopPropagation(); removeItem(this.dataset.delete); });
      el.appendChild(del);

      var badge = document.createElement('span'); badge.className = 'type-badge';
      badge.textContent = item.type === 'video' ? '视频' : '图片'; el.appendChild(badge);

      var info = document.createElement('div'); info.className = 'item-info';
      var catLabel = item.category === 'video' ? '短视频' : item.category === 'image' ? '图片' : '航测';
      var cat = document.createElement('span'); cat.className = 'item-cat ' + item.category; cat.textContent = catLabel; info.appendChild(cat);
      var title = document.createElement('div'); title.className = 'item-title'; title.textContent = item.name; info.appendChild(title);
      if (item.desc) { var desc = document.createElement('div'); desc.className = 'item-desc'; desc.textContent = item.desc; info.appendChild(desc); }
      el.appendChild(info);

      el.addEventListener('click', function () { if (!el.classList.contains('dragging')) openLightbox(item.id); });
      masonryGrid.appendChild(el);
    });

    bindDragSort(masonryGrid.querySelectorAll('.masonry-item'));
  }

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

  function saveOrder() {
    if (!db) return;
    var now = Date.now();
    var tx = db.transaction(STORE_NAME, 'readwrite');
    var store = tx.objectStore(STORE_NAME);
    for (var i = 0; i < currentItems.length; i++) {
      currentItems[i].sortOrder = i;
      currentItems[i].updatedAt = now - i;
      store.put(currentItems[i]);
    }
    return new Promise(function (resolve, reject) { tx.oncomplete = resolve; tx.onerror = function (e) { reject(e.target.error); }; });
  }

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
    var src = item._blobUrl || (item.blob ? URL.createObjectURL(item.blob) : '');
    if (!item._blobUrl && item.blob) item._blobUrl = src;

    if (item.type === 'video') {
      var v = document.createElement('video'); v.src = src; v.controls = true; v.autoplay = true; v.playsInline = true;
      v.setAttribute('controlsList', 'nodownload'); v.style.maxWidth = '90vw'; v.style.maxHeight = '90vh'; v.style.borderRadius = '8px';
      lightboxContent.appendChild(v);
    } else {
      var img = document.createElement('img'); img.src = src; img.alt = item.name; img.setAttribute('draggable', 'false');
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
  // 仅阻止作品媒体元素的右键菜单，不影响页面其他区域
  document.addEventListener('contextmenu', function (e) { var el = e.target.closest('.masonry-item img, .masonry-item video, .lightbox-content img, .lightbox-content video'); if (el) e.preventDefault(); });

  /* ========== 启动 ========== */
  openDB().then(function () { return loadAllItems(); }).then(function (items) {
    // 为从 IndexedDB 恢复的 Blob 创建临时 URL
    items.forEach(function (item) {
      if (item.blob && !item._blobUrl) item._blobUrl = URL.createObjectURL(item.blob);
    });
    currentItems = items; renderGrid();
    if (currentItems.length > 0 && dropHint) dropHint.style.display = 'none';
  }).catch(function (err) { console.error('作品库加载失败:', err); renderGrid(); });
})();
