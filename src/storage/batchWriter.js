const SQLiteStorage = require('./sqliteStorage');

class BatchWriter {
    constructor(storage, batchSize = 100, intervalMs = 1000) {
        this.storage = storage;
        this.batchSize = batchSize;
        this.intervalMs = intervalMs;
        this.pendingBatches = {
            service1: [],
            service2: [],
            service3: []
        };
        this.isWriting = false;
        this.interval = null;
    }

    start() {
        if (this.interval) return;
        
        this.interval = setInterval(() => {
            this.flushAll();
        }, this.intervalMs);
        
        if (this.interval.unref) {
            this.interval.unref();
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    addLog(service, log) {
        if (!this.pendingBatches[service]) {
            this.pendingBatches[service] = [];
        }
        
        this.pendingBatches[service].push(log);
        
        // Flush if batch size reached
        if (this.pendingBatches[service].length >= this.batchSize) {
            this.flushService(service);
        }
    }

    addBatch(service, logs) {
        for (const log of logs) {
            this.addLog(service, log);
        }
    }

    async flushService(service) {
        if (this.isWriting) return;
        
        const logs = this.pendingBatches[service];
        if (!logs || logs.length === 0) return;
        
        this.isWriting = true;
        this.pendingBatches[service] = [];
        
        try {
            await this.storage.insertBatch(service, logs);
            console.log(`Flushed ${logs.length} logs to ${service}`);
        } catch (error) {
            console.error(`Failed to flush logs to ${service}:`, error.message);
            // Put logs back for retry
            this.pendingBatches[service].unshift(...logs);
            throw error;
        } finally {
            this.isWriting = false;
        }
    }

    async flushAll() {
        for (const service of Object.keys(this.pendingBatches)) {
            if (this.pendingBatches[service].length > 0) {
                await this.flushService(service);
            }
        }
    }

    getPendingCount() {
        return Object.values(this.pendingBatches).reduce((sum, logs) => sum + logs.length, 0);
    }
}

module.exports = BatchWriter;
