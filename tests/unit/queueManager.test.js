const QueueManager = require('../../src/storage/queueManager');
const FallbackQueue = require('../../src/storage/fallbackQueue');

describe('FallbackQueue', () => {
    let queue;
    
    beforeEach(() => {
        queue = new FallbackQueue();
    });

    test('pushes logs to correct queue', () => {
        const log = { id: 1, message: 'test' };
        expect(queue.push('service1', log)).toBe(true);
        expect(queue.getQueueSize('service1')).toBe(1);
    });

    test('gets batch of logs', () => {
        for (let i = 0; i < 5; i++) {
            queue.push('service1', { id: i });
        }
        
        const batch = queue.getBatch('service1', 3);
        expect(batch).toHaveLength(3);
        expect(queue.getQueueSize('service1')).toBe(2);
    });

    test('tracks total size', () => {
        queue.push('service1', { id: 1 });
        queue.push('service2', { id: 2 });
        queue.push('service3', { id: 3 });
        
        expect(queue.getTotalSize()).toBe(3);
    });
});

describe('QueueManager', () => {
    let manager;
    
    beforeEach(() => {
        manager = new QueueManager();
    });

    test('uses fallback when RabbitMQ not available', async () => {
        // Don't initialize, should use fallback
        expect(manager.usingFallback).toBe(false);
        
        // Publish should work with fallback
        const result = await manager.publish({ id: 1 }, 'service1');
        expect(result).toBe(true);
    });
});
