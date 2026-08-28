const fs = require('fs');
const path = require('path');

class RetryHandler {
    constructor(config = {}) {
        this.maxRetries = config.maxRetries || 3;
        this.retryDelays = config.retryDelays || [1000, 5000, 10000]; // 1s, 5s, 10s
        this.deadLetterFile = config.deadLetterFile || 'logs-failed.json';
        this.deadLetterEntries = [];
        this.retryCount = new Map(); // Track retry counts per log
        this.loadDeadLetters();
    }

    async retryWithBackoff(operation, log, context = {}) {
        const logKey = this.getLogKey(log);
        const currentRetries = this.retryCount.get(logKey) || 0;
        
        if (currentRetries >= this.maxRetries) {
            // Move to dead letter
            await this.addToDeadLetter(log, 'Max retries exceeded', context);
            this.retryCount.delete(logKey);
            return false;
        }
        
        const delay = this.retryDelays[currentRetries] || this.retryDelays[this.retryDelays.length - 1];
        this.retryCount.set(logKey, currentRetries + 1);
        
        try {
            await new Promise(resolve => setTimeout(resolve, delay));
            const result = await operation(log);
            this.retryCount.delete(logKey);
            return result;
        } catch (error) {
            // Recursive retry
            return this.retryWithBackoff(operation, log, context);
        }
    }

    getLogKey(log) {
        return `${log.timestamp}-${log.service}-${log.level}-${log.message}`;
    }

    async addToDeadLetter(log, error, context = {}) {
        const entry = {
            original_log: log,
            error: error,
            timestamp: new Date().toISOString(),
            context: context
        };
        
        this.deadLetterEntries.push(entry);
        
        // Check if file needs rotation
        if (this.deadLetterEntries.length >= 1000) {
            await this.rotateDeadLetterFile();
        }
        
        // Write to file
        await this.saveDeadLetters();
        
        return entry;
    }

    async saveDeadLetters() {
        try {
            const data = JSON.stringify(this.deadLetterEntries, null, 2);
            fs.writeFileSync(this.deadLetterFile, data, 'utf8');
        } catch (error) {
            console.error('Failed to save dead letters:', error.message);
        }
    }

    loadDeadLetters() {
        try {
            if (fs.existsSync(this.deadLetterFile)) {
                const data = fs.readFileSync(this.deadLetterFile, 'utf8');
                this.deadLetterEntries = JSON.parse(data);
                console.log(`Loaded ${this.deadLetterEntries.length} dead letter entries`);
            }
        } catch (error) {
            console.error('Failed to load dead letters:', error.message);
            this.deadLetterEntries = [];
        }
    }

    async rotateDeadLetterFile() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = `logs-failed-${timestamp}.json`;
        
        try {
            fs.renameSync(this.deadLetterFile, rotatedFile);
            console.log(`Rotated dead letter file to ${rotatedFile}`);
            this.deadLetterEntries = [];
        } catch (error) {
            console.error('Failed to rotate dead letter file:', error.message);
        }
    }

    getDeadLetterCount() {
        return this.deadLetterEntries.length;
    }

    getStats() {
        return {
            deadLetterCount: this.deadLetterEntries.length,
            retryCounts: Object.fromEntries(this.retryCount),
            deadLetterFile: this.deadLetterFile
        };
    }
}

module.exports = RetryHandler;
