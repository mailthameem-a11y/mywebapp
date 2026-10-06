require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// ஃபார்ம் (Form) வழியாக வரும் தகவல்களைப் படிக்க இந்தப் புது வரி அவசியம்
app.use(express.urlencoded({ extended: true }));

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

// 1. முகப்புப் பக்கத்தில் ஒரு HTML ஃபார்ம் (Form) காட்டுதல்
app.get('/', (req, res) => {
  res.send(`
    <h2>புதிய பொருளைச் சேர்க்க</h2>
    <form action="/add-product-dynamic" method="POST">
      பொருளின் பெயர்: <input type="text" name="name" required><br><br>
      விலை: <input type="number" name="price" required><br><br>
      ஸ்டாக்: <input type="number" name="stock" required><br><br>
      <button type="submit">டேட்டாபேஸில் சேமி</button>
    </form>
  `);
});

// 2. ஃபார்மில் இருந்து வரும் தகவலைப் பெற்று டேட்டாபேஸில் சேமித்தல் (POST Request)
app.post('/add-product-dynamic', async (req, res) => {
  try {
    // req.body மூலம் ஃபார்மில் பயனர்கள் டைப் செய்த தகவல்களை எடுக்கிறோம்
    const newProduct = new Product({
      name: req.body.name,
      price: req.body.price,
      stock: req.body.stock
    });
    
    await newProduct.save();
    res.redirect('/shop');('<h1>பொருள் வெற்றிகரமாக சேமிக்கப்பட்டது! 🎉 <a href="/products">பட்டியலைப் பார்க்க இங்கே கிளிக் செய்யவும்</a></h1>');
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});

// 3. டேட்டாபேஸிலிருந்து தகவல்களை எடுத்துப் பார்த்தல் (Read Data)
app.get('/products', async (req, res) => {
  try {
    const allProducts = await Product.find();
    res.json(allProducts);
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});
// 4. டேட்டாபேஸிலிருந்து ஒரு பொருளை அழித்தல் (Delete)
// :id என்பது நாம் எந்தப் பொருளை அழிக்கப் போகிறோம் என்பதைக் குறிக்கும் குறியீடு
app.get('/delete-product/:id', async (req, res) => {
  try {
    // findByIdAndDelete என்ற கமாண்ட் டேட்டாபேஸில் அந்த ID-ஐத் தேடி அழித்துவிடும்
    await Product.findByIdAndDelete(req.params.id);
    res.send('<h1>பொருள் வெற்றிகரமாக அழிக்கப்பட்டது! 🗑️ <a href="/products">பட்டியலைப் பார்க்க இங்கே கிளிக் செய்யவும்</a></h1>');
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});
// 5. டேட்டாபேஸிலிருந்து ஒரு பொருளின் விலையை மாற்றுதல் (Update)
app.get('/update-price/:id/:newPrice', async (req, res) => {
  try {
    const productId = req.params.id;         // URL-ல் இருந்து ID-ஐ எடுக்கும்
    const updatedPrice = req.params.newPrice; // URL-ல் இருந்து புதிய விலையை எடுக்கும்
    
    // findByIdAndUpdate மூலம் புதிய விலையை டேட்டாபேஸில் சேமிக்கிறோம்
    await Product.findByIdAndUpdate(productId, { price: updatedPrice });
    
    res.send('<h1>பொருளின் விலை வெற்றிகரமாக மாற்றப்பட்டது! 💰 <a href="/products">பட்டியலைப் பார்க்க இங்கே கிளிக் செய்யவும்</a></h1>');
  } catch (err) {
    res.send("பிழை: " + err.message);
  }
});
// 6. Frontend HTML பக்கத்தைக் காட்டுவதற்கான Route
// வாடிக்கையாளர்களுக்கான முகப்புப் பக்கம் (Customer Storefront)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/store.html');
});
// 7. பொருளின் தகவல்களை மாற்றுவதற்கான Route (Update)
app.put('/update-product/:id', express.json(), async (req, res) => {
  try {
    // டேட்டாபேஸில் புதிய விலை மற்றும் ஸ்டாக்கை அப்டேட் செய்கிறோம்
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