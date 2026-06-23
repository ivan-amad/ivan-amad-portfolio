/**
 * Ivan Amad Portfolio — Backend Server
 * Node.js + Express + Supabase Storage & DB
 */

const express  = require('express');
const multer   = require('multer');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL   = process.env.SUPABASE_URL   || 'https://wgmdgrffutasexxieeyk.supabase.co';
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const STORAGE_BUCKET = 'portfolio-images';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Paths ────────────────────────────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR  = path.join(__dirname, 'admin');
const DATA_DIR   = path.join(__dirname, 'data');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ivan-portfolio-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ─── Multer (memory — uploads go to Supabase) ─────────────────────────────────
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

// ─── Data helpers (Supabase DB) ───────────────────────────────────────────────
function defaultGallery() {
  const keys = ['concept-art', 'storyboards', 'branding', 'logos', 'pixel-art', 'booth', 'social'];
  const out = {};
  keys.forEach(c => { out[c] = { cover: null, strips: [], mosaic: [null, null, null], gallery: [] }; });
  return out;
}

async function readGallery() {
  const { data, error } = await supabase.from('site_data').select('value').eq('key', 'gallery').single();
  if (error || !data) return defaultGallery();
  return data.value;
}

async function saveGallery(gallery) {
  await supabase.from('site_data').upsert({ key: 'gallery', value: gallery, updated_at: new Date() });
}

async function readChapters() {
  const { data, error } = await supabase.from('site_data').select('value').eq('key', 'chapters').single();
  if (error || !data) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'chapters.json'), 'utf-8')); }
    catch(e) { return []; }
  }
  return data.value;
}

async function saveChapters(arr) {
  await supabase.from('site_data').upsert({ key: 'chapters', value: arr, updated_at: new Date() });
  const gallery = await readGallery();
  arr.forEach(ch => {
    if (!gallery[ch.key]) gallery[ch.key] = { cover: null, strips: [], mosaic: [null,null,null], gallery: [] };
  });
  await saveGallery(gallery);
}

async function readSettings() {
  const { data, error } = await supabase.from('site_data').select('value').eq('key', 'settings').single();
  if (error || !data) return { siteProtected: false, sitePassword: '' };
  return data.value;
}

async function saveSettings(s) {
  await supabase.from('site_data').upsert({ key: 'settings', value: s, updated_at: new Date() });
}

async function deleteFromStorage(publicUrl) {
  if (!publicUrl) return;
  try {
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx !== -1) {
      const filePath = publicUrl.slice(idx + marker.length);
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
    }
  } catch(e) { /* ignore */ }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session.adminAuthed) return next();
  res.status(401).json({ ok: false, error: 'Unauthorized' });
}

async function siteGate(req, res, next) {
  const settings = await readSettings();
  if (!settings.siteProtected) return next();
  if (req.session.adminAuthed || req.session.siteAuthed) return next();
  if (req.path === '/enter' || req.path === '/api/site-login') return next();
  if (req.accepts('html')) return res.redirect('/enter');
  res.status(401).json({ error: 'Site is password protected' });
}

// ─── Static files ─────────────────────────────────────────────────────────────
app.use('/admin',  express.static(ADMIN_DIR));
app.use('/sounds', express.static(path.join(PUBLIC_DIR, 'sounds')));
app.use('/videos', express.static(path.join(PUBLIC_DIR, 'videos')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/enter', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'enter.html')));

app.post('/api/site-login', async (req, res) => {
  const settings = await readSettings();
  if (!settings.siteProtected || req.body.password === settings.sitePassword) {
    req.session.siteAuthed = true;
    res.json({ ok: true });
  } else {
    res.json({ ok: false, error: 'Wrong password' });
  }
});

app.get('/', siteGate, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ─── Admin Auth ───────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return res.status(500).json({ ok: false, error: 'Admin password not set. Run: node setup.js' });
  try {
    const match = await bcrypt.compare(req.body.password || '', hash);
    if (match) {
      req.session.adminAuthed = true;
      req.session.siteAuthed  = true;
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false, error: 'Wrong password' });
    }
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/admin/logout', (req, res) => { req.session.adminAuthed = false; res.json({ ok: true }); });
app.get('/api/admin/check',  (req, res) => res.json({ authed: !!req.session.adminAuthed }));

// ─── Gallery API ──────────────────────────────────────────────────────────────
app.get('/api/gallery', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(await readGallery());
});

// ─── Admin: Upload image ──────────────────────────────────────────────────────
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file received' });

    const { category, slot, index, label } = req.body;
    const data = await readGallery();

    if (!category || !Object.prototype.hasOwnProperty.call(data, category)) {
      return res.status(400).json({ ok: false, error: 'Invalid category: ' + category });
    }

    const ext         = path.extname(req.file.originalname).toLowerCase();
    const filename    = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const storagePath = `${category}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) return res.status(500).json({ ok: false, error: 'Upload failed: ' + uploadError.message });

    const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    const cat = data[category];

    switch (slot) {
      case 'cover':
        if (cat.cover) await deleteFromStorage(cat.cover);
        cat.cover = publicUrl;
        break;
      case 'strip':
        cat.strips.push(publicUrl);
        break;
      case 'mosaic': {
        const idx = parseInt(index, 10);
        if (isNaN(idx) || idx < 0 || idx > 2) return res.status(400).json({ ok: false, error: 'Mosaic index must be 0–2' });
        if (cat.mosaic[idx]) await deleteFromStorage(cat.mosaic[idx]);
        cat.mosaic[idx] = publicUrl;
        break;
      }
      case 'gallery':
        cat.gallery.push({
          id: String(cat.gallery.length + 1).padStart(2, '0'),
          src: publicUrl,
          label: label || `${category} ${cat.gallery.length + 1}`
        });
        break;
      default:
        return res.status(400).json({ ok: false, error: 'Invalid slot. Use: cover|strip|mosaic|gallery' });
    }

    await saveGallery(data);
    res.json({ ok: true, path: publicUrl, category: data[category] });
  });
});

// ─── Admin: Delete image ──────────────────────────────────────────────────────
app.delete('/api/admin/image', requireAdmin, async (req, res) => {
  const { category, slot, index } = req.body;
  const data = await readGallery();

  if (!category || !Object.prototype.hasOwnProperty.call(data, category)) {
    return res.status(400).json({ ok: false, error: 'Invalid category' });
  }

  const cat = data[category];
  if (!cat) return res.status(404).json({ ok: false, error: 'Category not found' });

  let src = null;
  switch (slot) {
    case 'cover':    src = cat.cover; cat.cover = null; break;
    case 'strip':  { const i = parseInt(index,10); src = cat.strips[i];   cat.strips.splice(i,1); break; }
    case 'mosaic': { const i = parseInt(index,10); src = cat.mosaic[i];   cat.mosaic[i] = null;   break; }
    case 'gallery':{ const i = parseInt(index,10); src = cat.gallery[i]?.src; cat.gallery.splice(i,1);
                     cat.gallery.forEach((item,j)=>{ item.id = String(j+1).padStart(2,'0'); }); break; }
    default: return res.status(400).json({ ok: false, error: 'Invalid slot' });
  }

  if (src) await deleteFromStorage(src);
  await saveGallery(data);
  res.json({ ok: true, category: data[category] });
});

// ─── Admin: Gallery label & reorder ──────────────────────────────────────────
app.patch('/api/admin/gallery-label', requireAdmin, async (req, res) => {
  const { category, index, label } = req.body;
  const data = await readGallery();
  const cat  = data[category];
  if (!cat || !cat.gallery[index]) return res.status(404).json({ ok: false, error: 'Item not found' });
  cat.gallery[index].label = String(label).slice(0, 100);
  await saveGallery(data);
  res.json({ ok: true, category: data[category] });
});

app.post('/api/admin/reorder', requireAdmin, async (req, res) => {
  const { category, fromIndex, toIndex } = req.body;
  const data = await readGallery();
  const cat  = data[category];
  if (!cat) return res.status(404).json({ ok: false, error: 'Category not found' });
  const from = parseInt(fromIndex,10), to = parseInt(toIndex,10);
  const [item] = cat.gallery.splice(from,1);
  cat.gallery.splice(to,0,item);
  cat.gallery.forEach((it,i)=>{ it.id = String(i+1).padStart(2,'0'); });
  await saveGallery(data);
  res.json({ ok: true, category: data[category] });
});

// ─── Admin: Settings ──────────────────────────────────────────────────────────
app.get('/api/admin/settings', requireAdmin, async (req, res) => res.json(await readSettings()));

app.post('/api/admin/settings', requireAdmin, async (req, res) => {
  const current = await readSettings();
  const updated = {
    siteProtected: req.body.siteProtected === true || req.body.siteProtected === 'true',
    sitePassword:  req.body.sitePassword !== undefined ? req.body.sitePassword : current.sitePassword
  };
  await saveSettings(updated);
  res.json({ ok: true, settings: updated });
});

// ─── Chapters API ─────────────────────────────────────────────────────────────
app.get('/api/chapters', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await readChapters());
});

app.post('/api/chapters', requireAdmin, async (req, res) => {
  const arr = req.body;
  if (!Array.isArray(arr)) return res.status(400).json({ ok: false, error: 'Expected array' });
  await saveChapters(arr);
  res.json({ ok: true });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n◼ Ivan Amad Portfolio Server`);
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log(`  Admin panel: http://localhost:${PORT}/admin\n`);
});
