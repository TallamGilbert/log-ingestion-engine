const SQLiteStorage = require('../../src/storage/sqliteStorage');
const BatchWriter = require('../../src/storage/batchWriter');

describe('SQLiteStorage', () => {
    let storage;
    
    beforeEach(() => {
        storage = new SQLiteStorage({ dbPath: './test-data' });
    });

    afterEach(() => {
        storage.close();
    });

    test('inserts log correctly', () => {
        const log = {
            timestamp: '2024-01-15T10:30:00Z',
            service: 'test-service',
            level: 'INFO',
            message: 'Test message',
            received_at: '2024-01-15T10:30:01Z',
            source_ip: '192.168.1.1',
            env: 'test'
        };
        
        expect(storage.insertLog('service1', log)).toBe(true);
        expect(storage.getLogCount('service1')).toBe(1);
    });

    test('inserts batch of logs', () => {
        const logs = [
            {
                timestamp: '2024-01-15T10:30:00Z',
                service: 'test-service',
                level: 'INFO',
                message: 'Test 1',
                received_at: '2024-01-15T10:30:01Z',
                source_ip: '192.168.1.1',
                env: 'test'
            },
            {
                timestamp: '2024-01-15T10:31:00Z',
                service: 'test-service',
                level: 'ERROR',
                message: 'Test 2',
                received_at: '2024-01-15T10:31:01Z',
                source_ip: '192.168.1.2',
                env: 'test'
            }
        ];
        
        const inserted = storage.insertBatch('service1', logs);
        expect(inserted).toBe(2);
        expect(storage.getLogCount('service1')).toBe(2);
    });
});

describe('BatchWriter', () => {
    let storage;
    let writer;
    
    beforeEach(() => {
        storage = new SQLiteStorage({ dbPath: './test-data' });
        writer = new BatchWriter(storage, 2, 1000);
    });

    afterEach(() => {
        writer.stop();
        storage.close();
    });

    test('flushes when batch size reached', async () => {
        const logs = [
            { timestamp: '2024-01-15T10:30:00Z', service: 'test', level: 'INFO', message: 'Test 1', received_at: '2024-01-15T10:30:01Z' },
            { timestamp: '2024-01-15T10:31:00Z', service: 'test', level: 'INFO', message: 'Test 2', received_at: '2024-01-15T10:31:01Z' }
        ];
        
        writer.addBatch('service1', logs);
        
        // Wait for flush
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(storage.getLogCount('service1')).toBe(2);
    });

    test('tracks pending logs', () => {
        writer.addLog('service1', { id: 1 });
        expect(writer.getPendingCount()).toBe(1);
    });
});
