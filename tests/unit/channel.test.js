const { LogChannel, LogConsumer } = require('../../src/ingestion/channel');

describe('LogChannel', () => {
    let channel;
    
    beforeEach(() => {
        channel = new LogChannel(10, 3, 100);
    });

    test('pushes logs to buffer', () => {
        const log = { timestamp: '2024-01-15T10:30:00Z', service: 'test', level: 'INFO', message: 'test' };
        expect(channel.push(log)).toBe(true);
        expect(channel.getBufferSize()).toBe(1);
    });

    test('rejects logs when buffer is full', () => {
        for (let i = 0; i < 10; i++) {
            channel.push({ id: i });
        }
        
        expect(channel.push({ id: 11 })).toBe(false);
        expect(channel.getBufferSize()).toBe(10);
        expect(channel.isBufferFull()).toBe(true);
    });

    test('consumes batch when buffer reaches batch size', () => {
        const batchSpy = jest.fn();
        channel.on('batch', batchSpy);
        
        for (let i = 0; i < 3; i++) {
            channel.push({ id: i });
        }
        
        expect(batchSpy).toHaveBeenCalled();
        expect(channel.getBufferSize()).toBe(0);
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
        expect(stats.utilizationPercent).toBe(50);
    });
});

describe('LogConsumer', () => {
    let channel;
    let consumer;
    let processBatch;
    
    beforeEach(() => {
        channel = new LogChannel(10, 3, 100);
        processBatch = jest.fn().mockResolvedValue();
        consumer = new LogConsumer(channel, processBatch, 3, 1000);
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
