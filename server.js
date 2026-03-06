require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// 1. Connect to MongoDB
// ----------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

// ----------------------
// 2. Database Schemas
// ----------------------
const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number, // in cents
  description: String,
  image: String
});

const OrderSchema = new mongoose.Schema({
  productId: String,
  amount: Number,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model("Product", ProductSchema);
const Order = mongoose.model("Order", OrderSchema);

// ----------------------
// 3. API Routes
// ----------------------

// Get all products
app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Create Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId);

    if (!product) return res.status(400).json({ error: "Product not found" });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: product.name },
            unit_amount: product.price
          },
          quantity: 1
        }
      ],
      success_url: process.env.FRONTEND_URL + '/success.html',
      cancel_url: process.env.FRONTEND_URL + '/cancel.html'
    });

    // Save order in DB
    await Order.create({
      productId,
      amount: product.price,
      status: "pending"
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));