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

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number,
  category: String 
});
const Product = mongoose.model('Product', productSchema);

// 1. முகப்புப் பக்கம் (Home Page)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/store.html');
});

// 2. புதிய ஷாப் பக்கம் (Customer Shop Page with Filters)
app.get('/shop', (req, res) => {
  res.sendFile(__dirname + '/shop.html');
});

// 3. அட்மின் பேனல் (Admin Dashboard) - URL இனி /admin என்று இருக்கும்
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// புதிய பொருளைச் சேர்ப்பதற்கான Route
app.post('/add-product-dynamic', async (req, res) => {
  try {
    const newProduct = new Product({
      name: req.body.name,
      price: req.body.price,
      stock: req.body.stock,
      category: req.body.category
    });
    await newProduct.save();
    res.redirect('/admin'); // சேமித்ததும் அட்மின் பேனலுக்கே திரும்பும்
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

// டேட்டாபேஸிலிருந்து தகவல்களை எடுப்பது
app.get('/products', async (req, res) => {
  try {
    const allProducts = await Product.find();
    res.json(allProducts);
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

app.get('/delete-product/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.send('பொருள் வெற்றிகரமாக அழிக்கப்பட்டது');
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

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