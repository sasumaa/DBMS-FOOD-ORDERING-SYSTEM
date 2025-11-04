const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'demo_secret_key';

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'food_ordering',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Online Food Ordering API' });
});

// Auth helpers
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
}
function requireAuth(role) {
  return (req, res, next) => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = jwt.verify(token, JWT_SECRET);
      if (role && decoded.role !== role) return res.status(403).json({ error: 'Forbidden' });
      req.user = decoded;
      next();
    } catch (e) { res.status(401).json({ error: 'Unauthorized' }); }
  };
}

// Auth endpoints
app.post('/auth/customer-login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await pool.query('SELECT user_id, name, email FROM Users WHERE email=? AND password=?', [email, password]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const token = signToken({ role: 'customer', user_id: user.user_id, email: user.email, name: user.name });
    res.json({ token, user });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

// Customer signup
app.post('/auth/customer-signup', async (req, res) => {
  const { name, email, phone, address, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [exists] = await conn.query('SELECT user_id FROM Users WHERE email=?', [email]);
      if (exists.length) {
        await conn.rollback();
        return res.status(409).json({ error: 'Email already registered' });
      }
      const [[{ maxUser }]] = await conn.query('SELECT COALESCE(MAX(user_id),0) AS maxUser FROM Users');
      const newId = Number(maxUser) + 1;
      await conn.query(
        'INSERT INTO Users (user_id, name, email, phone, address, password) VALUES (?, ?, ?, ?, ?, ?)',
        [newId, name, email, phone || null, address || null, password]
      );
      await conn.commit();
      const token = signToken({ role: 'customer', user_id: newId, email, name });
      res.json({ token, user: { user_id: newId, name, email } });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Customer signup failed:', e);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/auth/partner-login', async (req, res) => {
  const { partner_id, password } = req.body || {};
  if (!partner_id || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await pool.query('SELECT partner_id, name FROM Delivery_Partners WHERE partner_id=? AND password=?', [partner_id, password]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const partner = rows[0];
    const token = signToken({ role: 'partner', partner_id: partner.partner_id, name: partner.name });
    res.json({ token, partner });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

// Partner signup
app.post('/auth/partner-signup', async (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !password) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[{ maxId }]] = await conn.query('SELECT COALESCE(MAX(partner_id),0) AS maxId FROM Delivery_Partners');
      const newId = Number(maxId) + 1;
      await conn.query('INSERT INTO Delivery_Partners (partner_id, name, phone, password) VALUES (?, ?, ?, ?)', [newId, name, phone || null, password]);
      await conn.commit();
      const token = signToken({ role: 'partner', partner_id: newId, name });
      res.json({ token, partner: { partner_id: newId, name } });
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
  } catch (e) { res.status(500).json({ error: 'Signup failed' }); }
});

app.post('/auth/restaurant-login', async (req, res) => {
  const { restaurant_id, password } = req.body || {};
  if (!restaurant_id || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await pool.query('SELECT restaurant_id, name FROM Restaurants WHERE restaurant_id=? AND password=?', [restaurant_id, password]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const r = rows[0];
    const token = signToken({ role: 'restaurant', restaurant_id: r.restaurant_id, name: r.name });
    res.json({ token, restaurant: r });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

// Restaurant signup
app.post('/auth/restaurant-signup', async (req, res) => {
  const { name, address, password } = req.body || {};
  if (!name || !address || !password) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[{ maxId }]] = await conn.query('SELECT COALESCE(MAX(restaurant_id),0) AS maxId FROM Restaurants');
      const newId = Number(maxId) + 1;
      await conn.query('INSERT INTO Restaurants (restaurant_id, name, address, password) VALUES (?, ?, ?, ?)', [newId, name, address, password]);
      await conn.commit();
      const token = signToken({ role: 'restaurant', restaurant_id: newId, name });
      res.json({ token, restaurant: { restaurant_id: newId, name } });
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
  } catch (e) { console.error('Restaurant signup failed:', e); res.status(500).json({ error: 'Signup failed' }); }
});

// List all restaurants
app.get('/restaurants', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Restaurants ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch restaurants', details: err.message });
  }
});

// Create restaurant
app.post('/restaurants', async (req, res) => {
  const { name, address } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Name and address are required' });
  try {
    // Simple id generation for demo: max+1
    const [[{ maxId }]] = await pool.query('SELECT COALESCE(MAX(restaurant_id),0) AS maxId FROM Restaurants');
    const newId = Number(maxId) + 1;
    await pool.query('INSERT INTO Restaurants (restaurant_id, name, address) VALUES (?, ?, ?)', [newId, name, address]);
    res.json({ success: true, restaurant_id: newId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create restaurant', details: err.message });
  }
});

// Update restaurant
app.put('/restaurants/:id', async (req, res) => {
  const { id } = req.params;
  const { name, address, password } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Name and address are required' });
  try {
    const [result] = await pool.query(
      password ? 'UPDATE Restaurants SET name = ?, address = ?, password = ? WHERE restaurant_id = ?'
               : 'UPDATE Restaurants SET name = ?, address = ? WHERE restaurant_id = ?',
      password ? [name, address, password, id] : [name, address, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Restaurant not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update restaurant', details: err.message });
  }
});

// Delete restaurant
app.delete('/restaurants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM Restaurants WHERE restaurant_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Restaurant not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete restaurant', details: err.message });
  }
});

// List users (for dropdown)
app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Users ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Get menu for a restaurant
app.get('/menu/:restaurant_id', async (req, res) => {
  const { restaurant_id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM Food_Items WHERE restaurant_id = ? AND quantity > 0 ORDER BY item_name',
      [restaurant_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu', details: err.message });
  }
});

// List delivery partners
app.get('/partners', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Delivery_Partners ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch partners', details: err.message });
  }
});

// Delivery partner: view assigned orders
app.get('/partner-orders/:partner_id', async (req, res) => {
  const { partner_id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT o.order_id, o.quantity, o.total_price, o.order_date, o.status,
             u.name AS user_name, r.name AS restaurant_name, f.item_name
      FROM Orders o
      JOIN Users u ON o.user_id = u.user_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      JOIN Food_Items f ON o.item_id = f.item_id
      WHERE o.partner_id = ?
      ORDER BY o.order_date DESC, o.order_id DESC
    `, [partner_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch partner orders', details: err.message });
  }
});

// Update order status (e.g., Dispatched, Delivered)
app.put('/orders/:order_id/status', async (req, res) => {
  const { order_id } = req.params;
  const { status } = req.body;
  const allowed = ['Placed', 'Dispatched', 'Delivered', 'Cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const [result] = await pool.query('UPDATE Orders SET status = ? WHERE order_id = ?', [status, order_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status', details: err.message });
  }
});

// Place order (calls stored procedure)
app.post('/place-order', requireAuth('customer'), async (req, res) => {
  // Expected body: { restaurant_id, item_id, quantity, user? }
  const { restaurant_id, item_id, quantity, user } = req.body || {};
  if (!restaurant_id || !item_id || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1) Use authenticated customer
      const userId = req.user.user_id;
      // Optional: update profile if provided
      if (user && (user.name || user.phone || user.address)) {
        await conn.query('UPDATE Users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE user_id = ?', [
          user.name || null, user.phone || null, user.address || null, userId
        ]);
      }

      // 2) Auto-assign only partners with ZERO active (undelivered) orders
      const [prow] = await conn.query(`
        SELECT dp.partner_id
        FROM Delivery_Partners dp
        LEFT JOIN (
          SELECT partner_id, COUNT(*) AS active
          FROM Orders
          WHERE status NOT IN ('Delivered','Cancelled')
          GROUP BY partner_id
        ) o ON o.partner_id = dp.partner_id
        WHERE COALESCE(o.active,0) = 0
        ORDER BY dp.partner_id ASC
        LIMIT 1
      `);
      if (!prow.length) {
        await conn.rollback();
        return res.status(503).json({ success: false, error: 'All delivery partners are busy. Please try again later.' });
      }
      const partnerId = prow[0].partner_id;

      // 3) Generate next order_id
      const [[{ maxOrder }]] = await conn.query('SELECT COALESCE(MAX(order_id),0) AS maxOrder FROM Orders');
      const orderId = Number(maxOrder) + 1;

      // 4) Call stored procedure
      await conn.query('CALL Place_Order(?, ?, ?, ?, ?, ?)', [
        orderId, userId, restaurant_id, item_id, quantity, partnerId
      ]);

      await conn.commit();
      res.json({ success: true, message: 'Order placed successfully', order_id: orderId, partner_id: partnerId });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// List all orders with details
app.get('/orders', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.order_id, o.quantity, o.total_price, o.order_date, o.status,
             u.name AS user_name, r.name AS restaurant_name,
             f.item_name, dp.name AS partner_name
      FROM Orders o
      JOIN Users u ON o.user_id = u.user_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      JOIN Food_Items f ON o.item_id = f.item_id
      JOIN Delivery_Partners dp ON o.partner_id = dp.partner_id
      ORDER BY o.order_date DESC, o.order_id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
  }
});

// My orders (customer only)
app.get('/my-orders', requireAuth('customer'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.order_id, o.quantity, o.total_price, o.order_date, o.status,
             r.name AS restaurant_name, f.item_name, dp.name AS partner_name
      FROM Orders o
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      JOIN Food_Items f ON o.item_id = f.item_id
      JOIN Delivery_Partners dp ON o.partner_id = dp.partner_id
      WHERE o.user_id = ?
      ORDER BY o.order_date DESC, o.order_id DESC
    `, [req.user.user_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch my orders' }); }
});

// Partner orders, secured
app.get('/partner/me/orders', requireAuth('partner'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.order_id, o.quantity, o.total_price, o.order_date, o.status,
             u.name AS user_name, r.name AS restaurant_name, f.item_name
      FROM Orders o
      JOIN Users u ON o.user_id = u.user_id
      JOIN Restaurants r ON o.restaurant_id = r.restaurant_id
      JOIN Food_Items f ON o.item_id = f.item_id
      WHERE o.partner_id = ?
      ORDER BY o.order_date DESC, o.order_id DESC
    `, [req.user.partner_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch partner orders' }); }
});

// Restaurant orders, secured
app.get('/restaurant/me/orders', requireAuth('restaurant'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.order_id, o.quantity, o.total_price, o.order_date, o.status,
             u.name AS user_name, f.item_name, dp.name AS partner_name
      FROM Orders o
      JOIN Users u ON o.user_id = u.user_id
      JOIN Food_Items f ON o.item_id = f.item_id
      JOIN Delivery_Partners dp ON o.partner_id = dp.partner_id
      WHERE o.restaurant_id = ?
      ORDER BY o.order_date DESC, o.order_id DESC
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch restaurant orders' }); }
});

// Restaurant menu management (secured)
app.get('/restaurant/me/menu', requireAuth('restaurant'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT item_id, item_name, price, quantity FROM Food_Items WHERE restaurant_id = ? ORDER BY item_name', [req.user.restaurant_id]);
    res.json(rows);
  } catch (e) { console.error('Failed to fetch menu:', e); res.status(500).json({ error: 'Failed to fetch menu' }); }
});

app.post('/restaurant/me/menu', requireAuth('restaurant'), async (req, res) => {
  const { item_name, price, quantity } = req.body || {};
  if (!item_name || price == null || quantity == null) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [[{ maxId }]] = await pool.query('SELECT COALESCE(MAX(item_id),0) AS maxId FROM Food_Items');
    const newId = Number(maxId) + 1;
    await pool.query('INSERT INTO Food_Items (item_id, restaurant_id, item_name, price, quantity) VALUES (?, ?, ?, ?, ?)', [newId, req.user.restaurant_id, item_name, price, quantity]);
    res.json({ success: true, item_id: newId });
  } catch (e) { res.status(500).json({ error: 'Failed to add item' }); }
});

app.put('/restaurant/me/menu/:item_id', requireAuth('restaurant'), async (req, res) => {
  const { item_id } = req.params;
  const { item_name, price, quantity } = req.body || {};
  if (!item_name || price == null || quantity == null) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [result] = await pool.query('UPDATE Food_Items SET item_name = ?, price = ?, quantity = ? WHERE item_id = ? AND restaurant_id = ?', [item_name, price, quantity, item_id, req.user.restaurant_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to update item' }); }
});

app.delete('/restaurant/me/menu/:item_id', requireAuth('restaurant'), async (req, res) => {
  const { item_id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM Food_Items WHERE item_id = ? AND restaurant_id = ?', [item_id, req.user.restaurant_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete item' }); }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


