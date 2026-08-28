const { AlertManager } = require('../../src/monitoring/alertManager');

describe('AlertManager', () => {
    let manager;
    
    beforeEach(() => {
        manager = new AlertManager({
            errorRateThreshold: 10,
            queueBacklogThreshold: 100,
            zeroThroughputSeconds: 2,
            deadLetterThreshold: 50
        });
    });

    afterEach(() => {
        if (manager.checkInterval) {
            clearInterval(manager.checkInterval);
        }
    });

    test('triggers alert for high error rate', () => {
        const metrics = { error_rate: 15, queue_backlog: 0, throughput: 100 };
        manager.checkErrorRate(metrics);
        
        const alerts = manager.getActiveAlerts();
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts[0].type).toBe('error_rate');
    });

    test('does not trigger alert for normal error rate', () => {
        const metrics = { error_rate: 5 };
        manager.checkErrorRate(metrics);
        
        expect(manager.getActiveAlerts().length).toBe(0);
    });

    test('triggers alert for queue backlog', () => {
        const metrics = { error_rate: 0, queue_backlog: 200 };
        manager.checkQueueBacklog(metrics);
        
        const alerts = manager.getActiveAlerts();
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts[0].type).toBe('queue_backlog');
    });

    test('triggers alert for dead letter threshold', () => {
        manager.checkDeadLetter(100);
        
        const alerts = manager.getActiveAlerts();
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts[0].type).toBe('dead_letter');
    });

    test('acknowledges alerts', () => {
        const metrics = { error_rate: 15 };
        manager.checkErrorRate(metrics);
        
        const alert = manager.getActiveAlerts()[0];
        expect(manager.acknowledgeAlert(alert.id)).toBe(true);
        expect(manager.getActiveAlerts().length).toBe(0);
    });

    test('tracks alert statistics', () => {
        manager.checkErrorRate({ error_rate: 15 });
        manager.checkQueueBacklog({ queue_backlog: 200 });
        
        const stats = manager.getStats();
        expect(stats.activeAlerts).toBe(2);
        expect(stats.totalAlerts).toBe(2);
        expect(stats.alertsByType.error_rate).toBe(1);
        expect(stats.alertsByType.queue_backlog).toBe(1);
    });
});
