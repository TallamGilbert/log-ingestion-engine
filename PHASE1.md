# Phase 1: Ingestion & Validation

## Overview

Phase 1 implements the basic HTTP endpoint for log ingestion with validation and rate limiting.

## Features Implemented

### REQ-001: HTTP Endpoint

- `POST /logs` accepts JSON array of log entries
- Returns `202 Accepted` with batch ID on success
- Returns `400 Bad Request` for malformed JSON
- Returns `415 Unsupported Media Type` for wrong content type
- Returns `413 Payload Too Large` for payloads over 1MB

### REQ-002: Log Validation

- Validates required fields: timestamp, service, level, message
- Supports partial batch acceptance
- Returns specific error messages for validation failures

### REQ-003: Rate Limiting

- Token bucket implementation
- Configurable via `RATE_LIMIT` environment variable
- Returns `429 Too Many Requests` when exceeded
- Applied per IP address

## API Usage

### Send logs:

```bash
curl -X POST http://localhost:8080/logs \
  -H "Content-Type: application/json" \
  -d '[{
    "timestamp": "2024-01-15T10:30:00Z",
    "service": "my-service",
    "level": "INFO",
    "message": "Service started"
  }]'
```

### Response:

json

```bash

{
  "status": "accepted",
  "batchId": "uuid-here",
  "acceptedCount": 1
}
```

### Testing

Unit Tests:

```bash
npm test
```

### Integration Tests:

```bash
npm run test:integration
```

### Load Tests:

```bash
npm run load:test
```
