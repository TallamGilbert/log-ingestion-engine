// tests/integration/api.test.js
const request = require('supertest');
const app = require('../../src/index');

describe('POST /logs', () => {
    test('accepts valid log batch', async () => {
        const response = await request(app)
            .post('/logs')
            .set('Content-Type', 'application/json')
            .send([{
                timestamp: '2024-01-15T10:30:00Z',
                service: 'test-service',
                level: 'INFO',
                message: 'Test message'
            }]);
        
        expect(response.status).toBe(202);
        expect(response.body.status).toBe('accepted');
        expect(response.body.batchId).toBeDefined();
        expect(response.body.acceptedCount).toBe(1);
    });

    test('returns 400 for non-array body', async () => {
        const response = await request(app)
            .post('/logs')
            .set('Content-Type', 'application/json')
            .send({ not: 'an array' });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
    });

    test('returns 415 for wrong content type', async () => {
        const response = await request(app)
            .post('/logs')
            .set('Content-Type', 'text/plain')
            .send('not json');
        
        expect(response.status).toBe(415);
    });

    test('returns 400 for malformed JSON', async () => {
        const response = await request(app)
            .post('/logs')
            .set('Content-Type', 'application/json')
            .send('{"invalid": "json"');
        
        expect(response.status).toBe(400);
    });

    test('returns 400 for invalid log entries', async () => {
        const response = await request(app)
            .post('/logs')
            .set('Content-Type', 'application/json')
            .send([{
                timestamp: 'invalid',
                service: 'test-service',
                level: 'INVALID',
                message: 'Test'
            }]);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details).toBeDefined();
    });

    test('handles partial acceptance', async () => {
        const response = await request(app)
            .post('/logs')
            .set('Content-Type', 'application/json')
            .send([
                {
                    timestamp: '2024-01-15T10:30:00Z',
                    service: 'valid-service',
                    level: 'INFO',
                    message: 'Valid log'
                },
                {
                    timestamp: '2024-01-15T10:30:00Z',
                    service: 'invalid-service',
                    level: 'INVALID',
                    message: 'Invalid log'
                }
            ]);
        
        expect(response.status).toBe(202);
        expect(response.body.acceptedCount).toBe(1);
        expect(response.body.rejectedCount).toBe(1);
    });
});