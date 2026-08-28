const RabbitMQPublisher = require('./rabbitmqPublisher');
const FallbackQueue = require('./fallbackQueue');

class QueueManager {
    constructor() {
        this.rabbitmq = new RabbitMQPublisher();
        this.fallback = new FallbackQueue();
        this.usingFallback = false;
    }

    async initialize() {
        const connected = await this.rabbitmq.connect();
        this.usingFallback = !connected;
        
        if (this.usingFallback) {
            console.warn('Using fallback in-memory queue');
        }
        
        return connected;
    }

    async publish(log, destination) {
        if (this.usingFallback) {
            return this.fallback.push(destination, log);
        }
        
        try {
            return await this.rabbitmq.publish(log, destination);
        } catch (error) {
            console.error('RabbitMQ publish failed, using fallback:', error.message);
            this.usingFallback = true;
            return this.fallback.push(destination, log);
        }
    }

    async publishBatch(logs, destination) {
        if (this.usingFallback) {
            return this.fallback.pushBatch(destination, logs);
        }
        
        try {
            return await this.rabbitmq.publishBatch(logs, destination);
        } catch (error) {
            console.error('RabbitMQ batch publish failed, using fallback:', error.message);
            this.usingFallback = true;
            return this.fallback.pushBatch(destination, logs);
        }
    }

    getBatch(destination, batchSize = 100) {
        if (this.usingFallback) {
            return this.fallback.getBatch(destination, batchSize);
        }
        
        // For RabbitMQ, we'll use a consumer (implemented in REQ-008)
        return [];
    }

    async getQueueSize(destination) {
        if (this.usingFallback) {
            return this.fallback.getQueueSize(destination);
        }
        
        try {
            const queueName = `queue_${destination}`;
            return await this.rabbitmq.getQueueSize(queueName);
        } catch (error) {
            return this.fallback.getQueueSize(destination);
        }
    }

    getStatus() {
        return {
            usingFallback: this.usingFallback,
            rabbitmqConnected: this.rabbitmq.isConnected,
            fallbackQueueSizes: {
                service1: this.fallback.getQueueSize('service1'),
                service2: this.fallback.getQueueSize('service2'),
                service3: this.fallback.getQueueSize('service3')
            }
        };
    }

    async close() {
        await this.rabbitmq.close();
    }
}

module.exports = QueueManager;
