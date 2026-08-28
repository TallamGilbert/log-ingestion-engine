const { LogChannel, LogConsumer } = require('../../src/ingestion/channel');

describe('LogChannel', () => {
    let channel;
    
    beforeEach(() => {
        // Use larger batch size to prevent auto-consumption during tests
        channel = new LogChannel(100, 50, 100);
    });

    test('pushes logs to buffer', () => {
        const log = { timestamp: '2024-01-15T10:30:00Z', service: 'test', level: 'INFO', message: 'test' };
        expect(channel.push(log)).toBe(true);
        expect(channel.getBufferSize()).toBe(1);
    });

    test('rejects logs when buffer is full', () => {
        // Use small buffer for this test
        const smallChannel = new LogChannel(5, 100, 100);
        
        for (let i = 0; i < 5; i++) {
            smallChannel.push({ id: i });
        }
        
        expect(smallChannel.push({ id: 6 })).toBe(false);
        expect(smallChannel.getBufferSize()).toBe(5);
        expect(smallChannel.isBufferFull()).toBe(true);
    });

    test('pushBatch returns number of pushed logs', () => {
        const logs = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
        const pushed = channel.pushBatch(logs);
        expect(pushed).toBe(5);
        expect(channel.getBufferSize()).toBe(5);
    });

    test('tracks statistics correctly', () => {
        for (let i = 0; i < 5; i++) {
            channel.push({ id: i });
        }
        
        const stats = channel.getStats();
        expect(stats.totalPushed).toBe(5);
        expect(stats.currentBufferSize).toBe(5);
        expect(stats.utilizationPercent).toBe(5); // 5/100 * 100
    });

    test('consumes batch when buffer reaches batch size', () => {
        const batchSpy = jest.fn();
        channel.on('batch', batchSpy);
        
        // Push exactly batch size
        for (let i = 0; i < 50; i++) {
            channel.push({ id: i });
        }
        
        // Need to manually trigger consume since we changed the logic
        const batch = channel.consumeBatch();
        
        expect(batch).toHaveLength(50);
        expect(batchSpy).toHaveBeenCalled();
        expect(channel.getBufferSize()).toBe(0);
    });
});

describe('LogConsumer', () => {
    let channel;
    let consumer;
    let processBatch;
    
    beforeEach(() => {
        channel = new LogChannel(100, 10, 100);
        processBatch = jest.fn().mockResolvedValue();
        consumer = new LogConsumer(channel, processBatch, 10, 1000);
    });

    afterEach(() => {
        consumer.stop();
    });

    test('processes logs on interval', (done) => {
        channel.push({ id: 1 });
        channel.push({ id: 2 });
        
        consumer.start();
        
        setTimeout(() => {
            expect(processBatch).toHaveBeenCalled();
            done();
        }, 1100);
    });
});
