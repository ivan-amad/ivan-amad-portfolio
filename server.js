/**
 * Ivan Amad Portfolio — Backend Server
 * Node.js + Express
 */

const express  = require('express');
const multer   = require('multer');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Paths ───────────────────────────────────────────────────────────────────
const PUBLIC_DIR  = path.join(__dirname, 'public');
const ADMIN_DIR   = path.join(__dirname, 'admin');
const UPLOAD_DIR  = path.join(PUBLIC_DIR, 'images');
const DATA_DIR    = path.join(__dirname, 'data');
const GALLERY_FILE  = path.join(DATA_DIR, 'gallery.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

[DATA_DIR, UPLOAD_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ivan-portfolio-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ─── Multer ───────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 30 * 1024 * 1024 }
});

// ─── Data helpers ─────────────────────────────────────────────────────────────
// Dynamic category check — reads gallery.json keys so new chapters always work
function isValidCategory(cat) {
  if (!cat || typeof cat !== 'string') return false;
  const g = readGallery();
  return Object.prototype.hasOwnProperty.call(g, cat);
}

function defaultGallery() {
  const defaultKeys = ['concept-art', 'storyboards', 'branding', 'logos', 'pixel-art', 'booth', 'social'];
  const out = {};
  defaultKeys.forEach(c => {
    out[c] = { cover: null, strips: [], mosaic: [null, null, null], gallery: [] };
  });
  return out;
}

function readGallery() {
  if (!fs.existsSync(GALLERY_FILE)) {
    const d = defaultGallery();
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(d, null, 2));
    return d;
  }
  return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf-8'));
}

function saveGallery(data) {
  fs.writeFileSync(GALLERY_FILE, JSON.stringify(data, null, 2));
}

function readSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const d = { siteProtected: false, sitePassword: '' };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(d, null, 2));
    return d;
  }
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
}

function saveSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session.adminAuthed) return next();
  res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function siteGate(req, res, next) {
  const settings = readSettings();
  if (!settings.siteProtected) return next();
  if (req.session.adminAuthed || req.session.siteAuthed) return next();
  if (req.path === '/enter' || req.path === '/api/site-login') return next();
  if (req.accepts('html')) return res.redirect('/enter');
  res.status(401).json({ error: 'Site is password protected' });
}

// ─── Static files ─────────────────────────────────────────────────────────────
app.use('/images', express.static(UPLOAD_DIR));
app.use('/admin', express.static(ADMIN_DIR));
app.use('/sounds', express.static(path.join(PUBLIC_DIR, 'sounds')));
app.use('/videos', express.static(path.join(PUBLIC_DIR, 'videos')));

// ─── Site password gate ───────────────────────────────────────────────────────
app.get('/enter', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'enter.html'));
});

app.post('/api/site-login', (req, res) => {
  const settings = readSettings();
  if (!settings.siteProtected || req.body.password === settings.sitePassword) {
    req.session.siteAuthed = true;
    res.json({ ok: true });
  } else {
    res.json({ ok: false, error: 'Wrong password' });
  }
});

app.get('/', siteGate, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ─── Admin Auth ───────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({ ok: false, error: 'Admin password not set. Run: node setup.js' });
  }
  try {
    const match = await bcrypt.compare(req.body.password || '', hash);
    if (match) {
      req.session.adminAuthed = true;
      req.session.siteAuthed  = true;
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false, error: 'Wrong password' });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.adminAuthed = false;
  res.json({ ok: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ authed: !!req.session.adminAuthed });
});

// ─── Gallery API (public) ─────────────────────────────────────────────────────
app.get('/api/gallery', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.json(readGallery());
});

// ─── Admin: Upload image ──────────────────────────────────────────────────────
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file received' });

    const { category, slot, index, label } = req.body;
    if (!isValidCategory(category)) {
      return res.status(400).json({ ok: false, error: 'Invalid category: ' + category });
    }

    const ext      = path.extname(req.file.originalname).toLowerCase();
    const filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const destDir  = path.join(UPLOAD_DIR, category);
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, filename), req.file.buffer);

    const filePath = `/images/${category}/${filename}`;
    const data = readGallery();
    if (!data[category]) {
      data[category] = { cover: null, strips: [], mosaic: [null, null, null], gallery: [] };
    }

    const cat = data[category];

    switch (slot) {
      case 'cover':
        if (cat.cover) {
          const old = path.join(PUBLIC_DIR, cat.cover);
          if (fs.existsSync(old)) fs.unlinkSync(old);
        }
        cat.cover = filePath;
        break;

      case 'strip':
        cat.strips.push(filePath);
        break;

      case 'mosaic': {
        const idx = parseInt(index, 10);
        if (isNaN(idx) || idx < 0 || idx > 2) {
          return res.status(400).json({ ok: false, error: 'Mosaic index must be 0–2' });
        }
        if (cat.mosaic[idx]) {
          const old = path.join(PUBLIC_DIR, cat.mosaic[idx]);
          if (fs.existsSync(old)) fs.unlinkSync(old);
        }
        cat.mosaic[idx] = filePath;
        break;
      }

      case 'gallery':
        cat.gallery.push({
          id: String(cat.gallery.length + 1).padStart(2, '0'),
          src: filePath,
          label: label || `${category} ${cat.gallery.length + 1}`
        });
        break;

      default:
        return res.status(400).json({ ok: false, error: 'Invalid slot. Use: cover|strip|mosaic|gallery' });
    }

    saveGallery(data);
    res.json({ ok: true, path: filePath, category: data[category] });
  });
});

// ─── Admin: Delete image ──────────────────────────────────────────────────────
app.delete('/api/admin/image', requireAdmin, (req, res) => {
  const { category, slot, index } = req.body;
  if (!isValidCategory(category)) {
    return res.status(400).json({ ok: false, error: 'Invalid category' });
  }

  const data = readGallery();
  const cat  = data[category];
  if (!cat) return res.status(404).json({ ok: false, error: 'Category not found' });

  let src = null;

  switch (slot) {
    case 'cover':
      src = cat.cover;
      cat.cover = null;
      break;
    case 'strip': {
      const idx = parseInt(index, 10);
      src = cat.strips[idx];
      cat.strips.splice(idx, 1);
      break;
    }
    case 'mosaic': {
      const idx = parseInt(index, 10);
      src = cat.mosaic[idx];
      cat.mosaic[idx] = null;
      break;
    }
    case 'gallery': {
      const idx = parseInt(index, 10);
      src = cat.gallery[idx]?.src;
      cat.gallery.splice(idx, 1);
      cat.gallery.forEach((item, i) => { item.id = String(i + 1).padStart(2, '0'); });
      break;
    }
    default:
      return res.status(400).json({ ok: false, error: 'Invalid slot' });
  }

  if (src) {
    const filePath = path.join(PUBLIC_DIR, src);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch(e) { /* ignore */ }
    }
  }

  saveGallery(data);
  res.json({ ok: true, category: data[category] });
});

// ─── Admin: Update gallery item label ─────────────────────────────────────────
app.patch('/api/admin/gallery-label', requireAdmin, (req, res) => {
  const { category, index, label } = req.body;
  if (!isValidCategory(category)) {
    return res.status(400).json({ ok: false, error: 'Invalid category' });
  }
  const data = readGallery();
  const cat  = data[category];
  if (!cat || !cat.gallery[index]) {
    return res.status(404).json({ ok: false, error: 'Item not found' });
  }
  cat.gallery[index].label = String(label).slice(0, 100);
  saveGallery(data);
  res.json({ ok: true, category: data[category] });
});

// ─── Admin: Reorder gallery item ──────────────────────────────────────────────
app.post('/api/admin/reorder', requireAdmin, (req, res) => {
  const { category, fromIndex, toIndex } = req.body;
  if (!isValidCategory(category)) {
    return res.status(400).json({ ok: false, error: 'Invalid category' });
  }
  const data = readGallery();
  const cat  = data[category];
  if (!cat) return res.status(404).json({ ok: false, error: 'Category not found' });

  const gallery = cat.gallery;
  const from = parseInt(fromIndex, 10);
  const to   = parseInt(toIndex,   10);
  if (isNaN(from) || isNaN(to) || from < 0 || from >= gallery.length || to < 0 || to >= gallery.length) {
    return res.status(400).json({ ok: false, error: 'Invalid index' });
  }
  const [item] = gallery.splice(from, 1);
  gallery.splice(to, 0, item);
  gallery.forEach((it, i) => { it.id = String(i + 1).padStart(2, '0'); });
  saveGallery(data);
  res.json({ ok: true, category: data[category] });
});

// ─── Admin: Settings ──────────────────────────────────────────────────────────
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json(readSettings());
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const current = readSettings();
  const updated = {
    siteProtected: req.body.siteProtected === true || req.body.siteProtected === 'true',
    sitePassword:  req.body.sitePassword !== undefined ? req.body.sitePassword : current.sitePassword
  };
  saveSettings(updated);
  res.json({ ok: true, settings: updated });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n◼ Ivan Amad Portfolio Server`);
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log(`  Admin panel: http://localhost:${PORT}/admin\n`);
});

// ─── Chapters API ─────────────────────────────────────────────────────────────
const CHAPTERS_FILE = path.join(DATA_DIR, 'chapters.json');

function readChapters() {
  const def = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'chapters.json'), 'utf-8'));
  if (!fs.existsSync(CHAPTERS_FILE)) return def;
  try { return JSON.parse(fs.readFileSync(CHAPTERS_FILE, 'utf-8')); }
  catch(e) { return def; }
}

function saveChapters(arr) {
  fs.writeFileSync(CHAPTERS_FILE, JSON.stringify(arr, null, 2));
  // Also ensure gallery.json has entries for all chapter keys
  const data = readGallery();
  arr.forEach(ch => {
    if (!data[ch.key]) data[ch.key] = { cover: null, strips: [], mosaic: [null,null,null], gallery: [] };
  });
  saveGallery(data);
}

app.get('/api/chapters', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(readChapters());});

app.post('/api/chapters', requireAdmin, (req, res) => {
  const arr = req.body;
  if (!Array.isArray(arr)) return res.status(400).json({ ok: false, error: 'Expected array' });
  saveChapters(arr);
  res.json({ ok: true });
});
