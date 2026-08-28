class AlertManager {
    constructor(config = {}) {
        this.alerts = [];
        this.alertHistory = [];
        this.lastAlertTimes = {};
        this.alertCooldownMs = 60000; // 1 minute cooldown
        this.config = {
            errorRateThreshold: config.errorRateThreshold || parseFloat(process.env.ERROR_RATE_THRESHOLD || '10'),
            queueBacklogThreshold: config.queueBacklogThreshold || parseInt(process.env.QUEUE_BACKLOG_THRESHOLD || '5000'),
            zeroThroughputSeconds: config.zeroThroughputSeconds || parseInt(process.env.ZERO_THROUGHPUT_SECONDS || '10'),
            deadLetterThreshold: config.deadLetterThreshold || parseInt(process.env.DEAD_LETTER_THRESHOLD || '1000')
        };
        
        this.zeroThroughputStart = null;
        this.checkInterval = setInterval(() => this.checkAll(), 10000);
        
        if (this.checkInterval.unref) {
            this.checkInterval.unref();
        }
    }

    checkAll(metrics, deadLetterCount = 0) {
        this.checkErrorRate(metrics);
        this.checkQueueBacklog(metrics);
        this.checkThroughput(metrics);
        this.checkDeadLetter(deadLetterCount);
    }

    checkErrorRate(metrics) {
        const errorRate = metrics.error_rate || 0;
        
        if (errorRate > this.config.errorRateThreshold) {
            this.triggerAlert('error_rate', 
                `Error rate is ${errorRate.toFixed(1)}% (threshold: ${this.config.errorRateThreshold}%)`,
                errorRate);
        }
    }

    checkQueueBacklog(metrics) {
        const backlog = metrics.queue_backlog || 0;
        
        if (backlog > this.config.queueBacklogThreshold) {
            this.triggerAlert('queue_backlog',
                `Queue backlog is ${backlog} (threshold: ${this.config.queueBacklogThreshold})`,
                backlog);
        }
    }

    checkThroughput(metrics) {
        const throughput = metrics.throughput || 0;
        
        if (throughput === 0) {
            if (!this.zeroThroughputStart) {
                this.zeroThroughputStart = Date.now();
            } else {
                const duration = (Date.now() - this.zeroThroughputStart) / 1000;
                if (duration >= this.config.zeroThroughputSeconds) {
                    this.triggerAlert('zero_throughput',
                        `Throughput has been 0 for ${duration.toFixed(0)} seconds`,
                        0);
                }
            }
        } else {
            this.zeroThroughputStart = null;
        }
    }

    checkDeadLetter(deadLetterCount) {
        if (deadLetterCount > this.config.deadLetterThreshold) {
            this.triggerAlert('dead_letter',
                `Dead letter file has ${deadLetterCount} entries (threshold: ${this.config.deadLetterThreshold})`,
                deadLetterCount);
        }
    }

    triggerAlert(type, message, value) {
        const now = Date.now();
        const lastAlertTime = this.lastAlertTimes[type] || 0;
        
        // Check cooldown
        if (now - lastAlertTime < this.alertCooldownMs) {
            return;
        }
        
        this.lastAlertTimes[type] = now;
        
        const alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            message,
            value,
            timestamp: new Date().toISOString(),
            acknowledged: false
        };
        
        this.alerts.push(alert);
        this.alertHistory.push(alert);
        
        // Deliver alert (console for now)
        console.log(`[ALERT] ${type.toUpperCase()}: ${message}`);
        
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }
        
        return alert;
    }

    getActiveAlerts() {
        return this.alerts.filter(alert => !alert.acknowledged);
    }

    getAllAlerts() {
        return this.alerts;
    }

    getAlertHistory() {
        return this.alertHistory;
    }

    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            return true;
        }
        return false;
    }

    clearAlerts() {
        this.alerts = [];
    }

    getStats() {
        return {
            activeAlerts: this.getActiveAlerts().length,
            totalAlerts: this.alertHistory.length,
            alertsByType: this.getAlertsByType(),
            lastAlert: this.alertHistory.length > 0 ? this.alertHistory[this.alertHistory.length - 1] : null
        };
    }

    getAlertsByType() {
        const types = {};
        for (const alert of this.alertHistory) {
            types[alert.type] = (types[alert.type] || 0) + 1;
        }
        return types;
    }
}

// Create singleton instance
const alertManager = new AlertManager();

module.exports = alertManager;
module.exports.AlertManager = AlertManager;
