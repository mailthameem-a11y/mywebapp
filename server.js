require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' })); 

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

app.get('/', (req, res) => res.sendFile(__dirname + '/store.html'));
app.get('/shop', (req, res) => res.sendFile(__dirname + '/shop.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/index.html'));

// தனித்தனியாக ஒரு பொருளைச் சேர்க்க
app.post('/add-product-dynamic', async (req, res) => {
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

// CSV மூலமாக மொத்தப் பொருட்களைச் சேர்க்க (Bulk Upload)
app.post('/bulk-add-products', async (req, res) => {
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

// தவறாக உருவான Undefined பொருட்களை மட்டும் நீக்க
app.get('/delete-undefined', async (req, res) => {
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
      name: req.body.name,
      category: req.body.category,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      image: req.body.image
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`சர்வர் வெற்றிகரமாக http://localhost:${PORT} -ல் இயங்குகிறது`);
});