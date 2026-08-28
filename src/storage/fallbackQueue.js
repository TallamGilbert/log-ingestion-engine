class FallbackQueue {
    constructor() {
        this.queues = {
            service1: [],
            service2: [],
            service3: []
        };
        this.maxQueueSize = 10000;
    }

    push(destination, log) {
        if (!this.queues[destination]) {
            this.queues[destination] = [];
        }
        
        if (this.queues[destination].length >= this.maxQueueSize) {
            return false;
        }
        
        this.queues[destination].push(log);
        return true;
    }

    pushBatch(destination, logs) {
        let pushed = 0;
        for (const log of logs) {
            if (this.push(destination, log)) {
                pushed++;
            } else {
                break;
            }
        }
        return pushed;
    }

    getBatch(destination, batchSize = 100) {
        if (!this.queues[destination]) {
            return [];
        }
        
        return this.queues[destination].splice(0, batchSize);
    }

    getQueueSize(destination) {
        if (!this.queues[destination]) {
            return 0;
        }
        return this.queues[destination].length;
    }

    getTotalSize() {
        return Object.values(this.queues).reduce((sum, queue) => sum + queue.length, 0);
    }

    clear() {
        this.queues = {
            service1: [],
            service2: [],
            service3: []
        };
    }
}

module.exports = FallbackQueue;
