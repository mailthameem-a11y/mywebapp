require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 

// MongoDB இணைப்பு
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB வெற்றிகரமாக இணைக்கப்பட்டது! 🎉"))
  .catch((err) => console.log("MongoDB இணைப்பில் பிழை:", err));

// Product Schema (இதில் Category புதிதாகச் சேர்க்கப்பட்டுள்ளது)
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number,
  category: String 
});
const Product = mongoose.model('Product', productSchema);

// 1. வாடிக்கையாளர் பக்கம்
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/store.html');
});

// 2. அட்மின் பேனல்
app.get('/shop', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// 3. புதிய பொருளைச் சேர்ப்பதற்கான Route
app.post('/add-product-dynamic', async (req, res) => {
  try {
    const newProduct = new Product({
      name: req.body.name,
      price: req.body.price,
      stock: req.body.stock,
      category: req.body.category // ஃபார்மில் இருந்து Category-ஐ எடுக்கும்
    });
    await newProduct.save();
    res.redirect('/shop'); 
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

// 4. டேட்டாபேஸிலிருந்து தகவல்களை எடுத்துப் பார்த்தல்
app.get('/products', async (req, res) => {
  try {
    const allProducts = await Product.find();
    res.json(allProducts);
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

// 5. ஒரு பொருளை அழித்தல்
app.get('/delete-product/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.send('பொருள் வெற்றிகரமாக அழிக்கப்பட்டது');
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

// 6. ஒரு பொருளை அப்டேட் செய்தல்
app.put('/update-product/:id', async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, {
      price: req.body.price,
      stock: req.body.stock
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`சர்வர் வெற்றிகரமாக http://localhost:${PORT} -ல் இயங்குகிறது`);
});