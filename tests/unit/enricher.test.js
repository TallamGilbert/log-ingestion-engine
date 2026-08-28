const { LogEnricher } = require('../../src/ingestion/enricher');

describe('LogEnricher', () => {
    let enricher;
    
    beforeEach(() => {
        enricher = new LogEnricher({ env: 'test' });
    });

    test('adds received_at timestamp', () => {
        const log = { timestamp: '2024-01-15T10:30:00Z', service: 'test', level: 'INFO', message: 'test' };
        const enriched = enricher.enrich(log);
        expect(enriched.received_at).toBeDefined();
    });

    test('adds source_ip from X-Forwarded-For', () => {
        const log = { timestamp: '2024-01-15T10:30:00Z', service: 'test', level: 'INFO', message: 'test' };
        const context = { headers: { 'x-forwarded-for': '192.168.1.100, 10.0.0.1' } };
        const enriched = enricher.enrich(log, context);
        expect(enriched.source_ip).toBe('192.168.1.100');
    });

    test('uses unknown for missing IP', () => {
        const log = { timestamp: '2024-01-15T10:30:00Z', service: 'test', level: 'INFO', message: 'test' };
        const enriched = enricher.enrich(log, {});
        expect(enriched.source_ip).toBe('unknown');
    });

    test('adds environment', () => {
        const log = { timestamp: '2024-01-15T10:30:00Z', service: 'test', level: 'INFO', message: 'test' };
        const enriched = enricher.enrich(log);
        expect(enriched.env).toBe('test');
    });

    test('enriches multiple logs', () => {
        const logs = [
            { timestamp: '2024-01-15T10:30:00Z', service: 's1', level: 'INFO', message: 'm1' },
            { timestamp: '2024-01-15T10:30:01Z', service: 's2', level: 'ERROR', message: 'm2' }
        ];
        const enriched = enricher.enrichBatch(logs);
        expect(enriched).toHaveLength(2);
        expect(enriched[0].received_at).toBeDefined();
        expect(enriched[1].received_at).toBeDefined();
    });
});
