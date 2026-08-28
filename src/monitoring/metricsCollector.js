class MetricsCollector {
    constructor() {
        this.metrics = {
            total_logs_received: 0,
            logs_by_level: {
                INFO: 0,
                WARN: 0,
                ERROR: 0,
                DEBUG: 0
            },
            logs_by_service: {},
            error_rate: 0,
            throughput: 0,
            queue_backlog: 0
        };
        
        this.recentLogs = [];
        this.recentWindowMs = 60000; // 60 seconds
        this.lastThroughputCalc = Date.now();
        this.logsSinceLastCalc = 0;
        
        // Start throughput calculation
        this.throughputInterval = setInterval(() => {
            this.calculateThroughput();
        }, 1000);
        
        if (this.throughputInterval.unref) {
            this.throughputInterval.unref();
        }
    }

    recordLog(log) {
        // Increment total
        this.metrics.total_logs_received++;
        
        // Increment by level
        if (this.metrics.logs_by_level[log.level] !== undefined) {
            this.metrics.logs_by_level[log.level]++;
        }
        
        // Increment by service
        if (!this.metrics.logs_by_service[log.service]) {
            this.metrics.logs_by_service[log.service] = 0;
        }
        this.metrics.logs_by_service[log.service]++;
        
        // Track recent logs for error rate
        this.recentLogs.push({
            timestamp: Date.now(),
            level: log.level,
            service: log.service
        });
        
        // Remove old logs
        const cutoff = Date.now() - this.recentWindowMs;
        this.recentLogs = this.recentLogs.filter(log => log.timestamp >= cutoff);
        
        // Update error rate
        this.updateErrorRate();
        
        // Increment throughput counter
        this.logsSinceLastCalc++;
    }

    recordBatch(logs) {
        for (const log of logs) {
            this.recordLog(log);
        }
    }

    updateErrorRate() {
        if (this.recentLogs.length === 0) {
            this.metrics.error_rate = 0;
            return;
        }
        
        const errorCount = this.recentLogs.filter(log => log.level === 'ERROR').length;
        this.metrics.error_rate = (errorCount / this.recentLogs.length) * 100;
    }

    calculateThroughput() {
        const now = Date.now();
        const timeDiff = (now - this.lastThroughputCalc) / 1000; // in seconds
        
        if (timeDiff > 0) {
            this.metrics.throughput = this.logsSinceLastCalc / timeDiff;
            this.logsSinceLastCalc = 0;
            this.lastThroughputCalc = now;
        }
    }

    updateQueueBacklog(size) {
        this.metrics.queue_backlog = size;
    }

    getMetrics() {
        // Ensure throughput is calculated
        this.calculateThroughput();
        this.updateErrorRate();
        
        return {
            total_logs: this.metrics.total_logs_received,
            logs_by_level: this.metrics.logs_by_level,
            logs_by_service: this.metrics.logs_by_service,
            error_rate: this.metrics.error_rate,
            throughput: this.metrics.throughput,
            queue_backlog: this.metrics.queue_backlog,
            timestamp: new Date().toISOString()
        };
    }

    getTopServices(limit = 5) {
        return Object.entries(this.metrics.logs_by_service)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([service, count]) => ({ service, count }));
    }

    reset() {
        this.metrics = {
            total_logs_received: 0,
            logs_by_level: {
                INFO: 0,
                WARN: 0,
                ERROR: 0,
                DEBUG: 0
            },
            logs_by_service: {},
            error_rate: 0,
            throughput: 0,
            queue_backlog: 0
        };
        this.recentLogs = [];
        this.logsSinceLastCalc = 0;
    }

    stop() {
        if (this.throughputInterval) {
            clearInterval(this.throughputInterval);
        }
    }
}

// Create singleton instance
const metricsCollector = new MetricsCollector();

module.exports = metricsCollector;
module.exports.MetricsCollector = MetricsCollector;
