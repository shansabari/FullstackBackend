const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Get categories
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await db.execute('SELECT * FROM categories');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all products with filters
router.get('/', async (req, res) => {
    const { category, search, minPrice, maxPrice } = req.query;
    let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
    const params = [];

    if (category) {
        query += ' AND p.category_id = ?';
        params.push(category);
    }
    if (search) {
        query += ' AND p.name LIKE ?';
        params.push(`%${search}%`);
    }
    if (minPrice) {
        query += ' AND p.price >= ?';
        params.push(minPrice);
    }
    if (maxPrice) {
        query += ' AND p.price <= ?';
        params.push(maxPrice);
    }

    try {
        const [products] = await db.execute(query, params);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const [products] = await db.execute('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [req.params.id]);
        if (products.length === 0) return res.status(404).json({ message: 'Product not found' });
        res.json(products[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Add Product
router.post('/', upload.single('image'), async (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ message: 'Access denied' });

    const { name, description, price, category_id, weight_qty, flavor_options, stock_availability } = req.body;
    const imageUrl = req.file ? req.file.filename : null;

    try {
        await db.execute(
            'INSERT INTO products (name, description, price, category_id, weight_qty, flavor_options, stock_availability, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name || null, description || null, price || null, category_id || null, weight_qty || null, flavor_options || null, stock_availability || null, imageUrl]
        );
        res.status(201).json({ message: 'Product added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Update Product
router.put('/:id', upload.single('image'), async (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ message: 'Access denied' });

    const { name, description, price, category_id, weight_qty, flavor_options, stock_availability } = req.body;
    let query = 'UPDATE products SET name=?, description=?, price=?, category_id=?, weight_qty=?, flavor_options=?, stock_availability=?';
    const params = [name || null, description || null, price || null, category_id || null, weight_qty || null, flavor_options || null, stock_availability || null];

    if (req.file) {
        query += ', image_url=?';
        params.push(req.file.filename);
    }

    query += ' WHERE id=?';
    params.push(req.params.id);

    try {
        await db.execute(query, params);
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Delete Product
router.delete('/:id', async (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    try {
        await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
