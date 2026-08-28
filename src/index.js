// src/index.js
const express = require('express');
const rateLimit = require('./middleware/rateLimiter');
const { validateLogs } = require('./validation/logValidator');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit.middleware);

// Routes
app.post('/logs', (req, res) => {
    try {
        // Check content type
        if (!req.is('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'Content-Type must be application/json'
            });
        }

        // Validate payload size (1MB)
        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > 1024 * 1024) {
            return res.status(413).json({
                error: 'Payload Too Large',
                message: 'Maximum payload size is 1MB'
            });
        }

        // Check if body is array
        if (!Array.isArray(req.body)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Request body must be a JSON array of log entries'
            });
        }

        // Generate batch ID
        const batchId = uuidv4();

        // Return success
        return res.status(202).json({
            status: 'accepted',
            batchId: batchId
        });

    } catch (error) {
        // Handle malformed JSON
        if (error instanceof SyntaxError) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Malformed JSON in request body'
            });
        }
        
        console.error('Unexpected error:', error);
        return res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Log Ingestion Engine running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;