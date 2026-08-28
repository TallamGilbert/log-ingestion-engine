const SQLiteStorage = require('./sqliteStorage');
const BatchWriter = require('./batchWriter');
const RetryHandler = require('./retryHandler');

class StorageManager {
    constructor(config = {}) {
        this.storage = new SQLiteStorage(config.sqlite);
        this.batchWriter = new BatchWriter(
            this.storage,
            config.batchSize || 100,
            config.intervalMs || 1000
        );
        this.retryHandler = new RetryHandler(config.retry);
    }

    async writeLog(service, log) {
        try {
            // Try direct write
            await this.batchWriter.addLog(service, log);
            return { success: true, log };
        } catch (error) {
            // Retry with backoff
            const result = await this.retryHandler.retryWithBackoff(
                async (log) => {
                    await this.storage.insertLog(service, log);
                    return { success: true, log };
                },
                log,
                { service, error: error.message }
            );
            
            return result;
        }
    }

    async writeBatch(service, logs) {
        const results = [];
        
        for (const log of logs) {
            const result = await this.writeLog(service, log);
            results.push(result);
        }
        
        return results;
    }

    start() {
        this.batchWriter.start();
    }

    stop() {
        this.batchWriter.stop();
        this.storage.close();
    }

    getStats() {
        return {
            totalLogs: this.storage.getTotalLogCount(),
            pendingBatches: this.batchWriter.getPendingCount(),
            deadLetters: this.retryHandler.getDeadLetterCount(),
            retryStats: this.retryHandler.getStats()
        };
    }
}

module.exports = StorageManager;
