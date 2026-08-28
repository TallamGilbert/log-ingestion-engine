const { EventEmitter } = require('events');

class LogChannel extends EventEmitter {
    constructor(bufferSize = 10000, batchSize = 50, timeoutMs = 100) {
        super();
        this.bufferSize = bufferSize;
        this.batchSize = batchSize;
        this.timeoutMs = timeoutMs;
        this.buffer = [];
        this.isProcessing = false;
        
        this.stats = {
            totalPushed: 0,
            totalConsumed: 0,
            droppedLogs: 0,
            lastBatchTime: null
        };
        
        this.on('consume', this.consumeBatch.bind(this));
    }

    push(log) {
        if (this.buffer.length >= this.bufferSize) {
            this.stats.droppedLogs++;
            return false;
        }
        
        this.buffer.push(log);
        this.stats.totalPushed++;
        
        if (this.buffer.length >= this.batchSize) {
            this.emit('consume');
        }
        
        return true;
    }

    pushBatch(logs) {
        let pushed = 0;
        for (const log of logs) {
            if (this.push(log)) {
                pushed++;
            } else {
                break;
            }
        }
        return pushed;
    }

    consumeBatch() {
        if (this.isProcessing || this.buffer.length === 0) {
            return [];
        }
        
        this.isProcessing = true;
        const batch = this.buffer.splice(0, this.batchSize);
        this.stats.totalConsumed += batch.length;
        this.stats.lastBatchTime = new Date().toISOString();
        this.isProcessing = false;
        
        this.emit('batch', batch);
        return batch;
    }

    getBufferSize() {
        return this.buffer.length;
    }

    isBufferFull() {
        return this.buffer.length >= this.bufferSize;
    }

    getStats() {
        return {
            ...this.stats,
            currentBufferSize: this.buffer.length,
            utilizationPercent: (this.buffer.length / this.bufferSize) * 100
        };
    }
}

class LogConsumer {
    constructor(channel, processBatch, batchSize = 50, intervalMs = 1000) {
        this.channel = channel;
        this.processBatch = processBatch;
        this.batchSize = batchSize;
        this.intervalMs = intervalMs;
        this.isRunning = false;
        this.interval = null;
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.interval = setInterval(() => {
            this.processBufferedLogs();
        }, this.intervalMs);
        
        this.channel.on('consume', () => {
            this.processBufferedLogs();
        });
    }

    stop() {
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async processBufferedLogs() {
        if (this.channel.getBufferSize() === 0) return;
        
        const batch = this.channel.consumeBatch();
        if (batch.length > 0) {
            await this.processBatch(batch);
        }
    }
}

module.exports = { LogChannel, LogConsumer };
