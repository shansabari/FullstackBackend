const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to check if logged in
const isAuthenticated = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Please login to continue' });
    next();
};

// Get cart items
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const [items] = await db.execute(
            'SELECT c.*, p.name, p.price, p.image_url FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?',
            [req.session.userId]
        );
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add to cart
router.post('/', isAuthenticated, async (req, res) => {
    const { productId, quantity, customization } = req.body;
    try {
        // Check if item already in cart
        const [existing] = await db.execute(
            'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
            [req.session.userId, productId]
        );

        if (existing.length > 0) {
            await db.execute(
                'UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?',
                [quantity || 1, req.session.userId, productId]
            );
        } else {
            await db.execute(
                'INSERT INTO cart (user_id, product_id, quantity, customization) VALUES (?, ?, ?, ?)',
                [req.session.userId, productId, quantity || 1, JSON.stringify(customization)]
            );
        }
        res.status(201).json({ message: 'Item added to cart' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update quantity
router.put('/:id', isAuthenticated, async (req, res) => {
    const { quantity } = req.body;
    try {
        await db.execute('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, req.params.id, req.session.userId]);
        res.json({ message: 'Cart updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove item
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        await db.execute('DELETE FROM cart WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
        res.json({ message: 'Item removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
