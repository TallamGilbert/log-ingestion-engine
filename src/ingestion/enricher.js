class LogEnricher {
    constructor(config = {}) {
        this.env = config.env || process.env.NODE_ENV || 'production';
        this.enrichmentTime = 0;
        this.enrichmentCount = 0;
    }

    enrich(log, context = {}) {
        const startTime = process.hrtime();
        
        const now = new Date();
        const received_at = now.toISOString();
        
        const source_ip = this.extractSourceIp(context);
        const env = this.env;
        
        const enrichedLog = {
            ...log,
            received_at,
            source_ip,
            env
        };
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const enrichmentMs = seconds * 1000 + nanoseconds / 1000000;
        this.enrichmentTime += enrichmentMs;
        this.enrichmentCount++;
        
        return enrichedLog;
    }

    enrichBatch(logs, context = {}) {
        return logs.map(log => this.enrich(log, context));
    }

    extractSourceIp(context) {
        if (context.headers && context.headers['x-forwarded-for']) {
            return context.headers['x-forwarded-for'].split(',')[0].trim();
        }
        
        if (context.socket && context.socket.remoteAddress) {
            return context.socket.remoteAddress;
        }
        
        if (context.connection && context.connection.remoteAddress) {
            return context.connection.remoteAddress;
        }
        
        if (context.ip) {
            return context.ip;
        }
        
        return 'unknown';
    }

    getStats() {
        return {
            totalEnriched: this.enrichmentCount,
            averageEnrichmentTimeMs: this.enrichmentCount > 0 
                ? this.enrichmentTime / this.enrichmentCount 
                : 0,
            environment: this.env
        };
    }
}

const enricher = new LogEnricher();

module.exports = enricher;
module.exports.LogEnricher = LogEnricher;
