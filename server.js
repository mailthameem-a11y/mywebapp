require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // JSON டேட்டாவைப் படிக்க இது அவசியம்

// MongoDB உடன் இணைத்தல்
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB வெற்றிகரமாக இணைக்கப்பட்டது! 🎉"))
  .catch((err) => console.log("MongoDB இணைப்பில் பிழை:", err));

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number
});
const Product = mongoose.model('Product', productSchema);

// 1. வாடிக்கையாளர் பக்கம் (Customer Storefront) - இது உங்களின் நேரடி டொமைனில் வரும்
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/store.html');
});

// 2. அட்மின் பேனல் (Admin Dashboard) - இது /shop என்று தட்டச்சு செய்தால் வரும்
app.get('/shop', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// 3. புதிய பொருளைச் சேர்ப்பதற்கான Route
app.post('/add-product-dynamic', async (req, res) => {
  try {
    const newProduct = new Product({
      name: req.body.name,
      price: req.body.price,
      stock: req.body.stock
    });
    await newProduct.save();
    // சேமித்தவுடன் அட்மின் பேனலுக்கே திரும்பச் செல்லும்
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

// 5. டேட்டாபேஸிலிருந்து ஒரு பொருளை அழித்தல்
app.get('/delete-product/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.send('பொருள் வெற்றிகரமாக அழிக்கப்பட்டது');
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

// 6. பொருளின் தகவல்களை மாற்றுவதற்கான Route (Update)
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