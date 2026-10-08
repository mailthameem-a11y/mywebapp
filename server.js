require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB வெற்றிகரமாக இணைக்கப்பட்டது! 🎉"))
  .catch((err) => console.log("MongoDB இணைப்பில் பிழை:", err));

// Product Schema (இதில் weights புதிதாகச் சேர்க்கப்பட்டுள்ளது)
const productSchema = new mongoose.Schema({
  name: String,
  price: Number, // இது Default (குறைந்தபட்ச) விலை
  stock: Number,
  category: String,
  image: String,
  weights: [{ weight: String, price: Number }] // எ.கா: [{weight: '250g', price: 300}, {weight: '500g', price: 600}]
});
const Product = mongoose.model('Product', productSchema);

app.get('/', (req, res) => res.sendFile(__dirname + '/store.html'));
app.get('/shop', (req, res) => res.sendFile(__dirname + '/shop.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/index.html'));

app.post('/add-product-dynamic', async (req, res) => {
  try {
    // அட்மின் பேனலில் இருந்து வரும் எடைகளை பிரித்தெடுத்தல்
    let weightsArray = [];
    if (req.body.weight1 && req.body.price1) weightsArray.push({ weight: req.body.weight1, price: Number(req.body.price1) });
    if (req.body.weight2 && req.body.price2) weightsArray.push({ weight: req.body.weight2, price: Number(req.body.price2) });
    if (req.body.weight3 && req.body.price3) weightsArray.push({ weight: req.body.weight3, price: Number(req.body.price3) });

    // Default விலையாக முதல் எடையின் விலையை செட் செய்கிறோம்
    const defaultPrice = weightsArray.length > 0 ? weightsArray[0].price : req.body.price;

    const newProduct = new Product({
      name: req.body.name,
      price: defaultPrice,
      stock: req.body.stock,
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
      price: req.body.price,
      stock: req.body.stock,
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