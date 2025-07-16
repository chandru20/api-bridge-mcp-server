#!/usr/bin/env node

/**
 * Demo API Server for APIBridge MCP Server
 * Implements the sample-api.yml specification
 */


import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});


// SQLite DB setup
let db;

// Promisify database methods
function promisifyDb(db) {
  db.getAsync = function(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  db.allAsync = function(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  db.runAsync = function(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  db.execAsync = function(sql) {
    return new Promise((resolve, reject) => {
      this.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database('./demo.db', (err) => {
      if (err) return reject(err);
      
      // Add promisified methods
      promisifyDb(db);
      
      // Enforce foreign key constraints
      db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) return reject(err);
        // Create tables
        db.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            username TEXT UNIQUE,
            firstName TEXT,
            lastName TEXT,
            avatar TEXT,
            isActive INTEGER,
            createdAt TEXT,
            updatedAt TEXT
          );
          CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            title TEXT,
            content TEXT,
            excerpt TEXT,
            status TEXT,
            authorId TEXT,
            tags TEXT,
            publishedAt TEXT,
            createdAt TEXT,
            updatedAt TEXT,
            FOREIGN KEY(authorId) REFERENCES users(id)
          );
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            sku TEXT UNIQUE NOT NULL,
            tags TEXT,
            createdAt TEXT,
            updatedAt TEXT
          );
        `, (err) => {
          if (err) return reject(err);
          // Insert sample data if tables are empty
          db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) return reject(err);
            if (row.count === 0) {
              const user1 = {
                id: uuidv4(),
                email: 'john.doe@example.com',
                username: 'johndoe',
                firstName: 'John',
                lastName: 'Doe',
                avatar: 'https://avatar.example.com/johndoe.jpg',
                isActive: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              const user2 = {
                id: uuidv4(),
                email: 'jane.smith@example.com',
                username: 'janesmith',
                firstName: 'Jane',
                lastName: 'Smith',
                avatar: 'https://avatar.example.com/janesmith.jpg',
                isActive: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              db.run(`INSERT INTO users (id, email, username, firstName, lastName, avatar, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [user1.id, user1.email, user1.username, user1.firstName, user1.lastName, user1.avatar, user1.isActive, user1.createdAt, user1.updatedAt], (err) => {
                if (err) return reject(err);
                db.run(`INSERT INTO users (id, email, username, firstName, lastName, avatar, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [user2.id, user2.email, user2.username, user2.firstName, user2.lastName, user2.avatar, user2.isActive, user2.createdAt, user2.updatedAt], (err) => {
                  if (err) return reject(err);
                  // Insert posts
                  const post1 = {
                    id: uuidv4(),
                    title: 'Hello World',
                    content: 'This is the first post.',
                    excerpt: 'This is the first post.',
                    status: 'published',
                    authorId: user1.id,
                    tags: 'demo,hello',
                    publishedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  const post2 = {
                    id: uuidv4(),
                    title: 'Second Post',
                    content: 'This is the second post.',
                    excerpt: 'This is the second post.',
                    status: 'draft',
                    authorId: user2.id,
                    tags: 'demo,second',
                    publishedAt: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  db.run(`INSERT INTO posts (id, title, content, excerpt, status, authorId, tags, publishedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [post1.id, post1.title, post1.content, post1.excerpt, post1.status, post1.authorId, post1.tags, post1.publishedAt, post1.createdAt, post1.updatedAt], (err) => {
                    if (err) return reject(err);
                    db.run(`INSERT INTO posts (id, title, content, excerpt, status, authorId, tags, publishedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [post2.id, post2.title, post2.content, post2.excerpt, post2.status, post2.authorId, post2.tags, post2.publishedAt, post2.createdAt, post2.updatedAt], (err) => {
                      if (err) return reject(err);
                      
                      // Insert sample products
                      const product1 = {
                        id: uuidv4(),
                        name: 'Demo Widget',
                        description: 'A sample widget for demonstration purposes',
                        price: 29.99,
                        sku: 'DEMO-001',
                        tags: 'demo,widget,sample',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                      };
                      const product2 = {
                        id: uuidv4(),
                        name: 'Test Gadget',
                        description: 'A test gadget for API testing',
                        price: 15.50,
                        sku: 'TEST-002',
                        tags: 'test,gadget,api',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                      };
                      
                      db.run(`INSERT INTO products (id, name, description, price, sku, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [product1.id, product1.name, product1.description, product1.price, product1.sku, product1.tags, product1.createdAt, product1.updatedAt], (err) => {
                        if (err) return reject(err);
                        db.run(`INSERT INTO products (id, name, description, price, sku, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                          [product2.id, product2.name, product2.description, product2.price, product2.sku, product2.tags, product2.createdAt, product2.updatedAt], (err) => {
                          if (err) return reject(err);
                          console.log('✅ Initialized SQLite DB with 2 users, 2 posts, and 2 products');
                          resolve();
                        });
                      });
                    });
                  });
                });
              });
            } else {
              resolve();
            }
          });
        });
      });
    });
  });

}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'APIBridge Mock Server',
    version: '1.0.0'
  });
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Sample API',
    version: '1.0.0',
    description: 'A sample API for testing APIBridge MCP Server',
    endpoints: {
      users: '/api/users',
      posts: '/api/posts',
      products: '/api/products'
    },
    documentation: 'See sample-api.yml for full specification'
  });
});

// ===== USER ENDPOINTS =====

// GET /api/users - List all users
app.get('/api/users', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    let usersList = await db.allAsync('SELECT * FROM users LIMIT ? OFFSET ?', limit, offset);
    usersList = usersList.map(u => ({ ...u, isActive: !!u.isActive }));
    res.json(usersList);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// POST /api/users - Create a new user
app.post('/api/users', async (req, res) => {
  const { email, username, firstName, lastName, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['email', 'username', 'password']
    });
  }
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO users (id, email, username, firstName, lastName, avatar, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, email, username, firstName || '', lastName || '', null, 1, now, now
    );
    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', id);
    user.isActive = !!user.isActive;
    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email or username already exists'
      });
    }
    res.status(500).json({ error: 'DB error', message: err.message });
  }
});

// GET /api/users/:userId - Get user by ID
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with ID: ${userId}`
      });
    }
    user.isActive = !!user.isActive;
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// PUT /api/users/:userId - Update user
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with ID: ${userId}`
      });
    }
    if (updates.email && updates.email !== user.email) {
      const existingUser = await db.getAsync('SELECT * FROM users WHERE email = ? AND id != ?', updates.email, userId);
      if (existingUser) {
        return res.status(400).json({
          error: 'Email already in use',
          message: 'Another user already has this email address'
        });
      }
    }
    const updatedUser = {
      ...user,
      ...updates,
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: new Date().toISOString()
    };
    await db.runAsync(
      `UPDATE users SET email=?, username=?, firstName=?, lastName=?, avatar=?, isActive=?, updatedAt=? WHERE id=?`,
      updatedUser.email, updatedUser.username, updatedUser.firstName, updatedUser.lastName, updatedUser.avatar, updatedUser.isActive ? 1 : 0, updatedUser.updatedAt, userId
    );
    const result = await db.getAsync('SELECT * FROM users WHERE id = ?', userId);
    result.isActive = !!result.isActive;
    res.json(result);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// DELETE /api/users/:userId - Delete user
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with ID: ${userId}`
      });
    }
    await db.runAsync('DELETE FROM users WHERE id = ?', userId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// ===== POST ENDPOINTS =====

// GET /api/posts - List all posts
app.get('/api/posts', async (req, res) => {
  try {
    const { author, status } = req.query;
    let query = 'SELECT * FROM posts';
    const params = [];
    if (author && status) {
      query += ' WHERE authorId = ? AND status = ?';
      params.push(author, status);
    } else if (author) {
      query += ' WHERE authorId = ?';
      params.push(author);
    } else if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    const postsList = await db.allAsync(query, ...params);
    postsList.forEach(post => { 
      try {
        post.tags = JSON.parse(post.tags || '[]'); 
      } catch {
        post.tags = [];
      }
    });
    res.json(postsList);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// POST /api/posts - Create a new post
app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, excerpt, status = 'draft', authorId, tags = [] } = req.body;
    if (!title || !content || !authorId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'content', 'authorId']
      });
    }
    const author = await db.getAsync('SELECT * FROM users WHERE id = ?', authorId);
    if (!author) {
      return res.status(400).json({
        error: 'Invalid author',
        message: `No user found with ID: ${authorId}`
      });
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    const pubAt = status === 'published' ? now : null;
    await db.runAsync(
      `INSERT INTO posts (id, title, content, excerpt, status, authorId, tags, publishedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, title, content, excerpt || content.substring(0, 100) + '...', status, authorId, JSON.stringify(tags), pubAt, now, now
    );
    const post = await db.getAsync('SELECT * FROM posts WHERE id = ?', id);
    try {
      post.tags = JSON.parse(post.tags || '[]');
    } catch {
      post.tags = [];
    }
    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// GET /api/posts/:postId - Get post by ID
app.get('/api/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await db.getAsync('SELECT * FROM posts WHERE id = ?', postId);
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: `No post found with ID: ${postId}`
      });
    }
    try {
      post.tags = JSON.parse(post.tags || '[]');
    } catch {
      post.tags = [];
    }
    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// PUT /api/posts/:postId - Update post
app.put('/api/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const updates = req.body;
    const post = await db.getAsync('SELECT * FROM posts WHERE id = ?', postId);
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: `No post found with ID: ${postId}`
      });
    }
    let publishedAt = post.publishedAt;
    if (updates.status === 'published' && post.status !== 'published') {
      publishedAt = new Date().toISOString();
    }
    // Determine tags array
    const tagsArray = Array.isArray(updates.tags)
      ? updates.tags
      : JSON.parse(post.tags || '[]');
    const updatedPost = {
      ...post,
      ...updates,
      id: post.id,
      createdAt: post.createdAt,
      updatedAt: new Date().toISOString(),
      publishedAt,
      tags: JSON.stringify(tagsArray)
    };
    await db.runAsync(
      `UPDATE posts SET title=?, content=?, excerpt=?, status=?, authorId=?, tags=?, publishedAt=?, updatedAt=? WHERE id=?`,
      updatedPost.title, updatedPost.content, updatedPost.excerpt, updatedPost.status, updatedPost.authorId, updatedPost.tags, updatedPost.publishedAt, updatedPost.updatedAt, postId
    );
    const result = await db.getAsync('SELECT * FROM posts WHERE id = ?', postId);
    try {
      result.tags = JSON.parse(result.tags || '[]');
    } catch {
      result.tags = [];
    }
    res.json(result);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// DELETE /api/posts/:postId - Delete post
app.delete('/api/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await db.getAsync('SELECT * FROM posts WHERE id = ?', postId);
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: `No post found with ID: ${postId}`
      });
    }
    await db.runAsync('DELETE FROM posts WHERE id = ?', postId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// ===== PRODUCT ENDPOINTS =====

// GET /api/products - List all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.allAsync('SELECT * FROM products ORDER BY createdAt DESC');
    const formattedProducts = products.map(product => ({
      ...product,
      tags: product.tags ? product.tags.split(',') : [],
      price: parseFloat(product.price)
    }));
    res.json(formattedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// POST /api/products - Create a new product
app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, sku, tags } = req.body;
    
    // Validation
    if (!name || !price || !sku) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name, price, and sku are required'
      });
    }

    const product = {
      id: uuidv4(),
      name,
      description: description || null,
      price: parseFloat(price),
      sku,
      tags: Array.isArray(tags) ? tags.join(',') : (tags || ''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.runAsync(
      'INSERT INTO products (id, name, description, price, sku, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [product.id, product.name, product.description, product.price, product.sku, product.tags, product.createdAt, product.updatedAt]
    );

    const responseProduct = {
      ...product,
      tags: product.tags ? product.tags.split(',') : []
    };

    res.status(201).json(responseProduct);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: products.sku')) {
      return res.status(400).json({
        error: 'SKU already exists',
        message: 'A product with this SKU already exists'
      });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// GET /api/products/:productId - Get product by ID
app.get('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', productId);
    
    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: `No product found with ID: ${productId}`
      });
    }

    const formattedProduct = {
      ...product,
      tags: product.tags ? product.tags.split(',') : [],
      price: parseFloat(product.price)
    };

    res.json(formattedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// PUT /api/products/:productId - Update product
app.put('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, description, price, sku, tags } = req.body;
    
    const existingProduct = await db.getAsync('SELECT * FROM products WHERE id = ?', productId);
    if (!existingProduct) {
      return res.status(404).json({
        error: 'Product not found',
        message: `No product found with ID: ${productId}`
      });
    }

    const updatedProduct = {
      name: name !== undefined ? name : existingProduct.name,
      description: description !== undefined ? description : existingProduct.description,
      price: price !== undefined ? parseFloat(price) : parseFloat(existingProduct.price),
      sku: sku !== undefined ? sku : existingProduct.sku,
      tags: tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : tags) : existingProduct.tags,
      updatedAt: new Date().toISOString()
    };

    await db.runAsync(
      'UPDATE products SET name = ?, description = ?, price = ?, sku = ?, tags = ?, updatedAt = ? WHERE id = ?',
      [updatedProduct.name, updatedProduct.description, updatedProduct.price, updatedProduct.sku, updatedProduct.tags, updatedProduct.updatedAt, productId]
    );

    const responseProduct = {
      id: productId,
      ...updatedProduct,
      tags: updatedProduct.tags ? updatedProduct.tags.split(',') : [],
      createdAt: existingProduct.createdAt
    };

    res.json(responseProduct);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: products.sku')) {
      return res.status(400).json({
        error: 'SKU already exists',
        message: 'A product with this SKU already exists'
      });
    }
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// DELETE /api/products/:productId - Delete product
app.delete('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', productId);
    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: `No product found with ID: ${productId}`
      });
    }
    await db.runAsync('DELETE FROM products WHERE id = ?', productId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// ===== ERROR HANDLING =====

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /health',
      'GET /api',
      'GET /api/users',
      'POST /api/users',
      'GET /api/users/:id',
      'PUT /api/users/:id',
      'DELETE /api/users/:id',
      'GET /api/posts',
      'POST /api/posts',
      'GET /api/posts/:id',
      'PUT /api/posts/:id',
      'DELETE /api/posts/:id',
      'GET /api/products',
      'POST /api/products',
      'GET /api/products/:id',
      'PUT /api/products/:id',
      'DELETE /api/products/:id'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on the server'
  });
});


// ===== SERVER STARTUP =====

// Initialize DB and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Mock Server running on http://localhost:${PORT}`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
    console.log(`💚 Health Check: http://localhost:${PORT}/health`);
    console.log(`\n📝 Available Endpoints:`);
    console.log(`   Users: http://localhost:${PORT}/api/users`);
    console.log(`   Posts: http://localhost:${PORT}/api/posts`);
    console.log(`   Products: http://localhost:${PORT}/api/products`);
    console.log(`\n🛑 Press Ctrl+C to stop the server`);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down mock server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down mock server...');
  process.exit(0);
});
