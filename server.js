require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

// --- அட்மின் லாகின் விவரங்கள் (தேவைப்பட்டால் மாற்றிக்கொள்ளலாம்) ---
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "royal2026";
const AUTH_COOKIE_NAME = "royal_admin_token";
const AUTH_COOKIE_VAL = "secure_royal_token_session_2026";

// Cookie-யை வாசிக்கும் எளிய Helper
function isAuth(req) {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader.includes(`${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VAL}`);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB வெற்றிகரமாக இணைக்கப்பட்டது! 🎉"))
  .catch((err) => console.log("MongoDB இணைப்பில் பிழை:", err));

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number,
  category: String,
  image: String,
  weights: [{ weight: String, price: Number }]
});
const Product = mongoose.model('Product', productSchema);

// --- பொதுவான பக்கங்கள் ---
app.get('/', (req, res) => res.sendFile(__dirname + '/store.html'));
app.get('/shop', (req, res) => res.sendFile(__dirname + '/shop.html'));

// --- அட்மின் லாகின் பக்கங்கள் & பாதுகாப்பு ---
app.get('/admin/login', (req, res) => {
  if (isAuth(req)) return res.redirect('/admin');
  res.sendFile(__dirname + '/login.html');
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // 24 மணி நேரத்திற்கு செல்லுபடியாகும் பாதுகாப்பான Cookie
    res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VAL}; Path=/; HttpOnly; Max-Age=86400`);
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: "தவறான பயனர் பெயர் அல்லது கடவுச்சொல்" });
});

app.get('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
  res.redirect('/admin/login');
});

// அட்மின் பக்கத்தை பூட்டுதல் (பாதுகாப்பு)
app.get('/admin', (req, res) => {
  if (!isAuth(req)) {
    return res.redirect('/admin/login');
  }
  res.sendFile(__dirname + '/index.html');
});

// புதிய பொருளைச் சேர்க்க
app.post('/add-product-dynamic', async (req, res) => {
  if (!isAuth(req)) return res.status(401).send("அனுமதி இல்லை. உள்நுழையவும்.");

  try {
    let weightsArray = [];
    if (req.body.weight1 && req.body.price1) weightsArray.push({ weight: req.body.weight1, price: Number(req.body.price1) });
    if (req.body.weight2 && req.body.price2) weightsArray.push({ weight: req.body.weight2, price: Number(req.body.price2) });
    if (req.body.weight3 && req.body.price3) weightsArray.push({ weight: req.body.weight3, price: Number(req.body.price3) });

    const finalPrice = req.body.price 
      ? Number(req.body.price) 
      : (weightsArray.length > 0 ? weightsArray[0].price : 0);

    const newProduct = new Product({
      name: req.body.name,
      price: finalPrice,
      stock: Number(req.body.stock) || 0,
      category: req.body.category,
      image: req.body.image,
      weights: weightsArray
    });

    await newProduct.save();
    res.redirect('/admin'); 
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

// CSV Bulk Upload (அட்மின் பாதுகாப்புடன்)
app.post('/bulk-add-products', async (req, res) => {
  if (!isAuth(req)) return res.status(401).json({ error: "அனுமதி இல்லை" });

  try {
    const productsList = req.body;
    if (!Array.isArray(productsList) || productsList.length === 0) {
      return res.status(400).json({ error: "பொருட்கள் எதுவும் கிடைக்கவில்லை" });
    }
    await Product.insertMany(productsList);
    res.json({ success: true, count: productsList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Undefined பொருட்களை நீக்க
app.get('/delete-undefined', async (req, res) => {
  if (!isAuth(req)) return res.status(401).json({ error: "அனுமதி இல்லை" });

  try {
    await Product.deleteMany({
      $or: [{ name: 'undefined' }, { name: null }, { name: '' }]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/products', async (req, res) => {
  try {
    const allProducts = await Product.find();
    res.json(allProducts);
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

app.get('/delete-product/:id', async (req, res) => {
  if (!isAuth(req)) return res.status(401).send("அனுமதி இல்லை");

  try {
    await Product.findByIdAndDelete(req.params.id);
    res.send('பொருள் வெற்றிகரமாக அழிக்கப்பட்டது');
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

app.put('/update-product/:id', async (req, res) => {
  if (!isAuth(req)) return res.status(401).json({ error: "அனுமதி இல்லை" });

  try {
    const updateData = {
      name: req.body.name,
      category: req.body.category,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      image: req.body.image
    };

    if (Array.isArray(req.body.weights)) {
      updateData.weights = req.body.weights;
    }

    await Product.findByIdAndUpdate(req.params.id, updateData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`சர்வர் வெற்றிகரமாக http://localhost:${PORT} -ல் இயங்குகிறது`);
});