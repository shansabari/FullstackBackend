const express = require('express');
const router = express.Router();
const db = require('../db');

const isAuthenticated = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Please login to continue' });
    next();
};

// Checkout
router.post('/checkout', isAuthenticated, async (req, res) => {
    const { totalAmount, paymentMethod, deliveryAddress, deliveryDate, deliveryTime } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create Order
        const [orderResult] = await connection.execute(
            'INSERT INTO orders (user_id, total_amount, payment_method, delivery_address, delivery_date, delivery_time) VALUES (?, ?, ?, ?, ?, ?)',
            [req.session.userId, totalAmount, paymentMethod, deliveryAddress, deliveryDate, deliveryTime]
        );
        const orderId = orderResult.insertId;

        // 2. Get Cart Items
        const [cartItems] = await connection.execute('SELECT * FROM cart WHERE user_id = ?', [req.session.userId]);

        // 3. Move items to order_items
        for (const item of cartItems) {
            const [product] = await connection.execute('SELECT price FROM products WHERE id = ?', [item.product_id]);
            await connection.execute(
                'INSERT INTO order_items (order_id, product_id, quantity, price, customization) VALUES (?, ?, ?, ?, ?)',
                [orderId, item.product_id, item.quantity, product[0].price, item.customization]
            );
        }

        // 4. Clear Cart
        await connection.execute('DELETE FROM cart WHERE user_id = ?', [req.session.userId]);

        // 5. Create Payment record (if Online, status Pending; if COD, status Pending)
        await connection.execute(
            'INSERT INTO payments (order_id, amount, status) VALUES (?, ?, ?)',
            [orderId, totalAmount, 'Pending']
        );

        await connection.commit();
        res.status(201).json({ message: 'Order placed successfully', orderId });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Get User Orders
router.get('/my-orders', isAuthenticated, async (req, res) => {
    try {
        const [orders] = await db.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Order Details
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const [orders] = await db.execute('SELECT * FROM orders WHERE id = ? AND (user_id = ? OR ? = "admin")', [req.params.id, req.session.userId, req.session.role]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });

        const [items] = await db.execute(
            'SELECT oi.*, p.name, p.image_url FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?',
            [req.params.id]
        );

        res.json({ order: orders[0], items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get All Orders
router.get('/admin/all', async (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    try {
        const [orders] = await db.execute('SELECT o.*, u.full_name as customer_name FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Update Order Status
router.put('/status/:id', async (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const { status } = req.body;
    try {
        await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Order status updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
