const { MetricsCollector } = require('../../src/monitoring/metricsCollector');

describe('MetricsCollector', () => {
    let collector;
    
    beforeEach(() => {
        collector = new MetricsCollector();
    });

    afterEach(() => {
        collector.stop();
    });

    test('records single log', () => {
        const log = {
            timestamp: '2024-01-15T10:30:00Z',
            service: 'test-service',
            level: 'INFO',
            message: 'Test message'
        };
        
        collector.recordLog(log);
        const metrics = collector.getMetrics();
        
        expect(metrics.total_logs).toBe(1);
        expect(metrics.logs_by_level.INFO).toBe(1);
        expect(metrics.logs_by_service['test-service']).toBe(1);
    });

    test('records batch of logs', () => {
        const logs = [
            { service: 'service1', level: 'INFO' },
            { service: 'service2', level: 'ERROR' },
            { service: 'service1', level: 'WARN' }
        ];
        
        collector.recordBatch(logs);
        const metrics = collector.getMetrics();
        
        expect(metrics.total_logs).toBe(3);
        expect(metrics.logs_by_level.INFO).toBe(1);
        expect(metrics.logs_by_level.ERROR).toBe(1);
        expect(metrics.logs_by_level.WARN).toBe(1);
        expect(metrics.logs_by_service['service1']).toBe(2);
        expect(metrics.logs_by_service['service2']).toBe(1);
    });

    test('calculates error rate', () => {
        const logs = [
            { service: 'service1', level: 'ERROR' },
            { service: 'service1', level: 'INFO' },
            { service: 'service1', level: 'INFO' },
            { service: 'service1', level: 'INFO' }
        ];
        
        collector.recordBatch(logs);
        const metrics = collector.getMetrics();
        
        expect(metrics.error_rate).toBe(25); // 1 out of 4
    });

    test('tracks top services', () => {
        const logs = [
            { service: 'service1', level: 'INFO' },
            { service: 'service1', level: 'INFO' },
            { service: 'service2', level: 'INFO' },
            { service: 'service3', level: 'INFO' },
            { service: 'service3', level: 'INFO' },
            { service: 'service3', level: 'INFO' }
        ];
        
        collector.recordBatch(logs);
        const topServices = collector.getTopServices(2);
        
        expect(topServices).toHaveLength(2);
        expect(topServices[0].service).toBe('service3');
        expect(topServices[0].count).toBe(3);
        expect(topServices[1].service).toBe('service1');
        expect(topServices[1].count).toBe(2);
    });

    test('updates queue backlog', () => {
        collector.updateQueueBacklog(100);
        const metrics = collector.getMetrics();
        expect(metrics.queue_backlog).toBe(100);
    });
});
