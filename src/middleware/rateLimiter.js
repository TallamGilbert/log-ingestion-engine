// src/middleware/rateLimiter.js
class TokenBucket {
    constructor(capacity, refillRate) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillRate = refillRate; // tokens per second
        this.lastRefill = Date.now();
    }

    refill() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000; // in seconds
        const tokensToAdd = timePassed * this.refillRate;
        
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    tryConsume(tokens = 1) {
        this.refill();
        
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        
        return false;
    }

    getTokens() {
        this.refill();
        return this.tokens;
    }
}

class RateLimiter {
    constructor(rateLimit = 1000) {
        this.rateLimit = rateLimit;
        this.buckets = new Map(); // Map of IP -> TokenBucket
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
    }

    getBucket(ip) {
        if (!this.buckets.has(ip)) {
            this.buckets.set(ip, new TokenBucket(this.rateLimit, this.rateLimit));
        }
        return this.buckets.get(ip);
    }

    middleware(req, res, next) {
        const ip = req.ip || req.connection.remoteAddress;
        const bucket = this.getBucket(ip);
        
        if (bucket.tryConsume()) {
            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', this.rateLimit);
            res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.getTokens()));
            next();
        } else {
            res.setHeader('Retry-After', '1');
            res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: 1
            });
        }
    }

    cleanup() {
        const now = Date.now();
        for (const [ip, bucket] of this.buckets.entries()) {
            // Remove buckets that haven't been used in 5 minutes
            if (now - bucket.lastRefill > 300000) {
                this.buckets.delete(ip);
            }
        }
    }

    getStatus(ip) {
        const bucket = this.getBucket(ip);
        return {
            tokens: bucket.getTokens(),
            capacity: bucket.capacity,
            refillRate: bucket.refillRate
        };
    }
}

// Create singleton instance
const rateLimit = parseInt(process.env.RATE_LIMIT || '1000');
const rateLimiter = new RateLimiter(rateLimit);

module.exports = rateLimiter;