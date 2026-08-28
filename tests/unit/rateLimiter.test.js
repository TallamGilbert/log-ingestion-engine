// tests/unit/rateLimiter.test.js
const RateLimiter = require('../../src/middleware/rateLimiter');

describe('RateLimiter', () => {
    let rateLimiter;
    
    beforeEach(() => {
        rateLimiter = new RateLimiter(10); // Small limit for testing
    });

    test('allows requests within limit', () => {
        const bucket = rateLimiter.getBucket('127.0.0.1');
        expect(bucket.tryConsume()).toBe(true);
        expect(bucket.tryConsume()).toBe(true);
    });

    test('blocks requests over limit', () => {
        const bucket = rateLimiter.getBucket('127.0.0.1');
        
        // Consume all tokens
        for (let i = 0; i < 10; i++) {
            bucket.tryConsume();
        }
        
        // Next request should fail
        expect(bucket.tryConsume()).toBe(false);
    });

    test('different IPs have separate buckets', () => {
        const bucket1 = rateLimiter.getBucket('127.0.0.1');
        const bucket2 = rateLimiter.getBucket('127.0.0.2');
        
        // Consume all tokens from bucket1
        for (let i = 0; i < 10; i++) {
            bucket1.tryConsume();
        }
        
        // bucket2 should still have tokens
        expect(bucket2.tryConsume()).toBe(true);
    });

    test('tokens refill over time', (done) => {
        const bucket = rateLimiter.getBucket('127.0.0.1');
        
        // Consume all tokens
        for (let i = 0; i < 10; i++) {
            bucket.tryConsume();
        }
        
        // Wait for refill
        setTimeout(() => {
            expect(bucket.tryConsume()).toBe(true);
            done();
        }, 1100);
    });
});