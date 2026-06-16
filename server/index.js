require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
app.use(cors());

// Support larger payload sizes for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static images directory
app.use('/images', express.static(path.join(__dirname, '../public/images')));

const DB_FILE = path.join(__dirname, './data/db.json');

// --- DATABASE LOGIC ---
let memoryDb = null;

const dbSchema = new mongoose.Schema({
  _id: { type: String, default: 'appData' },
  settings: Object,
  products: Array,
  orders: Array,
  logs: Array
});
const AppData = mongoose.model('AppData', dbSchema);

const initDB = async () => {
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('Connected to MongoDB');
      memoryDb = await AppData.findById('appData').lean();
      if (!memoryDb) {
        memoryDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        await AppData.create({ _id: 'appData', ...memoryDb });
      }
    } catch (err) {
      console.error('Failed to connect to MongoDB, falling back to local file', err);
      memoryDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } else {
    memoryDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
};

const readDB = () => memoryDb;
const writeDB = async (data) => {
  memoryDb = data;
  if (process.env.MONGO_URI && mongoose.connection.readyState === 1) {
    try {
      await AppData.findByIdAndUpdate('appData', data);
    } catch (err) {
      console.error('Failed to save to MongoDB', err);
    }
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }
};
// --- END DATABASE LOGIC ---

// Helper to write system logs
const addSystemLog = async (action, details) => {
  try {
    const db = readDB();
    const newLog = {
      id: `LOG-${Date.now()}`,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    db.logs = db.logs || [];
    db.logs.unshift(newLog); // Put new log at the top
    await writeDB(db);
  } catch (error) {
    console.error('Error adding system log:', error);
  }
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '12h' });
    await addSystemLog('Admin Logged In', 'Admin logged into the dashboard successfully.');
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// GET settings
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(db.settings);
});

// PUT settings
app.put('/api/settings', authenticateToken, async (req, res) => {
  const db = readDB();
  const oldSettings = db.settings;
  db.settings = { ...db.settings, ...req.body };
  await writeDB(db);
  
  // Custom log messages for state changes
  if (oldSettings.isOpen !== db.settings.isOpen) {
    const state = db.settings.isOpen ? 'OPENED' : 'CLOSED';
    await addSystemLog('Store Status Changed', `Admin changed store status to ${state}.`);
  } else {
    await addSystemLog('Settings Updated', 'Admin updated store settings.');
  }

  res.json(db.settings);
});

// GET products
app.get('/api/products', (req, res) => {
  const db = readDB();
  res.json(db.products);
});

// POST product
app.post('/api/products', authenticateToken, async (req, res) => {
  const db = readDB();
  const newProduct = { ...req.body, id: Date.now().toString() };
  db.products.push(newProduct);
  await writeDB(db);
  await addSystemLog('Product Added', `Admin added a new product: "${newProduct.name}" (₹${newProduct.price}).`);
  res.status(201).json(newProduct);
});

// PUT product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  const db = readDB();
  const index = db.products.findIndex(p => p.id === req.params.id);
  if (index !== -1) {
    const oldProduct = db.products[index];
    db.products[index] = { ...req.body, id: req.params.id };
    await writeDB(db);
    await addSystemLog('Product Updated', `Admin updated product details for: "${req.body.name}" (ID: ${req.params.id}).`);
    res.json(db.products[index]);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// DELETE product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  const db = readDB();
  const product = db.products.find(p => p.id === req.params.id);
  const name = product ? product.name : req.params.id;
  db.products = db.products.filter(p => p.id !== req.params.id);
  await writeDB(db);
  await addSystemLog('Product Deleted', `Admin deleted product: "${name}" (ID: ${req.params.id}).`);
  res.sendStatus(204);
});

// --- NEW ENDPOINTS: IMAGE UPLOAD, ORDERS, LOGS ---

// POST Upload Image
app.post('/api/upload', authenticateToken, async (req, res) => {
  const { filename, base64 } = req.body;
  if (!filename || !base64) {
    return res.status(400).json({ error: 'Missing filename or base64 data' });
  }

  try {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const cleanName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const imagesDir = path.join(__dirname, '../public/images');
    
    if (!fs.existsSync(imagesDir)){
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(imagesDir, cleanName), buffer);
    await addSystemLog('Image Uploaded', `Admin uploaded an image: ${cleanName}`);
    res.json({ imageUrl: `/images/${cleanName}` });
  } catch (error) {
    console.error('Error saving uploaded image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// GET Orders
app.get('/api/orders', authenticateToken, (req, res) => {
  const db = readDB();
  res.json(db.orders || []);
});

// POST Order (Customer checkout - public)
app.post('/api/orders', async (req, res) => {
  const db = readDB();
  db.orders = db.orders || [];
  
  const newOrder = {
    ...req.body,
    id: `ORD-${Date.now()}`,
    status: 'Pending',
    createdAt: new Date().toISOString()
  };
  
  db.orders.push(newOrder);
  await writeDB(db);
  
  await addSystemLog('Order Placed', `New order ${newOrder.id} placed by ${newOrder.customerName} for ₹${newOrder.totalAmount}.`);
  
  res.status(201).json(newOrder);
});

// PUT Order (Update status/details - auth required)
app.put('/api/orders/:id', authenticateToken, async (req, res) => {
  const db = readDB();
  db.orders = db.orders || [];
  const index = db.orders.findIndex(o => o.id === req.params.id);
  
  if (index !== -1) {
    const oldOrder = db.orders[index];
    db.orders[index] = { ...oldOrder, ...req.body, id: req.params.id };
    await writeDB(db);
    
    if (oldOrder.status !== db.orders[index].status) {
      await addSystemLog('Order Status Updated', `Order ${req.params.id} marked as ${db.orders[index].status} by Admin.`);
    } else {
      await addSystemLog('Order Updated', `Admin updated details for order ${req.params.id}.`);
    }
    
    res.json(db.orders[index]);
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// GET Logs
app.get('/api/logs', authenticateToken, (req, res) => {
  const db = readDB();
  res.json(db.logs || []);
});

// POST Log (Add Manual Log Entry)
app.post('/api/logs', authenticateToken, async (req, res) => {
  const { action, details } = req.body;
  if (!action || !details) {
    return res.status(400).json({ error: 'Missing action or details' });
  }
  
  await addSystemLog(`[Manual] ${action}`, details);
  const db = readDB();
  res.status(201).json(db.logs[0]);
});

// DELETE Reset Dashboard (Clear orders and logs)
app.delete('/api/reset', authenticateToken, async (req, res) => {
  const db = readDB();
  db.orders = [];
  db.logs = [];
  await writeDB(db);
  await addSystemLog('Dashboard Reset', 'Admin reset the dashboard. Cleared all orders and logs.');
  const updatedDb = readDB(); // To get the log we just added
  res.json({ logs: updatedDb.logs, orders: updatedDb.orders });
});

const PORT = process.env.PORT || 3001;

// Start server after DB initialization
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize DB", err);
});
