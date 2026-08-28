const express = require('express');
const LogValidator = require('./validation/logValidator');
const RateLimiter = require('./middleware/rateLimiter');
const { LogChannel } = require('./ingestion/channel');
const enricher = require('./ingestion/enricher');
const router = require('./routing/router');
const QueueManager = require('./storage/queueManager');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Create instances
const rateLimiter = RateLimiter.instance || new RateLimiter();
const queueManager = new QueueManager();

// Create channel
const channelBufferSize = parseInt(process.env.CHANNEL_BUFFER_SIZE || '10000');
const consumerBatchSize = parseInt(process.env.CONSUMER_BATCH_SIZE || '50');
const channelTimeoutMs = parseInt(process.env.CHANNEL_TIMEOUT_MS || '100');
const rawLogsChannel = new LogChannel(channelBufferSize, consumerBatchSize, channelTimeoutMs);

// Initialize queue manager
queueManager.initialize().catch(error => {
    console.error('Failed to initialize queue manager:', error);
});

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(rateLimiter.middleware.bind(rateLimiter));

// Routes
app.post('/logs', async (req, res) => {
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

        // Enrich valid logs
        const enrichedLogs = enricher.enrichBatch(validLogs, {
            headers: req.headers,
            socket: req.socket,
            connection: req.connection,
            ip: req.ip
        });

        // Route logs to destinations
        const routedLogs = router.routeBatch(enrichedLogs);

        // Publish to queues for each destination
        for (const [destination, logs] of Object.entries(routedLogs)) {
            await queueManager.publishBatch(logs, destination);
        }

        // Push to channel for processing
        const pushedCount = rawLogsChannel.pushBatch(enrichedLogs);
        
        // If channel is full, return 503
        if (pushedCount < enrichedLogs.length) {
            return res.status(503).json({
                error: 'ingestion overloaded',
                message: 'Channel buffer is full. Please try again later.',
                acceptedCount: pushedCount,
                rejectedCount: enrichedLogs.length - pushedCount
            });
        }

        // Generate batch ID
        const batchId = uuidv4();

        // Return response
        const response = {
            status: 'accepted',
            batchId: batchId,
            acceptedCount: enrichedLogs.length
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
        console.error('Route error:', error);
        return res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        channelBufferSize: rawLogsChannel.getBufferSize(),
        channelUtilization: rawLogsChannel.getStats().utilizationPercent,
        queueStatus: queueManager.getStatus()
    });
});

// Queue status endpoint
app.get('/queue/status', (req, res) => {
    res.json(queueManager.getStatus());
});

// Channel statistics endpoint
app.get('/channel/stats', (req, res) => {
    res.json(rawLogsChannel.getStats());
});

// Enrichment statistics endpoint
app.get('/enrichment/stats', (req, res) => {
    res.json(enricher.getStats());
});

// Routing rules endpoint
app.get('/routing/rules', (req, res) => {
    res.json({
        rules: router.getRules(),
        defaultDestination: router.defaultDestination
    });
});

// Reload routing rules
app.post('/routing/reload', (req, res) => {
    router.reloadRules();
    res.json({
        status: 'reloaded',
        rules: router.getRules()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Malformed JSON in request body'
        });
    }
    
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'Payload Too Large',
            message: 'Maximum payload size is 1MB'
        });
    }
    
    console.error('Unexpected error:', err);
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message;
    
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: message
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await queueManager.close();
    process.exit(0);
});

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Log Ingestion Engine running on port ${PORT}`);
        console.log(`Channel buffer size: ${channelBufferSize}`);
        console.log(`Consumer batch size: ${consumerBatchSize}`);
        console.log(`Rate limit: ${rateLimiter.rateLimit} requests/sec`);
    });
}

module.exports = app;
