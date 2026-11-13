/*
 * ============================================================
 *  NEXACART - E-Commerce Web Application (single file)
 *  Developed by: V Spandana
 *  Stack: Node.js (no npm install needed) + REST API + JSON database + SPA frontend
 *
 *  HOW TO RUN IN VS CODE (no typing in a terminal):
 *    1. File > Open Folder... and choose the folder that contains this file
 *    2. Open server.js and press F5   (or Run > Start Debugging)
 *       -> the store starts and your browser opens by itself at http://localhost:3000
 *    (Node.js must be installed once from https://nodejs.org)
 *
 *  Demo logins
 *    Admin : admin@vspandana.com / Admin@123   (name: V Spandana)
 *    User  : user@vspandana.com  / User@123    (name: V Spandana)
 * ============================================================
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'nexacart-db.json');
const IMG_DIR = path.join(__dirname, 'images');
const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

/* ---------------- Security helpers ---------------- */
const hashPw = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
};
const checkPw = (pw, stored) => {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex');
  const b = crypto.scryptSync(pw, salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/* ---------------- Database (JSON file) ---------------- */
function seed() {
  // Realistic product photos. Replace any link below with your own photo, e.g. '/images/headphones.jpg' (put the file in the images folder).
  const photo = (keyword, n) => 'https://loremflickr.com/640/480/' + keyword + '?lock=' + n;
  let n = 0;
  const P = (name, category, emoji, price, mrp, stock, description, keyword) => ({ name, category, emoji, price, mrp, stock, description, image: photo(keyword, ++n) });
  const list = [
    P('Wireless Headphones', 'Electronics', '🎧', 1999, 2999, 25, 'Noise-reducing over-ear headphones with 30 hours of battery life.', 'headphones'),
    P('Smart Watch', 'Electronics', '⌚', 2499, 3999, 15, 'Track steps, heart rate and sleep. Water resistant with AMOLED display.', 'smartwatch'),
    P('Bluetooth Speaker', 'Electronics', '🔊', 1299, 1999, 30, 'Portable speaker with deep bass and 12 hour playtime.', 'speaker'),
    P('Mechanical Keyboard', 'Electronics', '⌨️', 2999, 3999, 4, 'RGB mechanical keyboard with hot-swappable blue switches.', 'keyboard'),
    P('Laptop Backpack', 'Fashion', '🎒', 899, 1299, 40, 'Water-resistant backpack with USB charging port and padded laptop sleeve.', 'backpack'),
    P('Running Shoes', 'Fashion', '👟', 1799, 2499, 20, 'Lightweight breathable running shoes with cushioned sole.', 'sneakers'),
    P('Sunglasses', 'Fashion', '🕶️', 599, 999, 50, 'UV400 polarized sunglasses with a classic frame.', 'sunglasses'),
    P('Coffee Mug Set', 'Home', '☕', 399, 599, 60, 'Set of 4 ceramic mugs, microwave and dishwasher safe.', 'coffee,mug'),
    P('Table Lamp', 'Home', '💡', 699, 999, 18, 'Adjustable LED study lamp with 3 brightness modes.', 'desk,lamp'),
    P('Yoga Mat', 'Sports', '🧘', 499, 799, 35, 'Anti-slip 6mm yoga mat with carry strap.', 'yoga,mat'),
    P('Cricket Bat', 'Sports', '🏏', 1499, 2199, 12, 'English willow bat, perfectly balanced for power hitting.', 'cricket,bat'),
    P('Steel Water Bottle', 'Sports', '🍶', 299, 449, 70, 'Insulated 750ml bottle keeps drinks cold for 24 hours.', 'water,bottle'),
    P('Python Programming Book', 'Books', '📘', 449, 699, 45, 'Beginner friendly guide to Python with practical projects.', 'book,programming'),
    P('Notebook Pack', 'Books', '📓', 199, 299, 100, 'Pack of 5 ruled notebooks, 200 pages each.', 'notebook'),
  ].map((p, i) => ({ id: i + 1, createdAt: new Date().toISOString(), ...p }));
  return {
    secret: crypto.randomBytes(32).toString('hex'),
    seq: { user: 3, product: list.length + 1, order: 1001, review: 1 },
    users: [
      { id: 1, name: 'V Spandana', email: 'admin@vspandana.com', password: hashPw('Admin@123'), role: 'admin', createdAt: new Date().toISOString() },
      { id: 2, name: 'V Spandana', email: 'user@vspandana.com', password: hashPw('User@123'), role: 'user', createdAt: new Date().toISOString() },
    ],
    products: list,
    coupons: [
      { code: 'WELCOME10', percent: 10, minAmount: 0, label: '10% off on any order' },
      { code: 'NEXA20', percent: 20, minAmount: 1500, label: '20% off on orders above ₹1500' },
    ],
    orders: [], reviews: [], carts: {}, wishlists: {},
  };
}
function load() {
  if (fs.existsSync(DB_FILE)) {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { console.error('Database unreadable, creating a fresh one.'); }
  }
  const d = seed();
  fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));
  return d;
}
const db = load();
const save = () => { const t = DB_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, DB_FILE); };

/* ---------------- Utilities ---------------- */
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const now = () => new Date().toISOString();
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (payload) => { const body = b64(JSON.stringify(payload)); return body + '.' + crypto.createHmac('sha256', db.secret).update(body).digest('base64url'); };
const verify = (token) => {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', db.secret).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
};
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const clean = (s, max = 200) => String(s == null ? '' : s).trim().slice(0, max);
const num = (v, name) => { const n = Number(v); if (!isFinite(n) || n < 0) fail(400, name + ' must be a valid number'); return n; };
const ratingOf = (pid) => { const r = db.reviews.filter((x) => x.productId === pid); return { rating: r.length ? Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10 : 0, reviewCount: r.length }; };
const withRating = (p) => ({ ...p, ...ratingOf(p.id) });

const attempts = {};
const tooMany = (key) => { const a = (attempts[key] = (attempts[key] || []).filter((t) => Date.now() - t < 300000)); return a.length >= 10; };

function quote(userId, couponCode) {
  const cart = db.carts[userId] || [];
  const items = [];
  for (const c of cart) {
    const p = db.products.find((x) => x.id === c.productId);
    if (p) items.push({ productId: p.id, name: p.name, emoji: p.emoji, image: p.image, price: p.price, stock: p.stock, qty: Math.min(c.qty, Math.max(p.stock, 0)) || 0 });
  }
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  let discount = 0, coupon = '';
  if (couponCode) {
    const c = db.coupons.find((x) => x.code === String(couponCode).toUpperCase());
    if (!c) fail(400, 'Invalid coupon code');
    if (subtotal < c.minAmount) fail(400, 'Coupon needs a minimum order of ₹' + c.minAmount);
    discount = Math.round((subtotal * c.percent) / 100);
    coupon = c.code;
  }
  const after = subtotal - discount;
  const shipping = after === 0 || after >= 500 ? 0 : 49;
  const tax = Math.round(after * 0.05);
  return { items, subtotal, discount, coupon, shipping, tax, total: after + shipping + tax };
}

/* ---------------- API routes ---------------- */
// [method, regex, access ('none' | 'user' | 'admin'), handler]
const routes = [
  ['POST', /^\/api\/auth\/register$/, 'none', ({ body }) => {
    const name = clean(body.name, 60), email = clean(body.email, 100).toLowerCase(), password = String(body.password || '');
    if (!name) fail(400, 'Name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email');
    if (password.length < 6) fail(400, 'Password must be at least 6 characters');
    if (db.users.some((u) => u.email === email)) fail(409, 'Email already registered');
    const u = { id: db.seq.user++, name, email, password: hashPw(password), role: 'user', createdAt: now() };
    db.users.push(u); save();
    return { token: sign({ id: u.id, exp: Date.now() + 7 * 864e5 }), user: pub(u) };
  }],
  ['POST', /^\/api\/auth\/login$/, 'none', ({ body, ip }) => {
    const email = clean(body.email, 100).toLowerCase(), key = ip + email;
    if (tooMany(key)) fail(429, 'Too many attempts. Try again in a few minutes.');
    const u = db.users.find((x) => x.email === email);
    if (!u || !checkPw(String(body.password || ''), u.password)) { attempts[key].push(Date.now()); fail(401, 'Invalid email or password'); }
    return { token: sign({ id: u.id, exp: Date.now() + 7 * 864e5 }), user: pub(u) };
  }],
  ['GET', /^\/api\/auth\/me$/, 'user', ({ user }) => ({ user: pub(user) })],

  ['GET', /^\/api\/categories$/, 'none', () => ({ categories: [...new Set(db.products.map((p) => p.category))].sort() })],
  ['GET', /^\/api\/products$/, 'none', ({ q }) => {
    let list = db.products.map(withRating);
    const s = clean(q.get('search')).toLowerCase(), cat = q.get('category'), max = Number(q.get('max')), sort = q.get('sort');
    if (s) list = list.filter((p) => (p.name + ' ' + p.description + ' ' + p.category).toLowerCase().includes(s));
    if (cat && cat !== 'All') list = list.filter((p) => p.category === cat);
    if (max > 0) list = list.filter((p) => p.price <= max);
    const sorters = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, rating: (a, b) => b.rating - a.rating, new: (a, b) => b.id - a.id };
    list.sort(sorters[sort] || sorters.new);
    return { products: list };
  }],
  ['GET', /^\/api\/products\/(\d+)$/, 'none', ({ params }) => {
    const p = db.products.find((x) => x.id === +params[0]);
    if (!p) fail(404, 'Product not found');
    const reviews = db.reviews.filter((r) => r.productId === p.id).sort((a, b) => b.id - a.id);
    return { product: withRating(p), reviews };
  }],
  ['POST', /^\/api\/products$/, 'admin', ({ body }) => {
    const p = productFrom(body);
    p.id = db.seq.product++; p.createdAt = now();
    db.products.push(p); save();
    return { product: p };
  }],
  ['PUT', /^\/api\/products\/(\d+)$/, 'admin', ({ params, body }) => {
    const i = db.products.findIndex((x) => x.id === +params[0]);
    if (i < 0) fail(404, 'Product not found');
    db.products[i] = { ...db.products[i], ...productFrom(body) }; save();
    return { product: db.products[i] };
  }],
  ['DELETE', /^\/api\/products\/(\d+)$/, 'admin', ({ params }) => {
    const i = db.products.findIndex((x) => x.id === +params[0]);
    if (i < 0) fail(404, 'Product not found');
    db.products.splice(i, 1); save();
    return { ok: true };
  }],
  ['POST', /^\/api\/products\/(\d+)\/reviews$/, 'user', ({ params, body, user }) => {
    const p = db.products.find((x) => x.id === +params[0]);
    if (!p) fail(404, 'Product not found');
    const rating = Math.round(Number(body.rating)), comment = clean(body.comment, 500);
    if (!(rating >= 1 && rating <= 5)) fail(400, 'Rating must be between 1 and 5');
    const old = db.reviews.find((r) => r.productId === p.id && r.userId === user.id);
    if (old) { old.rating = rating; old.comment = comment; old.createdAt = now(); }
    else db.reviews.push({ id: db.seq.review++, productId: p.id, userId: user.id, userName: user.name, rating, comment, createdAt: now() });
    save();
    return { ok: true };
  }],

  ['GET', /^\/api\/cart$/, 'user', ({ user }) => quote(user.id)],
  ['POST', /^\/api\/cart\/quote$/, 'user', ({ user, body }) => quote(user.id, clean(body.coupon, 30))],
  ['POST', /^\/api\/cart$/, 'user', ({ user, body }) => {
    const p = db.products.find((x) => x.id === +body.productId);
    if (!p) fail(404, 'Product not found');
    const qty = Math.max(1, Math.floor(Number(body.qty) || 1));
    const cart = (db.carts[user.id] = db.carts[user.id] || []);
    const line = cart.find((c) => c.productId === p.id);
    const want = (line ? line.qty : 0) + qty;
    if (p.stock < 1) fail(400, 'Out of stock');
    if (want > p.stock) fail(400, 'Only ' + p.stock + ' left in stock');
    if (line) line.qty = want; else cart.push({ productId: p.id, qty });
    save();
    return quote(user.id);
  }],
  ['PUT', /^\/api\/cart\/(\d+)$/, 'user', ({ user, params, body }) => {
    const cart = db.carts[user.id] || [];
    const line = cart.find((c) => c.productId === +params[0]);
    const p = db.products.find((x) => x.id === +params[0]);
    if (!line || !p) fail(404, 'Item not in cart');
    const qty = Math.floor(Number(body.qty));
    if (!(qty >= 1)) fail(400, 'Quantity must be at least 1');
    if (qty > p.stock) fail(400, 'Only ' + p.stock + ' left in stock');
    line.qty = qty; save();
    return quote(user.id);
  }],
  ['DELETE', /^\/api\/cart\/(\d+)$/, 'user', ({ user, params }) => {
    db.carts[user.id] = (db.carts[user.id] || []).filter((c) => c.productId !== +params[0]); save();
    return quote(user.id);
  }],

  ['GET', /^\/api\/wishlist$/, 'user', ({ user }) => {
    const ids = db.wishlists[user.id] || [];
    return { ids, products: ids.map((id) => db.products.find((p) => p.id === id)).filter(Boolean).map(withRating) };
  }],
  ['POST', /^\/api\/wishlist\/(\d+)$/, 'user', ({ user, params }) => {
    const id = +params[0];
    if (!db.products.some((p) => p.id === id)) fail(404, 'Product not found');
    const w = (db.wishlists[user.id] = db.wishlists[user.id] || []);
    const i = w.indexOf(id);
    if (i >= 0) w.splice(i, 1); else w.push(id);
    save();
    return { ids: w, added: i < 0 };
  }],
  ['GET', /^\/api\/coupons$/, 'none', () => ({ coupons: db.coupons })],

  ['POST', /^\/api\/orders$/, 'user', ({ user, body }) => {
    const a = body.address || {};
    const address = { name: clean(a.name, 60), phone: clean(a.phone, 15), line: clean(a.line, 200), city: clean(a.city, 60), pincode: clean(a.pincode, 10) };
    if (!address.name || !address.line || !address.city) fail(400, 'Please fill in the full delivery address');
    if (!/^\d{10}$/.test(address.phone)) fail(400, 'Phone number must be 10 digits');
    if (!/^\d{6}$/.test(address.pincode)) fail(400, 'Pincode must be 6 digits');
    const payment = ['COD', 'UPI', 'Card'].includes(body.payment) ? body.payment : 'COD';
    const q = quote(user.id, clean(body.coupon, 30));
    if (!q.items.length) fail(400, 'Your cart is empty');
    for (const i of q.items) {
      const p = db.products.find((x) => x.id === i.productId);
      if (p.stock < 1 || (db.carts[user.id].find((c) => c.productId === p.id).qty > p.stock)) fail(400, '"' + p.name + '" does not have enough stock');
    }
    q.items.forEach((i) => { db.products.find((x) => x.id === i.productId).stock -= i.qty; });
    const order = {
      id: db.seq.order++, userId: user.id, userName: user.name, address, payment,
      paymentStatus: payment === 'COD' ? 'Pay on delivery' : 'Paid (demo)',
      items: q.items.map(({ productId, name, emoji, image, price, qty }) => ({ productId, name, emoji, image, price, qty })),
      subtotal: q.subtotal, discount: q.discount, coupon: q.coupon, shipping: q.shipping, tax: q.tax, total: q.total,
      status: 'Pending', history: [{ status: 'Pending', at: now() }], createdAt: now(),
    };
    db.orders.push(order); db.carts[user.id] = []; save();
    return { order };
  }],
  ['GET', /^\/api\/orders$/, 'user', ({ user }) => ({ orders: db.orders.filter((o) => o.userId === user.id).sort((a, b) => b.id - a.id) })],
  ['GET', /^\/api\/orders\/(\d+)$/, 'user', ({ user, params }) => {
    const o = db.orders.find((x) => x.id === +params[0]);
    if (!o || (o.userId !== user.id && user.role !== 'admin')) fail(404, 'Order not found');
    return { order: o };
  }],
  ['POST', /^\/api\/orders\/(\d+)\/cancel$/, 'user', ({ user, params }) => {
    const o = db.orders.find((x) => x.id === +params[0] && x.userId === user.id);
    if (!o) fail(404, 'Order not found');
    if (!['Pending', 'Confirmed'].includes(o.status)) fail(400, 'This order can no longer be cancelled');
    setStatus(o, 'Cancelled'); save();
    return { order: o };
  }],

  ['GET', /^\/api\/admin\/stats$/, 'admin', () => {
    const live = db.orders.filter((o) => o.status !== 'Cancelled');
    const byStatus = {}; STATUSES.forEach((s) => (byStatus[s] = db.orders.filter((o) => o.status === s).length));
    const sold = {};
    live.forEach((o) => o.items.forEach((i) => (sold[i.name] = (sold[i.name] || 0) + i.qty)));
    return {
      revenue: live.reduce((s, o) => s + o.total, 0), orders: db.orders.length, products: db.products.length,
      users: db.users.filter((u) => u.role === 'user').length, byStatus,
      lowStock: db.products.filter((p) => p.stock <= 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
      topProducts: Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty })),
      recent: [...db.orders].sort((a, b) => b.id - a.id).slice(0, 5),
    };
  }],
  ['GET', /^\/api\/admin\/orders$/, 'admin', () => ({ orders: [...db.orders].sort((a, b) => b.id - a.id) })],
  ['PUT', /^\/api\/admin\/orders\/(\d+)\/status$/, 'admin', ({ params, body }) => {
    const o = db.orders.find((x) => x.id === +params[0]);
    if (!o) fail(404, 'Order not found');
    if (!STATUSES.includes(body.status)) fail(400, 'Invalid status');
    if (o.status === 'Cancelled') fail(400, 'Cancelled orders cannot be changed');
    if (o.status !== body.status) setStatus(o, body.status);
    save();
    return { order: o };
  }],
  ['GET', /^\/api\/admin\/users$/, 'admin', () => ({
    users: db.users.map((u) => ({ ...pub(u), createdAt: u.createdAt, orders: db.orders.filter((o) => o.userId === u.id).length })),
  })],
];

function productFrom(b) {
  const name = clean(b.name, 100);
  if (!name) fail(400, 'Product name is required');
  const image = clean(b.image, 500);
  return {
    name, category: clean(b.category, 40) || 'General', emoji: clean(b.emoji, 8) || '📦',
    price: num(b.price, 'Price'), mrp: Math.max(num(b.mrp || b.price, 'MRP'), num(b.price, 'Price')),
    stock: Math.floor(num(b.stock, 'Stock')), description: clean(b.description, 600),
    image: /^(https?:\/\/|\/images\/)/i.test(image) ? image : '',
  };
}
function setStatus(o, status) {
  if (status === 'Cancelled' && o.status !== 'Cancelled') {
    o.items.forEach((i) => { const p = db.products.find((x) => x.id === i.productId); if (p) p.stock += i.qty; });
  }
  o.status = status;
  if (status === 'Delivered' && o.payment === 'COD') o.paymentStatus = 'Paid (cash)';
  o.history.push({ status, at: now() });
}

/* ---------------- HTTP server ---------------- */
const send = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1e6) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); } });
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); } });
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(HTML);
    }
    if (req.method === 'GET' && p.startsWith('/images/')) {
      const file = path.join(IMG_DIR, path.basename(decodeURIComponent(p)));
      const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        return fs.createReadStream(file).pipe(res);
      }
      res.writeHead(404); return res.end('Image not found');
    }
    if (!p.startsWith('/api/')) { res.writeHead(404); return res.end('Not found'); }
    const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const tok = verify((req.headers.authorization || '').replace('Bearer ', ''));
    const user = tok ? db.users.find((u) => u.id === tok.id) : null;
    for (const [m, re, access, fn] of routes) {
      if (m !== req.method) continue;
      const match = re.exec(p);
      if (!match) continue;
      if (access !== 'none' && !user) return send(res, 401, { error: 'Please login first' });
      if (access === 'admin' && user.role !== 'admin') return send(res, 403, { error: 'Admin access only' });
      return send(res, 200, await fn({ q: url.searchParams, params: match.slice(1), body, user, ip: req.socket.remoteAddress }));
    }
    send(res, 404, { error: 'API route not found' });
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'Server error' });
  }
});

// Start on PORT; if it is busy, quietly try the next ports. Then open the browser automatically.
function start(port, tries) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries > 0) return start(port + 1, tries - 1);
    console.error('Could not start the server:', e.message); process.exit(1);
  });
  server.listen(port, () => {
    const url = 'http://localhost:' + port;
    console.log('\n  NexaCart is running -> ' + url);
    console.log('  Admin: admin@vspandana.com / Admin@123');
    console.log('  User : user@vspandana.com  / User@123\n');
    const { exec } = require('child_process');
    const cmd = process.platform === 'win32' ? 'start "" "' + url + '"' : process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
    exec(cmd, () => {});
  });
}
start(Number(PORT), 10);

/* ---------------- Frontend (single page app) ---------------- */
const HTML = String.raw`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NexaCart - by V Spandana</title>
<style>
:root{--bg:#f4f6fb;--card:#fff;--text:#1b2437;--muted:#6b7488;--primary:#4f46e5;--primary2:#7c3aed;--ok:#10b981;--bad:#ef4444;--warn:#f59e0b;--line:#e4e8f0;--shadow:0 4px 18px rgba(30,40,90,.08)}
[data-theme=dark]{--bg:#0f1424;--card:#192037;--text:#e7ebf6;--muted:#97a0b8;--line:#2a3350;--shadow:0 4px 18px rgba(0,0,0,.4)}
*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,system-ui,Arial,sans-serif;background:var(--bg);color:var(--text)}
a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit}
.nav{position:sticky;top:0;z-index:20;background:var(--card);box-shadow:var(--shadow);display:flex;align-items:center;gap:6px;padding:10px 20px;flex-wrap:wrap}
.brand{font-weight:800;font-size:1.3rem;background:linear-gradient(90deg,var(--primary),var(--primary2));-webkit-background-clip:text;color:transparent;margin-right:auto}
.nav a.l,.nav button.l{padding:8px 12px;border-radius:8px;color:var(--text);background:none;border:0;cursor:pointer;font-weight:600;font-size:.92rem}
.nav a.l:hover,.nav button.l:hover{background:var(--bg)}.badge{background:var(--bad);color:#fff;border-radius:99px;padding:1px 7px;font-size:.72rem;margin-left:4px}
.wrap{max-width:1150px;margin:0 auto;padding:22px 16px 60px}
.hero{background:linear-gradient(120deg,rgba(79,70,229,.88),rgba(124,58,237,.78)),url(https://loremflickr.com/1200/400/shopping?lock=99) center/cover,linear-gradient(120deg,var(--primary),var(--primary2));color:#fff;border-radius:18px;padding:54px 28px;margin-bottom:20px;box-shadow:var(--shadow)}
.hero h1{margin:0 0 6px;font-size:2rem}.hero p{margin:0;opacity:.92}
.bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}.bar input,.bar select{padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text)}.bar input[type=search]{flex:1;min-width:200px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:18px}
.card{background:var(--card);border-radius:16px;box-shadow:var(--shadow);padding:16px;position:relative;border:1px solid var(--line)}
.pimg{height:150px;border-radius:12px;background:linear-gradient(135deg,#e0e7ff,#fae8ff);display:flex;align-items:center;justify-content:center;font-size:4.4rem;overflow:hidden}[data-theme=dark] .pimg{background:linear-gradient(135deg,#27305a,#3b2a56)}
.pimg img{width:100%;height:100%;object-fit:cover}.cat{font-size:.74rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-top:10px}
.pname{font-weight:700;margin:3px 0}.stars{color:var(--warn);font-size:.88rem}.price{font-size:1.15rem;font-weight:800}.mrp{color:var(--muted);text-decoration:line-through;font-size:.85rem;margin-left:6px}.off{color:var(--ok);font-size:.8rem;font-weight:700;margin-left:6px}
.heart{position:absolute;top:22px;right:22px;background:var(--card);border:0;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:1rem;box-shadow:var(--shadow)}
.btn{background:linear-gradient(90deg,var(--primary),var(--primary2));color:#fff;border:0;padding:10px 16px;border-radius:10px;font-weight:700;cursor:pointer}.btn:hover{opacity:.92}.btn.sm{padding:6px 10px;font-size:.82rem}.btn.full{width:100%}
.btn.ghost{background:var(--bg);color:var(--text);border:1px solid var(--line)}.btn.red{background:var(--bad)}.btn:disabled{opacity:.45;cursor:not-allowed}
.tag{display:inline-block;padding:3px 10px;border-radius:99px;font-size:.76rem;font-weight:700;background:var(--bg)}.low{color:var(--bad)}.in{color:var(--ok)}
.st-Pending{background:#fef3c7;color:#92400e}.st-Confirmed{background:#dbeafe;color:#1e40af}.st-Shipped{background:#e0e7ff;color:#3730a3}.st-OutforDelivery{background:#ede9fe;color:#5b21b6}.st-Delivered{background:#d1fae5;color:#065f46}.st-Cancelled{background:#fee2e2;color:#991b1b}
.two{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:760px){.two,.cols{grid-template-columns:1fr!important}}
.cols{display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start}
.row{display:flex;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.row:last-child{border:0}.row .mini{font-size:2.2rem;width:64px;height:64px;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg)}.mini img{width:100%;height:100%;object-fit:cover}
.chip{display:inline-flex;align-items:center;gap:6px;margin:3px 12px 3px 0}.chip .t{width:32px;height:32px;border-radius:8px;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--bg);font-size:1.2rem}.chip img{width:100%;height:100%;object-fit:cover}.row .grow{flex:1}
.qty{display:inline-flex;align-items:center;gap:8px}.qty button{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);cursor:pointer}
.sum div{display:flex;justify-content:space-between;padding:6px 0}.sum .t{font-weight:800;font-size:1.15rem;border-top:1px dashed var(--line);margin-top:6px;padding-top:12px}
.form label{display:block;font-size:.84rem;color:var(--muted);margin:10px 0 4px}.form input,.form select,.form textarea{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}
.auth{max-width:420px;margin:30px auto}h2{margin:0 0 14px}.muted{color:var(--muted)}.center{text-align:center}
table{width:100%;border-collapse:collapse;background:var(--card);border-radius:14px;overflow:hidden;box-shadow:var(--shadow);font-size:.9rem}th,td{padding:11px 12px;text-align:left;border-bottom:1px solid var(--line)}th{background:var(--bg);font-size:.78rem;text-transform:uppercase;color:var(--muted)}.tw{overflow-x:auto}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:20px}.stat .n{font-size:1.7rem;font-weight:800}.stat .k{color:var(--muted);font-size:.84rem}
.hbar{display:flex;align-items:center;gap:10px;margin:7px 0;font-size:.85rem}.hbar .b{height:12px;border-radius:6px;background:linear-gradient(90deg,var(--primary),var(--primary2));min-width:3px}.hbar span:first-child{width:120px}
.tabs{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}.tabs a{padding:8px 16px;border-radius:99px;background:var(--card);border:1px solid var(--line);font-weight:600;font-size:.9rem}.tabs a.on{background:var(--primary);color:#fff;border-color:var(--primary)}
.track{display:flex;justify-content:space-between;margin:20px 0 8px;position:relative}.track:before{content:"";position:absolute;top:16px;left:8%;right:8%;height:4px;background:var(--line)}
.step{position:relative;text-align:center;flex:1;font-size:.78rem;color:var(--muted)}.step .dot{width:34px;height:34px;border-radius:50%;background:var(--line);margin:0 auto 6px;display:flex;align-items:center;justify-content:center;position:relative;color:#fff;font-weight:700}
.step.done .dot{background:var(--ok)}.step.done{color:var(--text);font-weight:600}
.modal{position:fixed;inset:0;background:rgba(10,15,35,.6);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}.modal .card{width:100%;max-width:520px;max-height:92vh;overflow:auto}
#toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99;display:flex;flex-direction:column;gap:8px}.toast{background:#1b2437;color:#fff;padding:11px 20px;border-radius:12px;box-shadow:var(--shadow);font-weight:600}.toast.err{background:var(--bad)}
footer{text-align:center;color:var(--muted);padding:26px;font-size:.85rem}
@media print{.nav,footer,.noprint,#toast{display:none!important}body{background:#fff}}
</style></head><body>
<div class="nav" id="nav"></div>
<div class="wrap" id="app"></div>
<footer>© 2026 NexaCart · Developed by <b>V Spandana</b></footer>
<div id="toast"></div>
<script>
var RID = 0; // route counter: ignores slow page loads that finish after you moved on
var API = {
  token: localStorage.getItem('nexacart_token') || '',
  call: function (m, u, b) {
    var rid = RID, guard = m === 'GET' || u === '/cart/quote';
    var h = { 'Content-Type': 'application/json' };
    if (API.token) h.Authorization = 'Bearer ' + API.token;
    return fetch('/api' + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Request failed'); if (guard && rid !== RID) return new Promise(function () {}); return d; });
    });
  }
};
var ME = null, WL = [], CART = 0, COUPON = '', FILTER = { search: '', category: 'All', sort: 'new', max: '' }, ADMIN_PRODUCTS = [];
var app = document.getElementById('app');
var STEPS = ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function money(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
function stars(r) { r = Math.round(r); return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r); }
function dt(s) { return new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
function toast(msg, type) {
  var d = document.createElement('div'); d.className = 'toast ' + (type || ''); d.textContent = msg;
  document.getElementById('toast').appendChild(d); setTimeout(function () { d.remove(); }, 2800);
}
function pic(p) { return p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" data-e="' + esc(p.emoji) + '" onerror="imgFail(this)">' : esc(p.emoji); }
function imgFail(el) { var s = document.createElement('span'); s.textContent = el.getAttribute('data-e') || '📦'; el.replaceWith(s); }
function stBadge(s) { return '<span class="tag st-' + s.replace(/ /g, '') + '">' + esc(s) + '</span>'; }
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('nexacart_theme', t); } catch (e) {} }
function toggleTheme() { setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
try { setTheme(localStorage.getItem('nexacart_theme') || 'light'); } catch (e) {}

function nav() {
  var h = '<a class="brand" href="#/">NexaCart</a><a class="l" href="#/">Home</a>';
  if (ME) {
    h += '<a class="l" href="#/wishlist">❤️ Wishlist</a><a class="l" href="#/orders">📦 My Orders</a>';
    h += '<a class="l" href="#/cart">🛒 Cart' + (CART ? '<span class="badge">' + CART + '</span>' : '') + '</a>';
    if (ME.role === 'admin') h += '<a class="l" href="#/admin">⚙️ Admin</a>';
    h += '<span class="muted" style="padding:0 8px">Hi, <b>' + esc(ME.name) + '</b></span><button class="l" onclick="logout()">Logout</button>';
  } else h += '<a class="l" href="#/login">Login</a><a class="l" href="#/register">Register</a>';
  h += '<button class="l" onclick="toggleTheme()" title="Dark / light">🌓</button>';
  document.getElementById('nav').innerHTML = h;
}
function refreshMeta() {
  if (!ME) { WL = []; CART = 0; return Promise.resolve(); }
  return Promise.all([API.call('GET', '/cart'), API.call('GET', '/wishlist')]).then(function (r) {
    CART = r[0].items.reduce(function (s, i) { return s + i.qty; }, 0); WL = r[1].ids;
  });
}
function logout() { API.token = ''; localStorage.removeItem('nexacart_token'); ME = null; WL = []; CART = 0; COUPON = ''; nav(); location.hash = '#/'; toast('Logged out'); }

/* ----- router ----- */
function route() {
  RID++;
  var parts = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  var p = parts[0] || '', a = parts[1];
  var needLogin = ['cart', 'checkout', 'orders', 'order', 'wishlist', 'admin'];
  if (needLogin.indexOf(p) >= 0 && !ME) { location.hash = '#/login'; return; }
  if (p === 'admin' && ME.role !== 'admin') { toast('Admin access only', 'err'); location.hash = '#/'; return; }
  window.scrollTo(0, 0);
  var pages = {
    '': pageHome, product: function () { return pageProduct(a); }, cart: pageCart, checkout: pageCheckout, orders: pageOrders,
    order: function () { return pageOrder(a); }, wishlist: pageWishlist, login: pageLogin, register: pageRegister,
    admin: function () { return pageAdmin(a || 'dashboard'); }
  };
  var fn = pages[p] || pageHome;
  Promise.resolve(fn()).catch(function (e) { app.innerHTML = '<div class="card center"><h2>Something went wrong</h2><p class="muted">' + esc(e.message) + '</p><a class="btn" href="#/">Go home</a></div>'; });
}
window.addEventListener('hashchange', route);

/* ----- auth pages ----- */
function pageLogin() {
  app.innerHTML = '<div class="card auth form"><h2>Welcome back 👋</h2><label>Email</label><input id="e" type="email" value="user@vspandana.com"><label>Password</label><input id="p" type="password" value="User@123" onkeydown="if(event.key===\'Enter\')doLogin()"><br><br><button class="btn full" onclick="doLogin()">Login</button>' +
    '<p class="muted center">New here? <a href="#/register" style="color:var(--primary)"><b>Create account</b></a></p>' +
    '<p class="muted center" style="font-size:.82rem">Demo admin: admin@vspandana.com / Admin@123</p></div>';
}
function pageRegister() {
  app.innerHTML = '<div class="card auth form"><h2>Create your account</h2><label>Full name</label><input id="n" value="V Spandana"><label>Email</label><input id="e" type="email"><label>Password (min 6)</label><input id="p" type="password"><br><br><button class="btn full" onclick="doRegister()">Register</button><p class="muted center">Already registered? <a href="#/login" style="color:var(--primary)"><b>Login</b></a></p></div>';
}
function afterAuth(d) {
  API.token = d.token; localStorage.setItem('nexacart_token', d.token); ME = d.user;
  return refreshMeta().then(function () { nav(); toast('Welcome, ' + ME.name + '!'); location.hash = ME.role === 'admin' ? '#/admin' : '#/'; });
}
function doLogin() { API.call('POST', '/auth/login', { email: val('e'), password: val('p') }).then(afterAuth).catch(function (e) { toast(e.message, 'err'); }); }
function doRegister() { API.call('POST', '/auth/register', { name: val('n'), email: val('e'), password: val('p') }).then(afterAuth).catch(function (e) { toast(e.message, 'err'); }); }
function val(id) { return document.getElementById(id).value; }

/* ----- catalog ----- */
function card(p) {
  var off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  var heart = WL.indexOf(p.id) >= 0 ? '❤️' : '🤍';
  var stock = p.stock < 1 ? '<span class="tag low">Out of stock</span>' : p.stock <= 5 ? '<span class="tag low">Only ' + p.stock + ' left!</span>' : '<span class="tag in">In stock</span>';
  return '<div class="card"><button class="heart" onclick="toggleWish(' + p.id + ')">' + heart + '</button><a href="#/product/' + p.id + '"><div class="pimg">' + pic(p) + '</div>' +
    '<div class="cat">' + esc(p.category) + '</div><div class="pname">' + esc(p.name) + '</div></a>' +
    '<div class="stars">' + stars(p.rating) + ' <span class="muted">(' + p.reviewCount + ')</span></div>' +
    '<div style="margin:6px 0"><span class="price">' + money(p.price) + '</span>' + (off ? '<span class="mrp">' + money(p.mrp) + '</span><span class="off">' + off + '% off</span>' : '') + '</div>' +
    '<div style="margin-bottom:10px">' + stock + '</div><button class="btn full" ' + (p.stock < 1 ? 'disabled' : '') + ' onclick="addCart(' + p.id + ')">Add to Cart</button></div>';
}
function pageHome() {
  return API.call('GET', '/categories').then(function (c) {
    var opts = ['All'].concat(c.categories).map(function (x) { return '<option ' + (x === FILTER.category ? 'selected' : '') + '>' + esc(x) + '</option>'; }).join('');
    app.innerHTML = '<div class="hero"><h1>Welcome to NexaCart</h1><p>Quality products, great prices, fast delivery. Use code <b>WELCOME10</b> for 10% off your order.</p></div>' +
      '<div class="bar"><input type="search" id="fs" placeholder="🔍 Search products..." value="' + esc(FILTER.search) + '" oninput="filterChange()">' +
      '<select id="fc" onchange="filterChange(1)">' + opts + '</select>' +
      '<select id="fo" onchange="filterChange(1)"><option value="new">Newest</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option><option value="rating">Top Rated</option></select>' +
      '<input type="number" id="fm" placeholder="Max price ₹" style="width:130px" value="' + esc(FILTER.max) + '" oninput="filterChange()"></div><div id="grid" class="grid"></div>';
    document.getElementById('fo').value = FILTER.sort;
    loadGrid();
  });
}
var ft;
function filterChange(now) { clearTimeout(ft); ft = setTimeout(loadGrid, now ? 0 : 300); }
function loadGrid() {
  FILTER = { search: val('fs'), category: val('fc'), sort: val('fo'), max: val('fm') };
  var q = '?search=' + encodeURIComponent(FILTER.search) + '&category=' + encodeURIComponent(FILTER.category) + '&sort=' + FILTER.sort + '&max=' + (FILTER.max || 0);
  API.call('GET', '/products' + q).then(function (d) {
    var g = document.getElementById('grid'); if (!g) return;
    g.innerHTML = d.products.length ? d.products.map(card).join('') : '<p class="muted">No products found. Try a different search.</p>';
  });
}
function addCart(id, qty) {
  if (!ME) { toast('Please login to add items', 'err'); location.hash = '#/login'; return; }
  API.call('POST', '/cart', { productId: id, qty: qty || 1 }).then(function () { return refreshMeta(); }).then(function () { nav(); toast('Added to cart 🛒'); }).catch(function (e) { toast(e.message, 'err'); });
}
function toggleWish(id) {
  if (!ME) { toast('Please login to use wishlist', 'err'); location.hash = '#/login'; return; }
  API.call('POST', '/wishlist/' + id).then(function (d) { WL = d.ids; toast(d.added ? 'Added to wishlist ❤️' : 'Removed from wishlist'); route(); });
}
function pageWishlist() {
  return API.call('GET', '/wishlist').then(function (d) {
    app.innerHTML = '<h2>❤️ My Wishlist</h2>' + (d.products.length ? '<div class="grid">' + d.products.map(card).join('') + '</div>' : '<div class="card center muted">Your wishlist is empty. Tap the 🤍 on any product to save it.</div>');
  });
}
function pageProduct(id) {
  return API.call('GET', '/products/' + id).then(function (d) {
    var p = d.product, off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    var reviews = d.reviews.map(function (r) { return '<div class="row"><div class="grow"><b>' + esc(r.userName) + '</b> <span class="stars">' + stars(r.rating) + '</span><div>' + esc(r.comment) + '</div><div class="muted" style="font-size:.78rem">' + dt(r.createdAt) + '</div></div></div>'; }).join('') || '<p class="muted">No reviews yet. Be the first!</p>';
    var rform = ME ? '<div class="form"><label>Your rating</label><select id="rr"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Average</option><option value="2">★★ Poor</option><option value="1">★ Terrible</option></select><label>Comment</label><textarea id="rc" rows="2"></textarea><br><br><button class="btn" onclick="postReview(' + p.id + ')">Submit review</button></div>' : '<p class="muted"><a href="#/login" style="color:var(--primary)">Login</a> to write a review.</p>';
    app.innerHTML = '<a href="#/" class="muted">← Back to products</a><div class="two card" style="margin-top:12px"><div class="pimg" style="height:320px;font-size:9rem">' + pic(p) + '</div><div>' +
      '<div class="cat">' + esc(p.category) + '</div><h2 style="font-size:1.7rem">' + esc(p.name) + '</h2><div class="stars">' + stars(p.rating) + ' <span class="muted">' + p.rating + ' (' + p.reviewCount + ' reviews)</span></div>' +
      '<div style="margin:12px 0"><span class="price" style="font-size:1.8rem">' + money(p.price) + '</span>' + (off ? '<span class="mrp">' + money(p.mrp) + '</span><span class="off">' + off + '% off</span>' : '') + '</div>' +
      '<p>' + esc(p.description) + '</p><p>' + (p.stock < 1 ? '<span class="tag low">Out of stock</span>' : '<span class="tag in">' + p.stock + ' in stock</span>') + '</p>' +
      '<p class="qty"><button onclick="qtyBox(-1)">−</button><b id="qb">1</b><button onclick="qtyBox(1,' + p.stock + ')">+</button></p><br>' +
      '<button class="btn" ' + (p.stock < 1 ? 'disabled' : '') + ' onclick="addCart(' + p.id + ',+document.getElementById(\'qb\').textContent)">🛒 Add to Cart</button> <button class="btn ghost" onclick="toggleWish(' + p.id + ')">' + (WL.indexOf(p.id) >= 0 ? '❤️ Saved' : '🤍 Wishlist') + '</button></div></div>' +
      '<div class="card" style="margin-top:18px"><h2>Customer reviews</h2>' + reviews + '<hr style="border:0;border-top:1px solid var(--line)">' + rform + '</div>';
  });
}
function qtyBox(d, max) { var el = document.getElementById('qb'), n = +el.textContent + d; if (n >= 1 && (!max || n <= max)) el.textContent = n; }
function postReview(id) { API.call('POST', '/products/' + id + '/reviews', { rating: val('rr'), comment: val('rc') }).then(function () { toast('Thanks for your review!'); route(); }).catch(function (e) { toast(e.message, 'err'); }); }

/* ----- cart & checkout ----- */
function breakdown(q) {
  return '<div class="sum"><div><span>Subtotal</span><span>' + money(q.subtotal) + '</span></div>' +
    (q.discount ? '<div style="color:var(--ok)"><span>Coupon (' + esc(q.coupon) + ')</span><span>− ' + money(q.discount) + '</span></div>' : '') +
    '<div><span>Shipping</span><span>' + (q.shipping ? money(q.shipping) : 'FREE') + '</span></div><div><span>GST (5%)</span><span>' + money(q.tax) + '</span></div><div class="t"><span>Total</span><span>' + money(q.total) + '</span></div></div>';
}
function getQuote() {
  return API.call('POST', '/cart/quote', { coupon: COUPON }).catch(function (e) { toast(e.message, 'err'); COUPON = ''; return API.call('POST', '/cart/quote', { coupon: '' }); });
}
function pageCart() {
  return getQuote().then(function (q) {
    if (!q.items.length) { app.innerHTML = '<div class="card center"><h2>Your cart is empty 🛒</h2><p class="muted">Looks like you have not added anything yet.</p><a class="btn" href="#/">Start shopping</a></div>'; return; }
    var rows = q.items.map(function (i) {
      return '<div class="row"><div class="mini">' + pic(i) + '</div><div class="grow"><a href="#/product/' + i.productId + '"><b>' + esc(i.name) + '</b></a><div class="muted">' + money(i.price) + ' each</div></div>' +
        '<div class="qty"><button onclick="setQty(' + i.productId + ',' + (i.qty - 1) + ')">−</button><b>' + i.qty + '</b><button onclick="setQty(' + i.productId + ',' + (i.qty + 1) + ')">+</button></div><b style="width:90px;text-align:right">' + money(i.price * i.qty) + '</b><button class="btn ghost sm" onclick="delItem(' + i.productId + ')">✕</button></div>';
    }).join('');
    app.innerHTML = '<h2>🛒 Shopping Cart</h2><div class="cols"><div class="card">' + rows + '</div><div class="card"><h2>Order summary</h2>' +
      '<div class="form"><label>Coupon code</label><div style="display:flex;gap:8px"><input id="cp" value="' + esc(COUPON) + '" placeholder="e.g. WELCOME10"><button class="btn sm" onclick="applyCoupon()">Apply</button></div></div><br>' + breakdown(q) + '<br><a class="btn full center" style="display:block" href="#/checkout">Proceed to Checkout →</a></div></div>';
  });
}
function setQty(id, qty) { if (qty < 1) return delItem(id); API.call('PUT', '/cart/' + id, { qty: qty }).then(function () { return refreshMeta(); }).then(function () { nav(); route(); }).catch(function (e) { toast(e.message, 'err'); }); }
function delItem(id) { API.call('DELETE', '/cart/' + id).then(function () { return refreshMeta(); }).then(function () { nav(); route(); }); }
function applyCoupon() { COUPON = val('cp').trim().toUpperCase(); route(); }
function pageCheckout() {
  return getQuote().then(function (q) {
    if (!q.items.length) { location.hash = '#/cart'; return; }
    app.innerHTML = '<h2>Checkout</h2><div class="cols"><div class="card form"><h2>Delivery address</h2><label>Full name</label><input id="an" value="' + esc(ME.name) + '"><label>Phone (10 digits)</label><input id="ap" maxlength="10"><label>Address</label><textarea id="al" rows="2"></textarea>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>City</label><input id="ac"></div><div><label>Pincode</label><input id="az" maxlength="6"></div></div>' +
      '<h2 style="margin-top:22px">Payment method</h2><label style="color:var(--text)"><input type="radio" name="pay" value="COD" checked style="width:auto"> 💵 Cash on Delivery</label><label style="color:var(--text)"><input type="radio" name="pay" value="UPI" style="width:auto"> 📱 UPI (demo)</label><label style="color:var(--text)"><input type="radio" name="pay" value="Card" style="width:auto"> 💳 Credit / Debit Card (demo)</label></div>' +
      '<div class="card"><h2>Order summary</h2>' + q.items.map(function (i) { return '<div class="row"><div class="mini" style="font-size:1.5rem;width:48px;height:48px">' + pic(i) + '</div><div class="grow">' + esc(i.name) + ' × ' + i.qty + '</div><b>' + money(i.price * i.qty) + '</b></div>'; }).join('') + breakdown(q) + '<br><button class="btn full" onclick="placeOrder()">Place Order ✅</button></div></div>';
  });
}
function placeOrder() {
  var pay = document.querySelector('input[name=pay]:checked').value;
  API.call('POST', '/orders', { coupon: COUPON, payment: pay, address: { name: val('an'), phone: val('ap'), line: val('al'), city: val('ac'), pincode: val('az') } })
    .then(function (d) { COUPON = ''; return refreshMeta().then(function () { nav(); toast('Order #' + d.order.id + ' placed successfully! 🎉'); location.hash = '#/order/' + d.order.id; }); })
    .catch(function (e) { toast(e.message, 'err'); });
}

/* ----- orders ----- */
function pageOrders() {
  return API.call('GET', '/orders').then(function (d) {
    if (!d.orders.length) { app.innerHTML = '<div class="card center"><h2>No orders yet 📦</h2><a class="btn" href="#/">Browse products</a></div>'; return; }
    app.innerHTML = '<h2>📦 My Orders</h2>' + d.orders.map(function (o) {
      return '<a href="#/order/' + o.id + '" class="card" style="display:block;margin-bottom:12px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><b>Order #' + o.id + '</b>' + stBadge(o.status) + '</div><div class="muted" style="font-size:.85rem">' + dt(o.createdAt) + '</div><div style="margin-top:8px">' + o.items.map(function (i) { return '<span class="chip"><span class="t">' + pic(i) + '</span>' + esc(i.name) + ' × ' + i.qty + '</span>'; }).join('') + '</div><div style="margin-top:6px"><b>' + money(o.total) + '</b> <span class="muted">· ' + esc(o.payment) + '</span></div></a>';
    }).join('');
  });
}
function tracker(o) {
  if (o.status === 'Cancelled') return '<div class="tag st-Cancelled" style="display:block;padding:12px;text-align:center">❌ This order was cancelled</div>';
  var idx = STEPS.indexOf(o.status);
  return '<div class="track">' + STEPS.map(function (s, i) { return '<div class="step ' + (i <= idx ? 'done' : '') + '"><div class="dot">' + (i <= idx ? '✓' : i + 1) + '</div>' + s + '</div>'; }).join('') + '</div>';
}
function pageOrder(id) {
  return API.call('GET', '/orders/' + id).then(function (d) {
    var o = d.order, a = o.address, canCancel = o.userId === ME.id && (o.status === 'Pending' || o.status === 'Confirmed');
    app.innerHTML = '<a href="#/orders" class="muted noprint">← All orders</a><div class="card" style="margin-top:12px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><h2>Order #' + o.id + '</h2>' + stBadge(o.status) + '</div><div class="muted">Placed on ' + dt(o.createdAt) + '</div>' + tracker(o) + '</div>' +
      '<div class="cols" style="margin-top:18px"><div class="card"><h2>Items</h2>' + o.items.map(function (i) { return '<div class="row"><div class="mini">' + pic(i) + '</div><div class="grow">' + esc(i.name) + '<div class="muted">' + money(i.price) + ' × ' + i.qty + '</div></div><b>' + money(i.price * i.qty) + '</b></div>'; }).join('') + breakdown(o) + '</div>' +
      '<div><div class="card"><h2>Delivery address</h2><b>' + esc(a.name) + '</b><br>' + esc(a.line) + '<br>' + esc(a.city) + ' - ' + esc(a.pincode) + '<br>📞 ' + esc(a.phone) + '</div>' +
      '<div class="card" style="margin-top:14px"><h2>Payment</h2>' + esc(o.payment) + ' · ' + esc(o.paymentStatus) + '</div>' +
      '<div class="card" style="margin-top:14px"><h2>Status history</h2>' + o.history.map(function (h) { return '<div style="padding:4px 0">' + stBadge(h.status) + ' <span class="muted" style="font-size:.8rem">' + dt(h.at) + '</span></div>'; }).join('') + '</div>' +
      '<div class="noprint" style="margin-top:14px;display:flex;gap:8px"><button class="btn ghost" onclick="window.print()">🖨️ Print invoice</button>' + (canCancel ? '<button class="btn red" onclick="cancelOrder(' + o.id + ')">Cancel order</button>' : '') + '</div></div></div>';
  });
}
function cancelOrder(id) { if (!confirm('Cancel this order?')) return; API.call('POST', '/orders/' + id + '/cancel').then(function () { toast('Order cancelled'); route(); }).catch(function (e) { toast(e.message, 'err'); }); }

/* ----- admin ----- */
function adminTabs(on) {
  var t = [['dashboard', '📊 Dashboard'], ['products', '📦 Products'], ['orders', '🧾 Orders'], ['users', '👥 Users']];
  return '<div class="tabs">' + t.map(function (x) { return '<a class="' + (x[0] === on ? 'on' : '') + '" href="#/admin/' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</div>';
}
function pageAdmin(tab) {
  if (tab === 'products') return adminProducts();
  if (tab === 'orders') return adminOrders();
  if (tab === 'users') return adminUsers();
  return API.call('GET', '/admin/stats').then(function (s) {
    var max = Math.max.apply(null, Object.keys(s.byStatus).map(function (k) { return s.byStatus[k]; }).concat([1]));
    app.innerHTML = '<h2>Admin Dashboard — V Spandana</h2>' + adminTabs('dashboard') + '<div class="stats">' +
      [['💰 Revenue', money(s.revenue)], ['🧾 Orders', s.orders], ['📦 Products', s.products], ['👥 Customers', s.users]].map(function (x) { return '<div class="card stat"><div class="n">' + x[1] + '</div><div class="k">' + x[0] + '</div></div>'; }).join('') + '</div>' +
      '<div class="cols"><div class="card"><h2>Orders by status</h2>' + Object.keys(s.byStatus).map(function (k) { return '<div class="hbar"><span>' + k + '</span><div class="b" style="width:' + (s.byStatus[k] / max * 60) + '%"></div><b>' + s.byStatus[k] + '</b></div>'; }).join('') +
      '<h2 style="margin-top:20px">Top selling</h2>' + (s.topProducts.map(function (t) { return '<div class="hbar"><span style="width:180px">' + esc(t.name) + '</span><b>' + t.qty + ' sold</b></div>'; }).join('') || '<p class="muted">No sales yet</p>') + '</div>' +
      '<div><div class="card"><h2>⚠️ Low stock</h2>' + (s.lowStock.map(function (p) { return '<div style="padding:4px 0">' + esc(p.name) + ' — <b class="low">' + p.stock + ' left</b></div>'; }).join('') || '<p class="muted">All good</p>') + '</div>' +
      '<div class="card" style="margin-top:14px"><h2>Recent orders</h2>' + (s.recent.map(function (o) { return '<a href="#/order/' + o.id + '" style="display:flex;justify-content:space-between;padding:5px 0"><span>#' + o.id + ' · ' + esc(o.userName) + '</span>' + stBadge(o.status) + '</a>'; }).join('') || '<p class="muted">No orders yet</p>') + '</div></div></div>';
  });
}
function adminProducts() {
  return API.call('GET', '/products?sort=new').then(function (d) {
    ADMIN_PRODUCTS = d.products;
    app.innerHTML = '<h2>Manage Products</h2>' + adminTabs('products') + '<button class="btn" onclick="productForm(0)">+ Add product</button><br><br><div class="tw"><table><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr>' +
      d.products.map(function (p) { return '<tr><td><span class="chip"><span class="t" style="width:48px;height:48px">' + pic(p) + '</span></span></td><td>' + esc(p.name) + '</td><td>' + esc(p.category) + '</td><td>' + money(p.price) + '</td><td class="' + (p.stock <= 5 ? 'low' : '') + '"><b>' + p.stock + '</b></td><td><button class="btn ghost sm" onclick="productForm(' + p.id + ')">Edit</button> <button class="btn red sm" onclick="delProduct(' + p.id + ')">Delete</button></td></tr>'; }).join('') + '</table></div>';
  });
}
function productForm(id) {
  var p = ADMIN_PRODUCTS.filter(function (x) { return x.id === id; })[0] || { name: '', category: '', emoji: '📦', price: '', mrp: '', stock: '', image: '', description: '' };
  var m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = '<div class="card form"><h2>' + (id ? 'Edit' : 'Add') + ' product</h2><label>Name</label><input id="pn" value="' + esc(p.name) + '"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>Category</label><input id="pc" value="' + esc(p.category) + '"></div><div><label>Emoji icon</label><input id="pe" value="' + esc(p.emoji) + '"></div>' +
    '<div><label>Price ₹</label><input id="pp" type="number" value="' + p.price + '"></div><div><label>MRP ₹</label><input id="pm" type="number" value="' + p.mrp + '"></div></div><label>Stock</label><input id="ps" type="number" value="' + p.stock + '"><label>Image URL or /images/file.jpg (optional)</label><input id="pi" value="' + esc(p.image) + '"><label>Description</label><textarea id="pd" rows="3">' + esc(p.description) + '</textarea><br>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" onclick="document.getElementById(\'modal\').remove()">Cancel</button><button class="btn" onclick="saveProduct(' + id + ')">Save</button></div></div>';
  document.body.appendChild(m);
}
function saveProduct(id) {
  var b = { name: val('pn'), category: val('pc'), emoji: val('pe'), price: val('pp'), mrp: val('pm'), stock: val('ps'), image: val('pi'), description: val('pd') };
  API.call(id ? 'PUT' : 'POST', '/products' + (id ? '/' + id : ''), b).then(function () { document.getElementById('modal').remove(); toast('Product saved ✅'); route(); }).catch(function (e) { toast(e.message, 'err'); });
}
function delProduct(id) { if (!confirm('Delete this product permanently?')) return; API.call('DELETE', '/products/' + id).then(function () { toast('Product deleted'); route(); }); }
function adminOrders() {
  return API.call('GET', '/admin/orders').then(function (d) {
    app.innerHTML = '<h2>Manage Orders</h2>' + adminTabs('orders') + (d.orders.length ? '<div class="tw"><table><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr>' + d.orders.map(function (o) {
      var sel = o.status === 'Cancelled' ? stBadge('Cancelled') : '<select onchange="setStatus(' + o.id + ',this.value)">' + ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'].map(function (s) { return '<option ' + (s === o.status ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select>';
      return '<tr><td><a href="#/order/' + o.id + '" style="color:var(--primary)"><b>#' + o.id + '</b></a><div class="muted" style="font-size:.75rem">' + dt(o.createdAt) + '</div></td><td>' + esc(o.userName) + '<div class="muted" style="font-size:.75rem">' + esc(o.address.city) + '</div></td><td>' + o.items.map(function (i) { return '<span class="chip"><span class="t">' + pic(i) + '</span>×' + i.qty + '</span>'; }).join('') + '</td><td><b>' + money(o.total) + '</b></td><td>' + esc(o.payment) + '<div class="muted" style="font-size:.75rem">' + esc(o.paymentStatus) + '</div></td><td>' + sel + '</td></tr>';
    }).join('') + '</table></div>' : '<div class="card center muted">No orders yet.</div>');
  });
}
function setStatus(id, s) { API.call('PUT', '/admin/orders/' + id + '/status', { status: s }).then(function () { toast('Order #' + id + ' → ' + s); route(); }).catch(function (e) { toast(e.message, 'err'); route(); }); }
function adminUsers() {
  return API.call('GET', '/admin/users').then(function (d) {
    app.innerHTML = '<h2>Users</h2>' + adminTabs('users') + '<div class="tw"><table><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Orders</th><th>Joined</th></tr>' + d.users.map(function (u) { return '<tr><td>' + u.id + '</td><td>' + esc(u.name) + '</td><td>' + esc(u.email) + '</td><td><span class="tag">' + u.role + '</span></td><td>' + u.orders + '</td><td>' + dt(u.createdAt) + '</td></tr>'; }).join('') + '</table></div>';
  });
}

/* ----- start ----- */
(function init() {
  var go = function () { nav(); route(); };
  if (!API.token) return go();
  API.call('GET', '/auth/me').then(function (d) { ME = d.user; return refreshMeta(); }).catch(function () { API.token = ''; localStorage.removeItem('nexacart_token'); ME = null; }).then(go);
})();
</script></body></html>`;