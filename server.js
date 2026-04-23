const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 3000;

const DIRS = {
  images : path.join(__dirname, 'public', 'images'),
  videos : path.join(__dirname, 'public', 'videos'),
  pdfs   : path.join(__dirname, 'public', 'pdfs'),
  data   : path.join(__dirname, 'data'),
};
Object.values(DIRS).forEach(d => fs.mkdirSync(d, { recursive: true }));

const DATA_FILE = path.join(DIRS.data, 'project.json');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const m = file.mimetype;
    if (m.startsWith('image/'))      cb(null, DIRS.images);
    else if (m.startsWith('video/')) cb(null, DIRS.videos);
    else                             cb(null, DIRS.pdfs);
  },
  filename(req, file, cb) {
    const m = file.mimetype;
    const dest = m.startsWith('image/') ? DIRS.images
               : m.startsWith('video/') ? DIRS.videos : DIRS.pdfs;
    let name = file.originalname;
    try { name = Buffer.from(file.originalname, 'latin1').toString('utf8'); } catch(e) {}
    name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    if (!name || name === '.') name = 'file_' + Date.now();
    if (fs.existsSync(path.join(dest, name))) {
      const ext  = path.extname(name);
      const base = path.basename(name, ext);
      name = base + '_' + Date.now() + ext;
    }
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const m = req.file.mimetype;
  const folder = m.startsWith('image/') ? 'images' : m.startsWith('video/') ? 'videos' : 'pdfs';
  res.json({ ok: true, url: '/' + folder + '/' + req.file.filename, name: req.file.filename, type: m });
});

app.get('/api/files', (req, res) => {
  const list = {};
  ['images','videos','pdfs'].forEach(f => {
    const dir = path.join(__dirname, 'public', f);
    list[f] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => !x.startsWith('.')) : [];
  });
  res.json(list);
});

app.delete('/api/files/:folder/:name', (req, res) => {
  const { folder, name } = req.params;
  if (!['images','videos','pdfs'].includes(folder)) return res.status(400).json({ error: 'bad folder' });
  const fp = path.join(__dirname, 'public', folder, path.basename(name));
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  res.json({ ok: true });
});

app.post('/api/save', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/load', (req, res) => {
  if (fs.existsSync(DATA_FILE)) {
    try { res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); }
    catch(e) { res.json(null); }
  } else { res.json(null); }
});

app.listen(PORT, () => {
  console.log('\n  BRIX Portfolio -> http://localhost:' + PORT + '\n  Ctrl+C to stop.\n');
});
