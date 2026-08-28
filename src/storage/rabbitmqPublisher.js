const amqp = require('amqplib');

class RabbitMQPublisher {
    constructor(config = {}) {
        this.host = config.host || process.env.RABBITMQ_HOST || 'localhost';
        this.port = config.port || process.env.RABBITMQ_PORT || '5672';
        this.user = config.user || process.env.RABBITMQ_USER || 'guest';
        this.pass = config.pass || process.env.RABBITMQ_PASS || 'guest';
        this.connection = null;
        this.channel = null;
        this.isConnected = false;
        this.publishTimeout = 5000; // 5 seconds
        this.exchanges = ['exchange_service1', 'exchange_service2', 'exchange_service3'];
        this.queues = ['queue_service1', 'queue_service2', 'queue_service3'];
    }

    async connect() {
        try {
            const url = `amqp://${this.user}:${this.pass}@${this.host}:${this.port}`;
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            
            // Setup exchanges and queues
            for (let i = 0; i < this.exchanges.length; i++) {
                const exchange = this.exchanges[i];
                const queue = this.queues[i];
                
                // Create exchange
                await this.channel.assertExchange(exchange, 'direct', { durable: true });
                
                // Create queue
                await this.channel.assertQueue(queue, { durable: true });
                
                // Bind queue to exchange
                await this.channel.bindQueue(queue, exchange, 'log.write');
            }
            
            this.isConnected = true;
            console.log('Connected to RabbitMQ');
            return true;
        } catch (error) {
            console.error('Failed to connect to RabbitMQ:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    async publish(log, destination) {
        if (!this.isConnected) {
            throw new Error('RabbitMQ not connected');
        }

        const exchange = `exchange_${destination}`;
        const routingKey = 'log.write';
        
        try {
            const published = await this.channel.publish(
                exchange,
                routingKey,
                Buffer.from(JSON.stringify(log)),
                { persistent: true }
            );
            
            return published;
        } catch (error) {
            console.error(`Failed to publish to ${exchange}:`, error.message);
            throw error;
        }
    }

    async publishBatch(logs, destination) {
        if (!this.isConnected) {
            throw new Error('RabbitMQ not connected');
        }

        const exchange = `exchange_${destination}`;
        const routingKey = 'log.write';
        const results = [];
        
        for (const log of logs) {
            try {
                const published = this.channel.publish(
                    exchange,
                    routingKey,
                    Buffer.from(JSON.stringify(log)),
                    { persistent: true }
                );
                results.push({ log, published });
            } catch (error) {
                console.error(`Failed to publish log:`, error.message);
                results.push({ log, published: false, error: error.message });
            }
        }
        
        return results;
    }

    async getQueueSize(queueName) {
        if (!this.isConnected) {
            return 0;
        }
        
        try {
            const queue = await this.channel.checkQueue(queueName);
            return queue.messageCount;
        } catch (error) {
            return 0;
        }
    }

    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
            }
            if (this.connection) {
                await this.connection.close();
            }
            this.isConnected = false;
            console.log('Disconnected from RabbitMQ');
        } catch (error) {
            console.error('Error closing RabbitMQ connection:', error.message);
        }
    }
}

module.exports = RabbitMQPublisher;
