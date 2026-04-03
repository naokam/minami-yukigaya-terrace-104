/* ========================================
   南雪谷テラス１０４ - Main Script
   ======================================== */

(function () {
  'use strict';

  // ── DOM References ──
  const hamburger = document.getElementById('hamburger');
  const headerNav = document.getElementById('headerNav');
  const headerLogo = document.querySelector('.header-logo');
  const galleryGrid = document.getElementById('galleryGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxCounter = document.getElementById('lightboxCounter');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');

  // Settings DOM
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsClose = document.getElementById('settingsClose');
  const settingsTabs = document.querySelectorAll('.settings-tab');
  const settingsContents = document.querySelectorAll('.settings-content');
  const themeOptions = document.querySelectorAll('.theme-option');

  // ── State ──
  const BATCH_SIZE = 12;
  let visibleCount = BATCH_SIZE;
  let currentFilter = 'all';
  let lightboxImages = [];
  let lightboxCaptions = [];
  let lightboxIndex = 0;
  let touchStartX = 0;

  // ========================================
  // Shared Settings (site-settings.json)
  // ========================================
  // Load shared settings from site-settings.json on startup.
  // These are applied BEFORE localStorage, so shared settings
  // become the baseline for all users.
  let sharedSettingsLoaded = false;

  async function loadSharedSettings() {
    try {
      const res = await fetch('site-settings.json?v=' + Date.now());
      if (!res.ok) return;
      const s = await res.json();

      // Apply shared settings to localStorage only if user hasn't overridden locally
      // Use a version stamp to detect if shared settings have been updated
      const localVer = localStorage.getItem('sharedSettingsVersion') || '';
      const remoteVer = s._version || '';
      const isNewer = remoteVer !== localVer;

      if (isNewer) {
        // Merge shared settings into localStorage
        if (s.theme !== undefined) localStorage.setItem('theme', s.theme);
        if (s.themeChosen !== undefined) localStorage.setItem('themeChosen', s.themeChosen);
        if (s.excludedPhotos) localStorage.setItem('excludedPhotos', JSON.stringify(s.excludedPhotos));
        if (s.captions) localStorage.setItem('captions', JSON.stringify(s.captions));
        if (s.propertyInfo) localStorage.setItem('propertyInfo', JSON.stringify(s.propertyInfo));
        if (s.heroImage !== undefined) localStorage.setItem('heroImage', s.heroImage);
        if (s.copyOverrides) localStorage.setItem('copyOverrides', JSON.stringify(s.copyOverrides));
        localStorage.setItem('sharedSettingsVersion', remoteVer);
      }
      sharedSettingsLoaded = true;
    } catch (e) {
      // site-settings.json not found or invalid — use localStorage as-is
    }
  }

  function buildSettingsJSON() {
    return {
      _version: new Date().toISOString(),
      theme: localStorage.getItem('theme') || 'default',
      themeChosen: localStorage.getItem('themeChosen') || 'false',
      excludedPhotos: JSON.parse(localStorage.getItem('excludedPhotos') || '[]'),
      captions: JSON.parse(localStorage.getItem('captions') || '{}'),
      propertyInfo: JSON.parse(localStorage.getItem('propertyInfo') || '{}'),
      heroImage: localStorage.getItem('heroImage') || '',
      copyOverrides: JSON.parse(localStorage.getItem('copyOverrides') || '{}')
    };
  }

  // Download as file (fallback)
  function exportSettings() {
    const blob = new Blob([JSON.stringify(buildSettingsJSON(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Publish to GitHub via API
  const REPO_OWNER = 'naokam';
  const REPO_NAME = 'minami-yukigaya-terrace-104';
  const SETTINGS_PATH = 'site-settings.json';
  const statusEl = document.getElementById('publishStatus');
  const ghTokenInput = document.getElementById('ghToken');

  // Load saved token
  ghTokenInput.value = localStorage.getItem('ghToken') || '';
  ghTokenInput.addEventListener('change', () => {
    localStorage.setItem('ghToken', ghTokenInput.value);
  });

  async function publishSettings() {
    const token = ghTokenInput.value.trim();
    if (!token) {
      statusEl.textContent = 'GitHubトークンを入力してください。';
      statusEl.style.color = '#c0392b';
      return;
    }
    localStorage.setItem('ghToken', token);

    statusEl.textContent = '公開中...';
    statusEl.style.color = '#888';

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(buildSettingsJSON(), null, 2))));
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SETTINGS_PATH}`;

    try {
      // Get current file SHA (needed for update)
      let sha = null;
      try {
        const getRes = await fetch(apiUrl, {
          headers: { 'Authorization': `token ${token}` }
        });
        if (getRes.ok) {
          const data = await getRes.json();
          sha = data.sha;
        }
      } catch (_) {}

      // Create or update file
      const body = {
        message: '設定を更新',
        content: content
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (putRes.ok) {
        statusEl.innerHTML = '公開完了（反映まで1〜2分かかります）';
        statusEl.style.color = '#2e7d32';
      } else {
        const err = await putRes.json();
        statusEl.textContent = 'エラー: ' + (err.message || putRes.status);
        statusEl.style.color = '#c0392b';
      }
    } catch (e) {
      statusEl.textContent = '通信エラー: ' + e.message;
      statusEl.style.color = '#c0392b';
    }
  }

  document.getElementById('exportSettingsBtn').addEventListener('click', exportSettings);
  document.getElementById('publishSettingsBtn').addEventListener('click', publishSettings);

  // ========================================
  // Hidden Mode — Logo 5-click
  // ========================================
  let logoClickCount = 0;
  let logoClickTimer = null;

  headerLogo.addEventListener('click', (e) => {
    e.preventDefault();
    logoClickCount++;
    clearTimeout(logoClickTimer);
    logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500);
    if (logoClickCount >= 5) {
      logoClickCount = 0;
      promptPassword();
    }
  });

  // ========================================
  // Settings Panel
  // ========================================
  function promptPassword() {
    const pw = prompt('パスワードを入力してください');
    if (pw === 'okamoto2026') {
      openSettings();
    }
  }

  let savedScrollY = 0;

  function openSettings() {
    savedScrollY = window.scrollY;
    settingsOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
    buildInfoFields();
    buildCaptionFields();
    buildPhotoToggles();
    buildHeroImagePicker();
  }

  function closeSettings() {
    settingsOverlay.classList.remove('active');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, savedScrollY);
    // Refresh gallery to reflect any changes made in settings
    applyExcludedPhotos();
    applySavedCaptions();
    updateGallery();
  }

  settingsClose.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  // Tabs
  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      settingsTabs.forEach(t => t.classList.remove('active'));
      settingsContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.settings-content[data-content="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // Escape to close settings
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsOverlay.classList.contains('active')) {
      closeSettings();
    }
  });

  // ========================================
  // Settings: Theme + Copy Variations
  // ========================================
  const themeCopy = {
    default: {
      title: '南雪谷テラス１０４',
      subtitle: '完全自由設計のコーポラティブハウス',
      lead: 'ロンドン王立芸術大学院で学んだオーナーが<br>間取りから素材まで一からデザインした住空間'
    },
    warm: {
      title: '南雪谷テラス 104',
      subtitle: '暮らしに、ぬくもりと美意識を。',
      lead: '閑静な低層住宅街に佇む、オーナーの感性が息づくメゾネット。<br>挽板の床、塗り壁、特注ブラインド——素材のひとつひとつに物語があります。'
    },
    mono: {
      title: 'MINAMI-YUKIGAYA<br>TERRACE 104',
      subtitle: 'DESIGNER\'S MAISONETTE — 80\u33A1 / 3LDK',
      lead: ''
    },
    green: {
      title: '南雪谷テラス',
      subtitle: '光と緑に守られた、穏やかな住まい',
      lead: '南向きの大窓から注ぐ陽光。プライベートテラスに揺れる緑。<br>第一種低層住居専用地域の静けさが、日常をやさしく包みます。'
    },
    luxury: {
      title: '南雪谷テラス１０４',
      subtitle: '唯一無二の、住空間',
      lead: 'Royal College of Art で研鑽を積んだオーナーが<br>空間・素材・光のすべてを設計した邸宅'
    },
    japanese: {
      title: '南雪谷テラス　一〇四',
      subtitle: '設えに、想いを宿す',
      lead: '塗り壁、挽板、特注建具——<br>素材と向き合い、暮らしの景色を整えた住まい。'
    },
    nordic: {
      title: '南雪谷テラス 104',
      subtitle: 'A calm place to call home.',
      lead: '穏やかな陽ざしと、心地よい静けさ。<br>南雪谷の低層住宅街に佇むデザイナーズメゾネット。'
    }
  };

  const heroTitle = document.querySelector('.hero-title');
  const heroSubtitle = document.querySelector('.hero-subtitle');
  const heroLead = document.querySelector('.hero-lead');

  const ALL_THEMES = ['default', 'warm', 'mono', 'green', 'luxury', 'japanese', 'nordic'];
  const themeChosen = localStorage.getItem('themeChosen') === 'true';
  let savedTheme;
  if (themeChosen) {
    savedTheme = localStorage.getItem('theme') || 'default';
  } else {
    // Sequential rotation: advance index each reload
    const prevIndex = parseInt(localStorage.getItem('themeRotation') || '-1', 10);
    const nextIndex = (prevIndex + 1) % ALL_THEMES.length;
    localStorage.setItem('themeRotation', String(nextIndex));
    savedTheme = ALL_THEMES[nextIndex];
  }
  applyTheme(savedTheme, false);
  // If in auto-rotation mode, highlight the auto button
  if (!themeChosen) {
    themeOptions.forEach(opt => opt.classList.remove('active'));
    const autoBtn = document.querySelector('.theme-option[data-theme="auto"]');
    if (autoBtn) autoBtn.classList.add('active');
  }

  function applyTheme(theme, userChosen) {
    if (theme === 'default') {
      document.body.removeAttribute('data-theme');
    } else {
      document.body.setAttribute('data-theme', theme);
    }
    themeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === theme);
    });
    localStorage.setItem('theme', theme);
    if (userChosen) {
      localStorage.setItem('themeChosen', 'true');
    }

    // Swap hero copy — use saved overrides if they exist
    const baseCopy = themeCopy[theme] || themeCopy.default;
    const overrides = JSON.parse(localStorage.getItem('copyOverrides') || '{}');
    const ov = overrides[theme] || {};
    const title = ov.title !== undefined ? ov.title : baseCopy.title;
    const subtitle = ov.subtitle !== undefined ? ov.subtitle : baseCopy.subtitle;
    const lead = ov.lead !== undefined ? ov.lead : baseCopy.lead;
    heroTitle.innerHTML = title;
    heroSubtitle.innerHTML = subtitle;
    heroLead.innerHTML = lead;
    heroLead.style.display = lead ? '' : 'none';

    // Populate copy editor fields with current theme values
    const copyTitleEl = document.getElementById('copyTitle');
    const copySubtitleEl = document.getElementById('copySubtitle');
    const copyLeadEl = document.getElementById('copyLead');
    if (copyTitleEl) copyTitleEl.value = title.replace(/<br\s*\/?>/gi, '\n');
    if (copySubtitleEl) copySubtitleEl.value = subtitle.replace(/<br\s*\/?>/gi, '\n');
    if (copyLeadEl) copyLeadEl.value = lead.replace(/<br\s*\/?>/gi, '\n');
  }

  // Current theme key for copy editing
  function getCurrentThemeKey() {
    return localStorage.getItem('theme') || 'default';
  }

  themeOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      if (opt.dataset.theme === 'auto') {
        localStorage.removeItem('themeChosen');
        const idx = parseInt(localStorage.getItem('themeRotation') || '0', 10);
        applyTheme(ALL_THEMES[idx % ALL_THEMES.length], false);
        themeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      } else {
        applyTheme(opt.dataset.theme, true);
      }
      autoPublishIfTokenSet();
    });
  });

  // ========================================
  // Settings: Property Info Editing
  // ========================================
  function buildInfoFields() {
    const container = document.getElementById('infoFields');
    container.innerHTML = '';
    const editableCells = document.querySelectorAll('td[data-field]');
    const savedInfo = JSON.parse(localStorage.getItem('propertyInfo') || '{}');

    editableCells.forEach(cell => {
      const field = cell.dataset.field;
      const div = document.createElement('div');
      div.className = 'settings-field';
      const label = document.createElement('label');
      label.textContent = field;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = savedInfo[field] || cell.textContent;
      input.dataset.field = field;
      div.appendChild(label);
      div.appendChild(input);
      container.appendChild(div);
    });
  }

  document.getElementById('saveInfoBtn').addEventListener('click', () => {
    const inputs = document.querySelectorAll('#infoFields input');
    const savedInfo = {};
    inputs.forEach(input => {
      const field = input.dataset.field;
      savedInfo[field] = input.value;
      const cell = document.querySelector(`td[data-field="${field}"]`);
      if (cell) cell.textContent = input.value;
    });
    localStorage.setItem('propertyInfo', JSON.stringify(savedInfo));
    showSaveConfirm(document.getElementById('saveInfoBtn'));
  });

  // ========================================
  // Settings: Copy/Tagline Editing
  // ========================================
  document.getElementById('saveCopyBtn').addEventListener('click', () => {
    const theme = getCurrentThemeKey();
    const overrides = JSON.parse(localStorage.getItem('copyOverrides') || '{}');
    const titleVal = document.getElementById('copyTitle').value.replace(/\n/g, '<br>');
    const subtitleVal = document.getElementById('copySubtitle').value.replace(/\n/g, '<br>');
    const leadVal = document.getElementById('copyLead').value.replace(/\n/g, '<br>');
    overrides[theme] = { title: titleVal, subtitle: subtitleVal, lead: leadVal };
    localStorage.setItem('copyOverrides', JSON.stringify(overrides));
    // Apply immediately
    heroTitle.innerHTML = titleVal;
    heroSubtitle.innerHTML = subtitleVal;
    heroLead.innerHTML = leadVal;
    heroLead.style.display = leadVal ? '' : 'none';
    showSaveConfirm(document.getElementById('saveCopyBtn'));
  });

  // ========================================
  // Settings: Hero Image Picker
  // ========================================
  const heroImg = document.querySelector('.hero-img');

  function buildHeroImagePicker() {
    const picker = document.getElementById('heroImagePicker');
    if (!picker) return;
    picker.innerHTML = '';
    const savedHero = localStorage.getItem('heroImage') || '';

    getAllItems().forEach(item => {
      const img = item.querySelector('img');
      if (!img) return;
      const src = img.getAttribute('src');

      const div = document.createElement('div');
      div.className = 'photo-toggle-item' + (src === savedHero ? ' selected-hero' : '');

      const thumb = document.createElement('img');
      thumb.src = src;
      thumb.alt = '';
      thumb.loading = 'lazy';

      div.appendChild(thumb);

      div.addEventListener('click', () => {
        // Deselect all
        picker.querySelectorAll('.photo-toggle-item').forEach(el => el.classList.remove('selected-hero'));
        div.classList.add('selected-hero');
        // Apply immediately
        heroImg.src = src;
        localStorage.setItem('heroImage', src);
        autoPublishIfTokenSet();
      });

      picker.appendChild(div);
    });
  }

  // Load saved hero image on startup
  function loadSavedHeroImage() {
    const saved = localStorage.getItem('heroImage');
    if (saved && heroImg) {
      heroImg.src = saved;
    }
  }
  loadSavedHeroImage();

  // Load saved info on page load
  function loadSavedInfo() {
    const savedInfo = JSON.parse(localStorage.getItem('propertyInfo') || '{}');
    Object.entries(savedInfo).forEach(([field, value]) => {
      const cell = document.querySelector(`td[data-field="${field}"]`);
      if (cell && value) cell.textContent = value;
    });
  }
  loadSavedInfo();

  // ========================================
  // Settings: Caption Editing
  // ========================================
  function buildCaptionFields() {
    const container = document.getElementById('captionFields');
    container.innerHTML = '';
    const items = getAllItems();
    const savedCaptions = JSON.parse(localStorage.getItem('captions') || '{}');

    items.forEach((item, i) => {
      const img = item.querySelector('img');
      const caption = item.querySelector('.gallery-caption');
      if (!img || !caption) return;

      const src = img.getAttribute('src');
      const filename = src.split('/').pop();

      const div = document.createElement('div');
      div.className = 'caption-edit-item';

      const thumb = document.createElement('img');
      thumb.src = src;
      thumb.alt = '';
      thumb.loading = 'lazy';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = savedCaptions[filename] || caption.textContent;
      input.dataset.filename = filename;

      div.appendChild(thumb);
      div.appendChild(input);
      container.appendChild(div);
    });
  }

  document.getElementById('saveCaptionsBtn').addEventListener('click', () => {
    const inputs = document.querySelectorAll('#captionFields input');
    const savedCaptions = {};
    inputs.forEach(input => {
      savedCaptions[input.dataset.filename] = input.value;
    });
    localStorage.setItem('captions', JSON.stringify(savedCaptions));
    applySavedCaptions();
    showSaveConfirm(document.getElementById('saveCaptionsBtn'));
  });

  function applySavedCaptions() {
    const savedCaptions = JSON.parse(localStorage.getItem('captions') || '{}');
    getAllItems().forEach(item => {
      const img = item.querySelector('img');
      const caption = item.querySelector('.gallery-caption');
      if (!img || !caption) return;
      const filename = img.getAttribute('src').split('/').pop();
      if (savedCaptions[filename]) {
        caption.textContent = savedCaptions[filename];
      }
    });
  }
  applySavedCaptions();

  // Rebalance captions: ensure no duplicates within visible items of same category.
  // Only touches items whose captions haven't been manually saved.
  function rebalanceCaptions() {
    const savedCaptions = JSON.parse(localStorage.getItem('captions') || '{}');
    const visible = getFilteredItems();
    const usedByCategory = {};

    visible.forEach(item => {
      const img = item.querySelector('img');
      const caption = item.querySelector('.gallery-caption');
      if (!img || !caption) return;

      const filename = img.getAttribute('src').split('/').pop();
      const cat = item.dataset.category;

      // If user has manually saved this caption, or it's an original photo, keep it
      if (savedCaptions[filename]) return;
      if (!item.dataset.uploadedId) { usedByCategory[cat] = usedByCategory[cat] || new Set(); usedByCategory[cat].add(caption.textContent); return; }

      if (!usedByCategory[cat]) usedByCategory[cat] = new Set();
      const templates = CAPTION_TEMPLATES[cat] || ['追加写真'];

      // Find next unused caption template
      let chosen = templates[0];
      for (const t of templates) {
        if (!usedByCategory[cat].has(t)) {
          chosen = t;
          break;
        }
      }
      usedByCategory[cat].add(chosen);
      caption.textContent = chosen;
    });
  }

  // ========================================
  // Settings: Photo Selection
  // ========================================
  function buildPhotoToggles() {
    const container = document.getElementById('photoToggles');
    container.innerHTML = '';
    const items = getAllItems();
    const excluded = JSON.parse(localStorage.getItem('excludedPhotos') || '[]');

    const grid = document.createElement('div');
    grid.className = 'photo-toggle-grid';

    items.forEach(item => {
      const img = item.querySelector('img');
      const caption = item.querySelector('.gallery-caption');
      if (!img) return;

      const src = img.getAttribute('src');
      const filename = src.split('/').pop();
      const isExcluded = excluded.includes(filename);

      const div = document.createElement('div');
      div.className = 'photo-toggle-item' + (isExcluded ? ' disabled' : '');
      div.dataset.filename = filename;

      const thumb = document.createElement('img');
      thumb.src = src;
      thumb.alt = '';
      thumb.loading = 'lazy';

      const check = document.createElement('div');
      check.className = 'photo-toggle-check';
      check.textContent = '\u2713';

      const label = document.createElement('div');
      label.className = 'photo-toggle-label';
      label.textContent = caption ? caption.textContent : filename;

      div.appendChild(thumb);
      div.appendChild(check);
      div.appendChild(label);

      // Toggle visibility on click
      div.addEventListener('click', (e) => {
        if (e.target.closest('.photo-delete-btn')) return;
        div.classList.toggle('disabled');
      });

      // Delete button for uploaded photos
      const uploadedId = item.dataset.uploadedId;
      if (uploadedId) {
        const delBtn = document.createElement('button');
        delBtn.className = 'photo-delete-btn';
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('この写真を完全に削除しますか？')) return;
          try {
            await dbDelete(parseInt(uploadedId, 10));
          } catch (_) {}
          // Remove from gallery DOM
          item.remove();
          // Remove toggle from grid
          div.remove();
          updateGallery();
        });
        div.appendChild(delBtn);
      }

      grid.appendChild(div);
    });

    container.appendChild(grid);
  }

  document.getElementById('savePhotosBtn').addEventListener('click', () => {
    const toggles = document.querySelectorAll('.photo-toggle-item');
    const excluded = [];
    toggles.forEach(toggle => {
      if (toggle.classList.contains('disabled')) {
        excluded.push(toggle.dataset.filename);
      }
    });
    localStorage.setItem('excludedPhotos', JSON.stringify(excluded));
    applyExcludedPhotos();
    updateGallery();
    showSaveConfirm(document.getElementById('savePhotosBtn'));
  });

  function applyExcludedPhotos() {
    const excluded = JSON.parse(localStorage.getItem('excludedPhotos') || '[]');
    getAllItems().forEach(item => {
      const img = item.querySelector('img');
      if (!img) return;
      const filename = img.getAttribute('src').split('/').pop();
      item.classList.toggle('excluded', excluded.includes(filename));
    });
  }
  applyExcludedPhotos();

  // Save confirmation flash
  function showSaveConfirm(btn) {
    const original = btn.textContent;
    btn.textContent = '保存しました';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1500);

    // Auto-publish if GitHub token is configured
    autoPublishIfTokenSet();
  }

  function autoPublishIfTokenSet() {
    const token = localStorage.getItem('ghToken');
    if (token) {
      publishSettings();
    }
  }

  // ========================================
  // Photo Upload (IndexedDB persistence)
  // ========================================
  const DB_NAME = 'minamiyukigaya104';
  const DB_STORE = 'uploadedPhotos';
  let db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(DB_STORE)) {
          d.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e);
    });
  }

  function dbGetAll() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbAdd(photo) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.add(photo);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbDelete(id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  const CATEGORIES = ['リビング', 'キッチン', '寝室', '和室', '水回り', 'テラス', '外観'];
  const uploadArea = document.getElementById('uploadArea');
  const uploadInput = document.getElementById('uploadInput');
  const uploadPreview = document.getElementById('uploadPreview');
  let pendingUploads = []; // { file, dataUrl, category, caption }

  uploadArea.addEventListener('click', () => uploadInput.click());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  uploadInput.addEventListener('change', () => {
    handleFiles(uploadInput.files);
    uploadInput.value = '';
  });

  const CAPTION_TEMPLATES = {
    'リビング': ['吹き抜けリビング', 'リビングの眺め', 'リビング全景', 'くつろぎの空間', 'リビングの光'],
    'キッチン': ['対面キッチン', 'キッチン設備', 'キッチンからの眺め', '調理スペース'],
    '寝室': ['寝室の採光', '落ち着いた寝室', '寝室全景', 'ベッドルーム'],
    '和室': ['小上がり和室', '和室の設え', '畳の間', '和の空間'],
    '水回り': ['浴室', '洗面スペース', 'リフォーム済み水回り', 'バスルーム'],
    'テラス': ['プライベートテラス', 'テラスの緑', 'テラスからの眺め', '屋外空間'],
    '外観': ['建物外観', 'エントランス', 'マンション外観', '外観の佇まい']
  };

  function autoCaption(category) {
    const templates = CAPTION_TEMPLATES[category] || ['追加写真'];
    // Count existing items in this category (gallery + pending)
    const existingCount = getAllItems().filter(
      item => item.dataset.category === category
    ).length;
    const pendingCount = pendingUploads.filter(
      e => e.category === category
    ).length;
    const idx = (existingCount + pendingCount) % templates.length;
    return templates[idx];
  }

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const category = 'リビング';
        const entry = {
          dataUrl: e.target.result,
          category: category,
          caption: autoCaption(category),
          filename: file.name
        };
        pendingUploads.push(entry);
        renderUploadPreviews();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderUploadPreviews() {
    uploadPreview.innerHTML = '';
    pendingUploads.forEach((entry, i) => {
      const div = document.createElement('div');
      div.className = 'upload-preview-item';

      const img = document.createElement('img');
      img.src = entry.dataUrl;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'upload-remove';
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', () => {
        pendingUploads.splice(i, 1);
        renderUploadPreviews();
      });

      const catSelect = document.createElement('select');
      CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === entry.category) opt.selected = true;
        catSelect.appendChild(opt);
      });
      const capInput = document.createElement('input');
      capInput.type = 'text';
      capInput.placeholder = 'キャプション';
      capInput.value = entry.caption;
      capInput.addEventListener('input', () => { entry.caption = capInput.value; });

      catSelect.addEventListener('change', () => {
        entry.category = catSelect.value;
        // Auto-update caption unless user has manually edited it
        const newCap = autoCaption(entry.category);
        entry.caption = newCap;
        capInput.value = newCap;
      });

      div.appendChild(img);
      div.appendChild(removeBtn);
      div.appendChild(catSelect);
      div.appendChild(capInput);
      uploadPreview.appendChild(div);
    });

    // Show add button if there are pending uploads
    let addBtn = document.getElementById('uploadAddBtn');
    if (pendingUploads.length > 0) {
      if (!addBtn) {
        addBtn = document.createElement('button');
        addBtn.id = 'uploadAddBtn';
        addBtn.className = 'btn btn-primary';
        addBtn.style.marginTop = '12px';
        addBtn.textContent = 'ギャラリーに追加';
        addBtn.addEventListener('click', savePendingUploads);
        uploadPreview.parentElement.insertBefore(addBtn, uploadPreview.nextSibling);
      }
    } else if (addBtn) {
      addBtn.remove();
    }
  }

  async function savePendingUploads() {
    // Ensure DB is open
    if (!db) {
      try { await openDB(); } catch (_) {}
    }

    for (const entry of pendingUploads) {
      let id = null;
      // Try to persist to IndexedDB, but add to gallery regardless
      if (db) {
        try {
          id = await dbAdd({
            dataUrl: entry.dataUrl,
            category: entry.category,
            caption: entry.caption,
            filename: entry.filename
          });
        } catch (e) {
          console.warn('IndexedDB save failed:', e);
        }
      }
      addUploadedPhotoToGallery({
        id: id,
        dataUrl: entry.dataUrl,
        category: entry.category,
        caption: entry.caption,
        filename: entry.filename
      });
    }

    pendingUploads = [];
    uploadPreview.innerHTML = '';
    const addBtn = document.getElementById('uploadAddBtn');
    if (addBtn) addBtn.remove();

    // Show all photos including newly added
    applyExcludedPhotos();
    visibleCount = getFilteredItems().length;
    updateGallery();
    buildPhotoToggles();

    // Close settings and scroll to gallery
    settingsOverlay.classList.remove('active');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, savedScrollY);
    setTimeout(() => {
      document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  function addUploadedPhotoToGallery(photo) {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.dataset.category = photo.category;
    if (photo.id != null) {
      div.dataset.uploadedId = String(photo.id);
    }

    const img = document.createElement('img');
    img.src = photo.dataUrl;
    img.alt = photo.caption || '';
    img.loading = 'lazy';

    const caption = document.createElement('span');
    caption.className = 'gallery-caption';
    caption.textContent = photo.caption || '';

    div.appendChild(img);
    div.appendChild(caption);
    galleryGrid.appendChild(div);
  }

  // Load uploaded photos from IndexedDB on startup
  async function loadUploadedPhotos() {
    try {
      await openDB();
      const photos = await dbGetAll();
      if (photos && photos.length > 0) {
        photos.forEach(photo => addUploadedPhotoToGallery(photo));
      }
    } catch (e) {
      console.warn('IndexedDB load failed:', e);
    }
    // Always update gallery after attempting to load
    applyExcludedPhotos();
    applySavedCaptions();
    updateGallery();
  }

  // Startup: load shared settings first, then uploaded photos, then re-apply theme
  async function initApp() {
    await loadSharedSettings();

    // Re-apply theme after shared settings are loaded (may have changed localStorage)
    const currentTheme = localStorage.getItem('theme') || 'default';
    applyTheme(currentTheme, false);
    if (localStorage.getItem('themeChosen') !== 'true') {
      themeOptions.forEach(opt => opt.classList.remove('active'));
      const autoBtn = document.querySelector('.theme-option[data-theme="auto"]');
      if (autoBtn) autoBtn.classList.add('active');
    }

    // Re-apply property info & hero image from shared settings
    loadSavedInfo();
    loadSavedHeroImage();

    await loadUploadedPhotos();
  }
  initApp();

  // ========================================
  // Hamburger Menu
  // ========================================
  hamburger.addEventListener('click', () => {
    const isOpen = headerNav.classList.toggle('open');
    hamburger.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  headerNav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      headerNav.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  // ========================================
  // Gallery: Load More & Filter
  // ========================================
  function getAllItems() {
    return Array.from(galleryGrid.querySelectorAll('.gallery-item'));
  }

  function getFilteredItems() {
    const all = getAllItems();
    return all.filter(item => {
      if (item.classList.contains('excluded')) return false;
      if (currentFilter === 'all') return true;
      return item.dataset.category === currentFilter;
    });
  }

  function updateGallery() {
    const filtered = getFilteredItems();

    // Hide all first
    getAllItems().forEach(item => item.classList.add('hidden'));

    // Show filtered items up to visibleCount
    filtered.forEach((item, i) => {
      if (i < visibleCount) {
        item.classList.remove('hidden');
      }
    });

    // Rebalance layout and captions on visible items
    rebalanceLayout(filtered.slice(0, Math.min(visibleCount, filtered.length)));
    rebalanceCaptions();

    // Toggle load more button
    if (visibleCount >= filtered.length) {
      loadMoreBtn.classList.add('hidden');
    } else {
      loadMoreBtn.classList.remove('hidden');
    }
  }

  // Dynamically assign gallery-item--wide to maintain layout rhythm.
  // Rules: 1st visible item is wide, then every 5th item, and the first
  // item of each new category group gets wide.
  function rebalanceLayout(visibleItems) {
    const seenCategories = new Set();

    visibleItems.forEach((item, i) => {
      item.classList.remove('gallery-item--wide');
      const cat = item.dataset.category;
      const isFirstOfCategory = !seenCategories.has(cat);
      if (isFirstOfCategory) seenCategories.add(cat);

      // Assign wide: first item, first of each category, or every 6th
      if (i === 0 || isFirstOfCategory || (i > 0 && i % 6 === 0)) {
        item.classList.add('gallery-item--wide');
      }
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      visibleCount = BATCH_SIZE;
      updateGallery();
    });
  });

  loadMoreBtn.addEventListener('click', () => {
    visibleCount += BATCH_SIZE;
    updateGallery();
  });

  // Initial render — loadUploadedPhotos() will call updateGallery() when ready.
  // Render immediately for fast initial paint; loadUploadedPhotos will re-render.
  updateGallery();

  // ========================================
  // Lightbox
  // ========================================
  function getVisibleItems() {
    return Array.from(
      galleryGrid.querySelectorAll('.gallery-item:not(.hidden):not(.excluded)')
    );
  }

  function getVisibleImages() {
    return getVisibleItems().map(item => item.querySelector('img'));
  }

  function getVisibleCaptions() {
    return getVisibleItems().map(item => {
      const cap = item.querySelector('.gallery-caption');
      return cap ? cap.textContent : '';
    });
  }

  let lightboxSavedScrollY = 0;

  function openLightbox(index) {
    lightboxImages = getVisibleImages();
    lightboxCaptions = getVisibleCaptions();
    if (index < 0 || index >= lightboxImages.length) return;
    lightboxIndex = index;
    showLightboxImage();
    lightboxSavedScrollY = window.scrollY;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lightboxSavedScrollY}px`;
    document.body.style.width = '100%';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, lightboxSavedScrollY);
  }

  function showLightboxImage() {
    const img = lightboxImages[lightboxIndex];
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = lightboxCaptions[lightboxIndex] || '';
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    preloadImage(lightboxIndex - 1);
    preloadImage(lightboxIndex + 1);
  }

  function preloadImage(index) {
    if (index >= 0 && index < lightboxImages.length) {
      const img = new Image();
      img.src = lightboxImages[index].src;
    }
  }

  function nextImage() {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    showLightboxImage();
  }

  function prevImage() {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    showLightboxImage();
  }

  galleryGrid.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (!item || item.classList.contains('hidden') || item.classList.contains('excluded')) return;
    const visibleImgs = getVisibleImages();
    const img = item.querySelector('img');
    const index = visibleImgs.indexOf(img);
    if (index !== -1) openLightbox(index);
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', prevImage);
  lightboxNext.addEventListener('click', nextImage);

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-img-wrap')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (settingsOverlay.classList.contains('active')) return;
    if (!lightbox.classList.contains('active')) return;
    switch (e.key) {
      case 'Escape': closeLightbox(); break;
      case 'ArrowLeft': prevImage(); break;
      case 'ArrowRight': nextImage(); break;
    }
  });

  lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lightbox.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextImage() : prevImage();
    }
  }, { passive: true });

  // ========================================
  // Hero Slideshow — rotate through category representative photos
  // ========================================
  const heroSlideImg = document.getElementById('heroSlideImg');
  const heroSlidePhotos = [
    '南雪谷テラス１０４紹介写真/DSC01724.jpeg',  // リビング
    '南雪谷テラス１０４紹介写真/IMG_2150.jpeg',  // 外観
    '南雪谷テラス１０４紹介写真/DSC01810.jpeg',  // キッチン
    '南雪谷テラス１０４紹介写真/DSC01774.jpeg',  // 寝室
    '南雪谷テラス１０４紹介写真/DSC01885.jpeg',  // 和室
    '南雪谷テラス１０４紹介写真/DSC01827.jpeg',  // 水回り
    '南雪谷テラス１０４紹介写真/IMG_9182.jpeg',  // テラス
  ];
  let heroSlideIndex = 0;

  // Respect user-selected hero image
  function isHeroUserSelected() {
    return !!localStorage.getItem('heroImage');
  }

  if (!isHeroUserSelected() && heroSlideImg) {
    setInterval(() => {
      if (isHeroUserSelected()) return;
      heroSlideIndex = (heroSlideIndex + 1) % heroSlidePhotos.length;
      heroSlideImg.classList.add('fade');
      setTimeout(() => {
        heroSlideImg.src = heroSlidePhotos[heroSlideIndex];
        heroSlideImg.classList.remove('fade');
      }, 800);
    }, 5000);
  }

  // ========================================
  // Category Showcase — click to jump + filter gallery
  // ========================================
  document.querySelectorAll('.showcase-item[data-cat]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = item.dataset.cat;
      // Activate matching filter button
      filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === cat);
      });
      currentFilter = cat;
      visibleCount = BATCH_SIZE;
      updateGallery();
      // Scroll to gallery
      document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ========================================
  // Smooth Scroll
  // ========================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return; // logo link, handled separately
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ========================================
  // Contact Form Validation
  // ========================================
  function validateField(input, errorEl, message) {
    if (!input.validity.valid) {
      input.classList.add('invalid');
      errorEl.textContent = message;
      return false;
    }
    input.classList.remove('invalid');
    errorEl.textContent = '';
    return true;
  }

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name');
    const email = document.getElementById('email');
    const phone = document.getElementById('phone');
    const message = document.getElementById('message');
    let valid = true;

    if (!validateField(name, document.getElementById('nameError'), 'お名前を入力してください。')) valid = false;
    if (!validateField(email, document.getElementById('emailError'), '正しいメールアドレスを入力してください。')) valid = false;
    if (phone.value && !/^[\d\-+() ]*$/.test(phone.value)) {
      phone.classList.add('invalid');
      document.getElementById('phoneError').textContent = '正しい電話番号を入力してください。';
      valid = false;
    } else {
      phone.classList.remove('invalid');
      document.getElementById('phoneError').textContent = '';
    }
    if (!validateField(message, document.getElementById('messageError'), 'お問い合わせ内容を入力してください。')) valid = false;

    if (valid) {
      contactForm.style.display = 'none';
      formSuccess.classList.add('show');
    }
  });

  contactForm.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('input', () => {
      if (input.classList.contains('invalid')) {
        input.classList.remove('invalid');
        const errorEl = input.parentElement.querySelector('.error-msg');
        if (errorEl) errorEl.textContent = '';
      }
    });
  });

})();
