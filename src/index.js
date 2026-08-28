const express = require('express');
const LogValidator = require('./validation/logValidator');
const RateLimiterModule = require('./middleware/rateLimiter');
const { LogChannel } = require('./ingestion/channel');
const enricher = require('./ingestion/enricher');
const router = require('./routing/router');
const QueueManager = require('./storage/queueManager');
const SQLiteStorage = require('./storage/sqliteStorage');
const BatchWriter = require('./storage/batchWriter');
const StorageManager = require('./storage/storageManager');
const metricsCollector = require('./monitoring/metricsCollector');
const alertManager = require('./monitoring/alertManager');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Get RateLimiter class and instance
const RateLimiter = RateLimiterModule.RateLimiter || RateLimiterModule;
const rateLimiter = RateLimiterModule.instance || new RateLimiter();

// Create managers
const queueManager = new QueueManager();
const storageManager = new StorageManager();

// Create channel
const channelBufferSize = parseInt(process.env.CHANNEL_BUFFER_SIZE || '10000');
const consumerBatchSize = parseInt(process.env.CONSUMER_BATCH_SIZE || '50');
const channelTimeoutMs = parseInt(process.env.CHANNEL_TIMEOUT_MS || '100');
const rawLogsChannel = new LogChannel(channelBufferSize, consumerBatchSize, channelTimeoutMs);

// Initialize managers
queueManager.initialize().catch(error => {
    console.error('Failed to initialize queue manager:', error);
});
storageManager.start();

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(rateLimiter.middleware.bind(rateLimiter));

// Routes
app.post('/logs', async (req, res) => {
    try {
        if (!req.is('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'Content-Type must be application/json'
            });
        }

        if (!Array.isArray(req.body)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Request body must be a JSON array of log entries'
            });
        }

        const { validLogs, invalidLogs } = LogValidator.validateBatch(req.body);

        if (validLogs.length === 0 && invalidLogs.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: invalidLogs.map(item => ({
                    index: item.index,
                    errors: item.errors
                }))
            });
        }

        // Enrich logs
        const enrichedLogs = enricher.enrichBatch(validLogs, {
            headers: req.headers,
            socket: req.socket,
            connection: req.connection,
            ip: req.ip
        });

        // Record metrics
        metricsCollector.recordBatch(enrichedLogs);

        // Route logs
        const routedLogs = router.routeBatch(enrichedLogs);

        // Publish to queues
        for (const [destination, logs] of Object.entries(routedLogs)) {
            try {
                await queueManager.publishBatch(logs, destination);
            } catch (error) {
                console.error(`Failed to publish to ${destination}:`, error.message);
            }
        }

        // Write to storage
        for (const [destination, logs] of Object.entries(routedLogs)) {
            try {
                await storageManager.writeBatch(destination, logs);
            } catch (error) {
                console.error(`Failed to write to ${destination}:`, error.message);
            }
        }

        // Push to channel
        const pushedCount = rawLogsChannel.pushBatch(enrichedLogs);

        if (pushedCount < enrichedLogs.length) {
            return res.status(503).json({
                error: 'ingestion overloaded',
                message: 'Channel buffer is full',
                acceptedCount: pushedCount,
                rejectedCount: enrichedLogs.length - pushedCount
            });
        }

        const batchId = uuidv4();
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

// Monitoring endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        channelBufferSize: rawLogsChannel.getBufferSize(),
        channelUtilization: rawLogsChannel.getStats().utilizationPercent,
        queueStatus: queueManager.getStatus(),
        storageStats: storageManager.getStats()
    });
});

app.get('/metrics', (req, res) => {
    const metrics = metricsCollector.getMetrics();
    alertManager.checkAll(metrics, storageManager.getStats().deadLetters);
    res.json(metrics);
});

app.get('/metrics/top-services', (req, res) => {
    const limit = parseInt(req.query.limit || '5');
    res.json({
        top_services: metricsCollector.getTopServices(limit)
    });
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'monitoring', 'dashboard.html'));
});

app.get('/alerts', (req, res) => {
    res.json({
        active: alertManager.getActiveAlerts(),
        stats: alertManager.getStats()
    });
});

app.get('/alerts/history', (req, res) => {
    res.json(alertManager.getAlertHistory());
});

app.post('/alerts/:id/acknowledge', (req, res) => {
    const acknowledged = alertManager.acknowledgeAlert(req.params.id);
    if (acknowledged) {
        res.json({ status: 'acknowledged', id: req.params.id });
    } else {
        res.status(404).json({ error: 'Alert not found' });
    }
});

app.get('/queue/status', (req, res) => {
    res.json(queueManager.getStatus());
});

app.get('/channel/stats', (req, res) => {
    res.json(rawLogsChannel.getStats());
});

app.get('/enrichment/stats', (req, res) => {
    res.json(enricher.getStats());
});

app.get('/routing/rules', (req, res) => {
    res.json({
        rules: router.getRules(),
        defaultDestination: router.defaultDestination
    });
});

app.post('/routing/reload', (req, res) => {
    router.reloadRules();
    res.json({
        status: 'reloaded',
        rules: router.getRules()
    });
});

app.get('/storage/stats', (req, res) => {
    res.json(storageManager.getStats());
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
    });
});

// Error handler
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
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await queueManager.close();
    storageManager.stop();
    process.exit(0);
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Log Ingestion Engine running on port ${PORT}`);
        console.log(`Channel buffer size: ${channelBufferSize}`);
        console.log(`Rate limit: ${rateLimiter.rateLimit} requests/sec`);
        console.log('Available endpoints:');
        console.log('  POST /logs - Ingest logs');
        console.log('  GET /health - Health check');
        console.log('  GET /metrics - Metrics');
        console.log('  GET /dashboard - Dashboard');
        console.log('  GET /alerts - Alerts');
        console.log('  GET /queue/status - Queue status');
        console.log('  GET /channel/stats - Channel stats');
        console.log('  GET /storage/stats - Storage stats');
        console.log('  GET /routing/rules - Routing rules');
    });
}

module.exports = app;
