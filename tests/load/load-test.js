// tests/load/load-test.js
const http = require('http');

class LoadTester {
    constructor(options = {}) {
        this.targetHost = options.host || 'localhost';
        this.targetPort = options.port || 8080;
        this.concurrentConnections = options.concurrent || 10;
        this.requestsPerConnection = options.requests || 100;
        this.duration = options.duration || 10000; // 10 seconds
        this.results = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            rateLimitedRequests: 0,
            validationErrors: 0,
            serverErrors: 0,
            totalLatency: 0,
            maxLatency: 0,
            minLatency: Infinity
        };
    }

    generateLogEntry() {
        const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
        const services = ['service1', 'service2', 'service3', 'service4', 'service5'];
        
        return {
            timestamp: new Date().toISOString(),
            service: services[Math.floor(Math.random() * services.length)],
            level: levels[Math.floor(Math.random() * levels.length)],
            message: `Test log message ${Math.random().toString(36).substring(7)}`
        };
    }

    async sendRequest(connectionId) {
        const logs = Array.from({ length: 5 }, () => this.generateLogEntry());
        
        return new Promise((resolve) => {
            const startTime = Date.now();
            const postData = JSON.stringify(logs);
            
            const options = {
                hostname: this.targetHost,
                port: this.targetPort,
                path: '/logs',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const latency = Date.now() - startTime;
                    this.results.totalRequests++;
                    this.results.totalLatency += latency;
                    this.results.maxLatency = Math.max(this.results.maxLatency, latency);
                    this.results.minLatency = Math.min(this.results.minLatency, latency);
                    
                    if (res.statusCode === 202) {
                        this.results.successfulRequests++;
                    } else if (res.statusCode === 429) {
                        this.results.rateLimitedRequests++;
                    } else if (res.statusCode === 400) {
                        this.results.validationErrors++;
                    } else if (res.statusCode >= 500) {
                        this.results.serverErrors++;
                    } else {
                        this.results.failedRequests++;
                    }
                    
                    resolve();
                });
            });

            req.on('error', (error) => {
                this.results.failedRequests++;
                this.results.totalRequests++;
                resolve();
            });

            req.write(postData);
            req.end();
        });
    }

    async run() {
        console.log(`Starting load test: ${this.concurrentConnections} connections, ${this.requestsPerConnection} requests each`);
        console.log(`Target: http://${this.targetHost}:${this.targetPort}/logs`);
        console.log('-----------------------------------');

        const startTime = Date.now();
        const connections = [];

        for (let i = 0; i < this.concurrentConnections; i++) {
            connections.push(this.runConnection(i));
        }

        await Promise.all(connections);
        const totalTime = (Date.now() - startTime) / 1000;

        this.printResults(totalTime);
    }

    async runConnection(connectionId) {
        for (let i = 0; i < this.requestsPerConnection; i++) {
            await this.sendRequest(connectionId);
            
            // Small delay to simulate realistic traffic
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    printResults(totalTime) {
        const avgLatency = this.results.totalLatency / this.results.totalRequests;
        const throughput = this.results.totalRequests / totalTime;
        
        console.log('\nLoad Test Results:');
        console.log('-----------------------------------');
        console.log(`Total Duration: ${totalTime.toFixed(2)} seconds`);
        console.log(`Total Requests: ${this.results.totalRequests}`);
        console.log(`Successful: ${this.results.successfulRequests} (${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%)`);
        console.log(`Rate Limited: ${this.results.rateLimitedRequests}`);
        console.log(`Validation Errors: ${this.results.validationErrors}`);
        console.log(`Server Errors: ${this.results.serverErrors}`);
        console.log(`Failed: ${this.results.failedRequests}`);
        console.log(`\nLatency Statistics:`);
        console.log(`Average: ${avgLatency.toFixed(2)}ms`);
        console.log(`Min: ${this.results.minLatency}ms`);
        console.log(`Max: ${this.results.maxLatency}ms`);
        console.log(`\nThroughput: ${throughput.toFixed(2)} requests/second`);
    }
}

// Run load test if called directly
if (require.main === module) {
    const tester = new LoadTester({
        host: process.env.TEST_HOST || 'localhost',
        port: parseInt(process.env.TEST_PORT || '8080'),
        concurrent: parseInt(process.env.CONCURRENT || '10'),
        requests: parseInt(process.env.REQUESTS || '100')
    });
    
    tester.run().catch(console.error);
}

module.exports = LoadTester;