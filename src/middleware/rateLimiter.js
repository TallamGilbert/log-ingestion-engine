class TokenBucket {
    constructor(capacity, refillRate) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }

    refill() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000;
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
        this.buckets = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    getClientIp(req) {
        const forwardedFor = req.headers && req.headers['x-forwarded-for'];
        if (forwardedFor) {
            return forwardedFor.split(',')[0].trim();
        }
        return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
    }

    getBucket(ip) {
        if (!this.buckets.has(ip)) {
            this.buckets.set(ip, new TokenBucket(this.rateLimit, this.rateLimit));
        }
        return this.buckets.get(ip);
    }

    middleware(req, res, next) {
        const ip = this.getClientIp(req);
        const bucket = this.getBucket(ip);
        
        if (bucket.tryConsume()) {
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
            if (now - bucket.lastRefill > 300000) {
                this.buckets.delete(ip);
            }
        }
    }
}

// Export the class as default
module.exports = RateLimiter;

// Also export as named export
module.exports.RateLimiter = RateLimiter;
module.exports.TokenBucket = TokenBucket;

// Create and attach singleton instance
const rateLimit = parseInt(process.env.RATE_LIMIT || '1000');
module.exports.instance = new RateLimiter(rateLimit);
module.exports.default = module.exports.instance;
