require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Render போன்ற proxy-க்குப் பின்னால் சரியான IP கிடைக்க
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

// --- அட்மின் லாகின் அமைப்புகள் ---
// கடவுச்சொல்லை கோடில் எழுதக் கூடாது. Render > Environment-ல் இவற்றை அமைக்கவும்.
const ADMIN_USER = process.env.ADMIN_USERNAME;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;
if (!ADMIN_USER || !ADMIN_PASS) {
  console.error("ADMIN_USERNAME மற்றும் ADMIN_PASSWORD environment variables அமைக்கப்படவில்லை. சர்வர் நிறுத்தப்படுகிறது.");
  process.exit(1);
}

const AUTH_COOKIE_NAME = "royal_admin_token";
const SESSION_MS = 24 * 60 * 60 * 1000; // 24 மணி நேரம்
const sessions = new Map(); // token -> காலாவதி நேரம்

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function isAuth(req) {
  const token = getCookie(req, AUTH_COOKIE_NAME);
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function cookieFlags(req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Strict${secure}`;
}

// லாகின் முயற்சிகளைக் கட்டுப்படுத்த (15 நிமிடத்தில் 5 முறை மட்டும்)
const loginAttempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isBlocked(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec) return false;
  if (rec.resetAt < Date.now()) {
    loginAttempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec || rec.resetAt < Date.now()) {
    loginAttempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

// MongoDB இணைப்பு
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB வெற்றிகரமாக இணைக்கப்பட்டது! 🎉"))
  .catch((err) => console.log("MongoDB இணைப்பில் பிழை:", err));

// 1. தயாரிப்புகள் Schema
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number,
  category: String,
  image: String,
  weights: [{ weight: String, price: Number }]
});
const Product = mongoose.model('Product', productSchema);

// 2. ஆர்டர்கள் Schema
const orderSchema = new mongoose.Schema({
  customerName: String,
  phone: String,
  address: String,
  items: [{
    name: String,
    weight: String,
    price: Number,
    qty: Number
  }],
  totalAmount: Number,
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

const ORDER_STATUSES = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];

// வரும் தயாரிப்புத் தகவலைச் சுத்தம் செய்ய
function cleanProduct(p) {
  p = p || {};
  return {
    name: String(p.name || '').trim(),
    price: Number(p.price) || 0,
    stock: Number(p.stock) || 0,
    category: String(p.category || ''),
    image: String(p.image || ''),
    weights: Array.isArray(p.weights)
      ? p.weights
          .filter(w => w && w.weight && Number(w.price) >= 0)
          .map(w => ({ weight: String(w.weight), price: Number(w.price) }))
      : []
  };
}

// --- பக்கங்கள் (Pages) ---
app.get('/', (req, res) => res.sendFile(__dirname + '/store.html'));
app.get('/shop', (req, res) => res.sendFile(__dirname + '/shop.html'));

// Render-ஐ விழித்திருக்க வைக்க (UptimeRobot போன்றவற்றில் இந்த முகவரியைப் பயன்படுத்தலாம்)
app.get('/healthz', (req, res) => res.send('ok'));

// அட்மின் லாகின் & வெளியேறுதல்
app.get('/admin/login', (req, res) => {
  if (isAuth(req)) return res.redirect('/admin');
  res.sendFile(__dirname + '/login.html');
});

app.post('/admin/login', (req, res) => {
  const ip = req.ip;
  if (isBlocked(ip)) {
    return res.status(429).json({ success: false, message: "அதிக முயற்சிகள். 15 நிமிடம் கழித்து முயற்சிக்கவும்." });
  }

  const { username, password } = req.body || {};
  const userOk = safeEqual(username ?? '', ADMIN_USER);
  const passOk = safeEqual(password ?? '', ADMIN_PASS);

  if (userOk && passOk) {
    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_MS);
    res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${token}; ${cookieFlags(req)}; Max-Age=${SESSION_MS / 1000}`);
    return res.json({ success: true });
  }

  recordFailure(ip);
  res.status(401).json({ success: false, message: "தவறான பயனர் பெயர் அல்லது கடவுச்சொல்" });
});

app.get('/admin/logout', (req, res) => {
  const token = getCookie(req, AUTH_COOKIE_NAME);
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; ${cookieFlags(req)}; Max-Age=0`);
  res.redirect('/admin/login');
});

// பாதுகாக்கப்பட்ட அட்மின் பக்கம்
app.get('/admin', (req, res) => {
  if (!isAuth(req)) return res.redirect('/admin/login');
  res.sendFile(__dirname + '/index.html');
});

// --- ஆர்டர் API வசதிகள் ---
// வாடிக்கையாளர் ஆர்டரைச் சேமிக்க (பொதுவானது).
// விலைகள் சர்வரிலுள்ள தயாரிப்பு விலைகளிலிருந்தே கணக்கிடப்படும்; வாடிக்கையாளர் அனுப்பும் விலை நம்பப்படாது.
app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, phone, address, items } = req.body || {};

    const name = String(customerName || '').trim().slice(0, 100);
    const ph = String(phone || '').replace(/\D/g, '').slice(-10);
    const addr = String(address || '').trim().slice(0, 500);

    if (!name || ph.length !== 10 || !addr) {
      return res.status(400).json({ error: "பெயர், 10 இலக்க மொபைல் எண், முகவரி தேவை." });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ error: "கூடை காலியாக உள்ளது அல்லது பொருட்கள் அதிகம்." });
    }

    const names = items.map(i => String((i && i.name) || ''));
    const products = await Product.find({ name: { $in: names } });
    const byName = new Map(products.map(p => [p.name, p]));

    const cleanItems = [];
    let total = 0;

    for (const it of items) {
      const product = byName.get(String((it && it.name) || ''));
      if (!product) {
        return res.status(400).json({ error: `பொருள் கிடைக்கவில்லை: ${it && it.name}` });
      }

      const qty = Math.floor(Number(it.qty));
      if (!(qty >= 1 && qty <= 100)) {
        return res.status(400).json({ error: "தவறான எண்ணிக்கை." });
      }

      const weight = String(it.weight || '').slice(0, 30);
      let price = product.price;
      // எடை விருப்பங்கள் உள்ள பொருளுக்கு மட்டுமே எடையைச் சரிபார்க்கிறோம்
      if (product.weights && product.weights.length > 0) {
        const w = product.weights.find(x => x.weight === weight);
        if (!w) {
          return res.status(400).json({ error: `தவறான எடை: ${weight}` });
        }
        price = w.price;
      }

      cleanItems.push({ name: product.name, weight, price, qty });
      total += price * qty;
    }

    const newOrder = new Order({
      customerName: name,
      phone: ph,
      address: addr,
      items: cleanItems,
      totalAmount: total
    });
    await newOrder.save();
    res.json({ success: true, orderId: newOrder._id, totalAmount: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ஆர்டரைச் சேமிக்க முடியவில்லை." });
  }
});

// அட்மினில் ஆர்டர்களைப் பார்க்க (பாதுகாக்கப்பட்டது)
app.get('/api/orders', async (req, res) => {
  if (!isAuth(req)) return res.status(401).json({ error: "அனுமதி இல்லை. உள்நுழையவும்." });
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ஆர்டர்களை எடுக்க முடியவில்லை." });
  }
});

// ஆர்டர் நிலையை மாற்ற (Pending -> Dispatched -> Delivered)
app.put('/api/orders/:id/status', async (req, res) => {
  if (!isAuth(req)) return res.status(401).json({ error: "அனுமதி இல்லை" });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "தவறான ஐடி" });
  if (!ORDER_STATUSES.includes(req.body && req.body.status)) {
    return res.status(400).json({ error: "தவறான நிலை" });
  }
  try {
    await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "நிலையை மாற்ற முடியவில்லை." });
  }
});

// --- தயாரிப்புகள் API வசதிகள் ---
app.post('/add-product-dynamic', async (req, res) => {
  if (!isAuth(req)) return res.status(401).send("அனுமதி இல்லை");

  try {
    let weightsArray = [];
    if (req.body.weight1 && req.body.price1) weightsArray.push({ weight: req.body.weight1, price: Number(req.body.price1) });
    if (req.body.weight2 && req.body.price2) weightsArray.push({ weight: req.body.weight2, price: Number(req.body.price2) });
    if (req.body.weight3 && req.body.price3) weightsArray.push({ weight: req.body.weight3, price: Number(req.body.price3) });

    const finalPrice = req.body.price
      ? Number(req.body.price)
      : (weightsArray.length > 0 ? weightsArray[0].price : 0);

    const newProduct = new Product({
      name: String(req.body.name || '').trim(),
      price: finalPrice,
      stock: Number(req.body.stock) || 0,
      category: req.body.category,
      image: req.body.image,
      weights: weightsArray
    });

    await newProduct.save();
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send("பொருளைச் சேர்க்க முடியவில்லை.");
  }
});

app.post('/bulk-add-products', async (req, res) => {
  if (!isAuth(req)) return res.status(401).json({ error: "அனுமதி இல்லை" });

  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "பொருட்கள் எதுவும் கிடைக்கவில்லை" });
    }
    const productsList = req.body.map(cleanProduct).filter(p => p.name);
    if (productsList.length === 0) {
      return res.status(400).json({ error: "சரியான பொருட்கள் இல்லை" });
    }
    await Product.insertMany(productsList);
    res.json({ success: true, count: productsList.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "பொருட்களைச் சேர்க்க முடியவில்லை." });
  }
});

// 'undefined' / வெற்றுப் பெயருள்ள பொருட்களை நீக்க
async function deleteUndefinedHandler(req, res) {
  if (!isAuth(req)) return res.status(401).json({ error: "அனுமதி இல்லை" });
  try {
    await Product.deleteMany({
      $or: [{ name: 'undefined' }, { name: null }, { name: '' }]
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "நீக்க முடியவில்லை." });
  }
}
app.get('/delete-undefined', deleteUndefinedHandler);    // பழைய அட்மின் பக்கம் வேலை செய்ய
app.delete('/delete-undefined', deleteUndefinedHandler); // புதிய, பாதுகாப்பான முறை

app.get('/products', async (req, res) => {
  try {
    const allProducts = await Product.find();
    res.json(allProducts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "பொருட்களை எடுக்க முடியவில்லை." });
  }
});

// பொருளை நீக்க
async function deleteProductHandler(req, res) {
  if (!isAuth(req)) return res.status(401).send("அனுமதி இல்லை");
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).send("தவறான ஐடி");
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.send('பொருள் வெற்றிகரமாக அழிக்கப்பட்டது');
  } catch (err) {
    console.error(err);
    res.status(500).send("பொருளை நீக்க முடியவில்லை.");
  }
}
app.get('/delete-product/:id', deleteProductHandler);    // பழைய அட்மின் பக்கம் வேலை செய்ய
app.delete('/delete-product/:id', deleteProductHandler); // புதிய, பாதுகாப்பான முறை

app.put('/update-product/:id', async (req, res) => {
  if (!isAuth(req)) return res.status(401).json({ error: "அனுமதி இல்லை" });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "தவறான ஐடி" });

  try {
    const updateData = {
      name: String(req.body.name || '').trim(),
      category: req.body.category,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      image: req.body.image
    };

    if (Array.isArray(req.body.weights)) {
      updateData.weights = req.body.weights
        .filter(w => w && w.weight)
        .map(w => ({ weight: String(w.weight), price: Number(w.price) }));
    }

    await Product.findByIdAndUpdate(req.params.id, updateData);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "பொருளைப் புதுப்பிக்க முடியவில்லை." });
  }
});

app.listen(PORT, () => {
  console.log(`சர்வர் வெற்றிகரமாக http://localhost:${PORT} -ல் இயங்குகிறது`);
});
