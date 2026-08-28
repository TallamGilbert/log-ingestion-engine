// src/index.js (updated)
const express = require('express');
const rateLimit = require('./middleware/rateLimiter');
const LogValidator = require('./validation/logValidator');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '1mb' }));

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

        // Check if body is array
        if (!Array.isArray(req.body)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Request body must be a JSON array of log entries'
            });
        }

        // Validate logs
        const { validLogs, invalidLogs } = LogValidator.validateBatch(req.body);

        // If all logs are invalid, return error
        if (validLogs.length === 0 && invalidLogs.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: invalidLogs.map(item => ({
                    index: item.index,
                    errors: item.errors
                }))
            });
        }

        // Generate batch ID
        const batchId = uuidv4();

        // Process valid logs (to be implemented in later phases)
        // For now, just acknowledge receipt
        
        // Return response with partial acceptance info if needed
        const response = {
            status: 'accepted',
            batchId: batchId,
            acceptedCount: validLogs.length
        };

        if (invalidLogs.length > 0) {
            response.rejectedCount = invalidLogs.length;
            response.rejectedLogs = invalidLogs.map(item => ({
                index: item.index,
                errors: item.errors
            }));
        }

        return res.status(202).json(response);

    } catch (error) {
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

module.exports = app;