# Log Ingestion Engine

A centralized log ingestion system that collects, validates, enriches, routes, and stores logs from multiple microservices with real-time monitoring and alerting capabilities.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Tests](https://img.shields.io/badge/tests-44%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-71.78%25-orange)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Monitoring & Alerting](#monitoring--alerting)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

## Overview

This project solves the problem of scattered, inconsistent logs across microservices by providing a single API endpoint for log ingestion. It validates, enriches, and routes logs to appropriate storage with real-time metrics and alerting.

### Problem Statement

Before this system:

- 12 microservices write logs in inconsistent formats
- Debugging requires SSH-ing into multiple servers
- No real-time visibility into application errors
- Compliance audit trails don't exist
- Outages take hours to resolve

### Solution

After implementation:

- Single API endpoint for all log ingestion
- Real-time metrics and dashboards
- Automatic routing and storage
- Alert on error rates and queue backlog
- Complete audit trails
- 30-second identification of failing services

## Features

### Phase 1: Ingestion & Validation

- **HTTP Endpoint**: `POST /logs` accepts JSON array of log entries
- **Validation**: Required fields (timestamp, service, level, message)
- **Rate Limiting**: Token bucket algorithm, configurable per IP
- **Error Handling**: Detailed error messages for invalid logs

### Phase 2: Routing & Enrichment

- **In-Memory Channel**: Buffered queue with configurable size
- **Log Enrichment**: Adds `received_at`, `source_ip`, `env`
- **Static Routing**: YAML-based routing rules
- **Operators**: equals, contains, starts_with

### Phase 3: Storage & Queuing

- **RabbitMQ Integration**: Durable queues with fallback
- **SQLite Storage**: Separate databases per service
- **Batch Writing**: 100 logs or 1 second intervals
- **Retry Logic**: 3 attempts with exponential backoff
- **Dead Letter**: Failed logs persisted to `logs-failed.json`

### Phase 4: Monitoring & Reporting

- **Metrics Collection**: Total logs, levels, services, throughput
- **Dashboard**: Real-time HTML dashboard with auto-refresh
- **Alerting**: Error rate, queue backlog, throughput alerts
- **Top Services**: Ranking by log volume

## Architecture

```
+-------------+
|  Services   |
|  (12 apps)  |
+------+------+
       | HTTP POST /logs
       v
+-----------------------------------------+
|         Log Ingestion Engine            |
|                                         |
|  +----------+  +----------+             |
|  |  Rate    |->| Validate |             |
|  | Limiter  |  |          |             |
|  +----------+  +----+-----+             |
|                     |                   |
|  +----------+  +----v-----+             |
|  | Enrich   |<-| Channel  |             |
|  |          |  |  Queue   |             |
|  +----+-----+  +----------+             |
|       |                                 |
|  +----v-----+  +----------+             |
|  |  Router  |->| RabbitMQ |             |
|  |          |  |  Queue   |             |
|  +----+-----+  +----+-----+             |
|       |              |                  |
|  +----v-----+  +----v-----+             |
|  |  SQLite  |<-|  Batch   |             |
|  | Storage  |  |  Writer  |             |
|  +----------+  +----------+             |
|                                         |
|  +----------+  +----------+             |
|  | Metrics  |->|Dashboard |             |
|  +----------+  +----------+             |
|                                         |
|  +----------+  +----------+             |
|  |  Alerts  |<-|  Alert   |             |
|  +----------+  | Manager  |             |
|                +----------+             |
+-----------------------------------------+
```

### Data Flow

1. **Ingestion**: Services send logs via HTTP POST
2. **Validation**: Check required fields and formats
3. **Rate Limiting**: Token bucket per IP address
4. **Enrichment**: Add metadata (timestamp, IP, env)
5. **Routing**: Determine destination based on rules
6. **Queuing**: RabbitMQ with in-memory fallback
7. **Storage**: SQLite databases per service
8. **Monitoring**: Metrics collection and alerting

## Tech Stack

| Technology | Purpose        | Version  |
| ---------- | -------------- | -------- |
| Node.js    | Runtime        | >=18.0.0 |
| Express    | Web framework  | 4.18.2   |
| RabbitMQ   | Message queue  | 3.x      |
| SQLite     | Database       | 3.x      |
| js-yaml    | Config parsing | 4.x      |
| Jest       | Testing        | 29.x     |
| Supertest  | API testing    | 6.x      |

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **RabbitMQ** (optional, for production)
- **SQLite** CLI (optional, for debugging)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/TallamGilbert/log-ingestion-engine.git
cd log-ingestion-engine
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

### 4. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 5. Verify Installation

```bash
curl http://localhost:8080/health
# {"status":"healthy","timestamp":"...","uptime":...}
```

## Configuration

### Environment Variables

| Variable                | Description           | Default     |
| ----------------------- | --------------------- | ----------- |
| PORT                    | Server port           | 8080        |
| NODE_ENV                | Environment           | development |
| RATE_LIMIT              | Requests per second   | 1000        |
| CHANNEL_BUFFER_SIZE     | Channel buffer size   | 10000       |
| CONSUMER_BATCH_SIZE     | Consumer batch size   | 50          |
| RABBITMQ_HOST           | RabbitMQ host         | localhost   |
| RABBITMQ_PORT           | RabbitMQ port         | 5672        |
| RABBITMQ_USER           | RabbitMQ username     | guest       |
| RABBITMQ_PASS           | RabbitMQ password     | guest       |
| SQLITE_PATH             | SQLite directory      | ./data      |
| BATCH_WRITE_SIZE        | Batch write size      | 100         |
| BATCH_WRITE_INTERVAL    | Batch interval (ms)   | 1000        |
| MAX_RETRIES             | Max retry attempts    | 3           |
| ERROR_RATE_THRESHOLD    | Alert threshold (%)   | 10          |
| QUEUE_BACKLOG_THRESHOLD | Queue alert threshold | 5000        |

### Routing Rules (config/rules.yaml)

```yaml
rules:
  - name: "route-errors"
    condition:
      field: "level"
      operator: "equals"
      value: "ERROR"
    destination: "service1"

  - name: "route-warnings"
    condition:
      field: "level"
      operator: "equals"
      value: "WARN"
    destination: "service2"

default_destination: "service3"
```

## API Reference

### POST /logs

Ingest log entries.

**Request:**

```json
POST /logs
Content-Type: application/json

[
  {
    "timestamp": "2024-01-15T10:30:00Z",
    "service": "auth-service",
    "level": "INFO",
    "message": "User logged in successfully"
  }
]
```

**Response:**

```json
{
  "status": "accepted",
  "batchId": "uuid-here",
  "acceptedCount": 1
}
```

**Status Codes:**

| Code | Meaning                            |
| ---- | ---------------------------------- |
| 202  | Accepted - Logs accepted           |
| 400  | Bad Request - Invalid log data     |
| 413  | Payload Too Large - Over 1MB       |
| 415  | Unsupported Media Type - Not JSON  |
| 429  | Too Many Requests - Rate limited   |
| 503  | Service Unavailable - Channel full |

### GET /health

Health check endpoint.

```json
{
  "status": "healthy",
  "uptime": 123.45,
  "channelBufferSize": 0,
  "queueStatus": {},
  "storageStats": {}
}
```

### GET /metrics

Retrieve current metrics.

```json
{
  "total_logs": 1234,
  "logs_by_level": {
    "INFO": 1000,
    "ERROR": 234
  },
  "logs_by_service": {
    "auth-service": 500,
    "claims-service": 734
  },
  "error_rate": 18.9,
  "throughput": 850.5,
  "queue_backlog": 0
}
```

### GET /dashboard

HTML dashboard with real-time metrics.

### GET /alerts

Active alerts.

### GET /routing/rules

Current routing configuration.

### GET /queue/status

Queue system status.

## Usage Examples

### Basic Log Ingestion

```bash
curl -X POST http://localhost:8080/logs \
  -H "Content-Type: application/json" \
  -d '[{
    "timestamp": "2024-01-15T10:30:00Z",
    "service": "auth-service",
    "level": "INFO",
    "message": "User login successful"
  }]'
```

### Batch Log Ingestion

```bash
curl -X POST http://localhost:8080/logs \
  -H "Content-Type: application/json" \
  -d '[
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "service": "auth-service",
      "level": "INFO",
      "message": "Login successful"
    },
    {
      "timestamp": "2024-01-15T10:30:01Z",
      "service": "claims-service",
      "level": "ERROR",
      "message": "Database connection failed"
    }
  ]'
```

### Node.js Client

```javascript
const axios = require("axios");

async function sendLog(service, level, message) {
  try {
    const response = await axios.post(
      "http://localhost:8080/logs",
      [
        {
          timestamp: new Date().toISOString(),
          service,
          level,
          message,
        },
      ],
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    console.log("Log sent:", response.data);
  } catch (error) {
    console.error("Failed to send log:", error.response?.data);
  }
}

sendLog("auth-service", "INFO", "User logged in");
```

### Python Client

```python
import requests
from datetime import datetime

def send_log(service, level, message):
    url = 'http://localhost:8080/logs'
    payload = [{
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'service': service,
        'level': level,
        'message': message
    }]

    response = requests.post(url, json=payload)
    return response.json()

result = send_log('claims-service', 'ERROR', 'Processing failed')
print(result)
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Unit tests
npm test tests/unit/validation.test.js
npm test tests/unit/rateLimiter.test.js
npm test tests/unit/channel.test.js
npm test tests/unit/enricher.test.js
npm test tests/unit/router.test.js

# Integration tests
npm test tests/integration/api.test.js

# Load tests
npm run load:test
```

### Load Testing

```bash
# Default: 10 connections, 100 requests each
npm run load:test

# Custom: 20 connections, 50 requests each
CONCURRENT=20 REQUESTS=50 npm run load:test

# Heavy: 50 connections, 1000 requests each
CONCURRENT=50 REQUESTS=1000 npm run load:test:1000
```

### Test Coverage

```bash
npm test -- --coverage
```

Current coverage: 71.78%

## Project Structure

```
log-ingestion-engine/
├── config/
│   └── rules.yaml              # Routing rules
├── src/
│   ├── index.js                # Main application
│   ├── ingestion/
│   │   ├── channel.js          # In-memory queue
│   │   └── enricher.js         # Log enrichment
│   ├── middleware/
│   │   └── rateLimiter.js      # Rate limiting
│   ├── monitoring/
│   │   ├── metricsCollector.js # Metrics collection
│   │   ├── alertManager.js     # Alert management
│   │   └── dashboard.html      # Dashboard UI
│   ├── routing/
│   │   └── router.js           # Log routing
│   ├── storage/
│   │   ├── queueManager.js     # Queue management
│   │   ├── rabbitmqPublisher.js # RabbitMQ integration
│   │   ├── fallbackQueue.js    # In-memory fallback
│   │   ├── sqliteStorage.js    # SQLite storage
│   │   ├── batchWriter.js      # Batch writing
│   │   ├── retryHandler.js     # Retry logic
│   │   └── storageManager.js   # Storage orchestration
│   └── validation/
│       └── logValidator.js     # Log validation
├── tests/
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── load/                   # Load tests
├── .env.example                # Configuration template
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies
└── README.md                   # Documentation
```

## Monitoring & Alerting

### Dashboard

Access at `http://localhost:8080/dashboard`

Features:

- Total logs counter
- Throughput (logs/sec)
- Error rate with color coding
- Queue backlog
- Top 5 services by volume
- Log level breakdown
- System status

### Alert Conditions

| Alert           | Threshold      | Default |
| --------------- | -------------- | ------- |
| High Error Rate | >10% over 60s  | Enabled |
| Queue Backlog   | >5000 messages | Enabled |
| Zero Throughput | 10s no logs    | Enabled |
| Dead Letter     | >1000 entries  | Enabled |

### Alert Delivery

Alerts are delivered via:

- Console logs
- API endpoint (`GET /alerts`)

## Troubleshooting

**RabbitMQ not connecting:**

```bash
sudo systemctl status rabbitmq-server
sudo systemctl start rabbitmq-server

# Or use Docker
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

**Port already in use:**

```bash
lsof -i :8080
kill -9 <PID>
```

**SQLite database locked:**

```bash
ps aux | grep node
pkill node
rm data/*.db
```

## Performance

### Load Test Results

| Metric          | Value            |
| --------------- | ---------------- |
| Throughput      | 734-871 req/sec  |
| Average Latency | 11-21ms          |
| Max Latency     | 61-80ms          |
| Error Rate      | 0% (normal load) |

### System Requirements

- CPU: 2+ cores
- RAM: 2GB+ (for high throughput)
- Disk: 1GB+ (for SQLite storage)
- Network: 100Mbps+

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/your-feature
```

3. Make changes
4. Run tests

```bash
npm test
```

5. Commit changes

```bash
git add .
git commit -m "feat: your feature description"
```

6. Push and create PR

```bash
git push origin feature/your-feature
```

### Code Style

- Use ES6+ syntax
- Follow existing patterns
- Add tests for new features
- Maintain >70% coverage

### Commit Convention

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
test: Add tests
refactor: Refactor code
perf: Improve performance
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Authors

Gilbert Tallam - [GitHub](https://github.com/TallamGilbert)

## Acknowledgments

- Express.js team
- RabbitMQ team
- SQLite team
- Jest testing framework

## Support

For support, please:

1. Check the documentation
2. Search issues
3. Open a new issue

## Roadmap

- [ ] Redis caching layer
- [ ] Elasticsearch integration
- [ ] Kubernetes deployment
- [ ] Prometheus metrics export
- [ ] Grafana dashboard templates
- [ ] Multi-region support
- [ ] Compression for large payloads

## Project Status

**Current Version**: 1.0.0

**Completed Phases:**

- [x] Phase 1: Ingestion & Validation
- [x] Phase 2: Routing & Enrichment
- [x] Phase 3: Storage & Queuing
- [x] Phase 4: Monitoring & Reporting

**Test Status:**

- [x] 44 tests passing
- [x] 71.78% code coverage
- [x] Load tested at 1000 req/sec

---

© 2026 Log Ingestion Engine. All rights reserved.
