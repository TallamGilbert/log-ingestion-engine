const RetryHandler = require('../../src/storage/retryHandler');

describe('RetryHandler', () => {
    let handler;
    
    beforeEach(() => {
        handler = new RetryHandler({
            maxRetries: 3,
            retryDelays: [10, 20, 30], // Small delays for testing
            deadLetterFile: './test-failed.json'
        });
    });

    afterEach(() => {
        // Clean up test file
        const fs = require('fs');
        if (fs.existsSync('./test-failed.json')) {
            fs.unlinkSync('./test-failed.json');
        }
    });

    test('retries failed operations', async () => {
        let attempts = 0;
        
        const operation = async (log) => {
            attempts++;
            if (attempts < 3) {
                throw new Error('Failed');
            }
            return { success: true };
        };
        
        const result = await handler.retryWithBackoff(operation, { id: 1 });
        
        expect(attempts).toBe(3);
        expect(result.success).toBe(true);
    });

    test('adds to dead letter after max retries', async () => {
        const operation = async () => {
            throw new Error('Always fails');
        };
        
        const result = await handler.retryWithBackoff(operation, { id: 2 });
        
        expect(result).toBe(false);
        expect(handler.getDeadLetterCount()).toBe(1);
    });

    test('tracks retry counts', () => {
        const log = { timestamp: '2024-01-15T10:30:00Z', service: 'test', level: 'INFO', message: 'test' };
        const key = handler.getLogKey(log);
        
        expect(handler.retryCount.get(key)).toBeUndefined();
        
        handler.retryCount.set(key, 2);
        expect(handler.retryCount.get(key)).toBe(2);
    });
});
