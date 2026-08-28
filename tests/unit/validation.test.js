// tests/unit/validation.test.js
const LogValidator = require('../../src/validation/logValidator');

describe('LogValidator', () => {
    describe('validateLogEntry', () => {
        test('validates a correct log entry', () => {
            const log = {
                timestamp: '2024-01-15T10:30:00Z',
                service: 'test-service',
                level: 'INFO',
                message: 'Test message'
            };
            
            const errors = LogValidator.validateLogEntry(log, 0);
            expect(errors).toHaveLength(0);
        });

        test('rejects invalid level', () => {
            const log = {
                timestamp: '2024-01-15T10:30:00Z',
                service: 'test-service',
                level: 'INVALID',
                message: 'Test message'
            };
            
            const errors = LogValidator.validateLogEntry(log, 0);
            expect(errors).toContainEqual({
                field: 'level',
                reason: 'must be one of INFO/WARN/ERROR/DEBUG'
            });
        });

        test('rejects missing timestamp', () => {
            const log = {
                service: 'test-service',
                level: 'INFO',
                message: 'Test message'
            };
            
            const errors = LogValidator.validateLogEntry(log, 0);
            expect(errors).toContainEqual({
                field: 'timestamp',
                reason: 'timestamp is required'
            });
        });

        test('rejects invalid timestamp format', () => {
            const log = {
                timestamp: 'not-a-timestamp',
                service: 'test-service',
                level: 'INFO',
                message: 'Test message'
            };
            
            const errors = LogValidator.validateLogEntry(log, 0);
            expect(errors).toContainEqual({
                field: 'timestamp',
                reason: 'must be a valid ISO 8601 timestamp'
            });
        });

        test('rejects message too long', () => {
            const log = {
                timestamp: '2024-01-15T10:30:00Z',
                service: 'test-service',
                level: 'INFO',
                message: 'a'.repeat(10001)
            };
            
            const errors = LogValidator.validateLogEntry(log, 0);
            expect(errors).toContainEqual({
                field: 'message',
                reason: 'must be less than 10000 characters'
            });
        });
    });

    describe('validateBatch', () => {
        test('separates valid and invalid logs', () => {
            const logs = [
                {
                    timestamp: '2024-01-15T10:30:00Z',
                    service: 'test-service',
                    level: 'INFO',
                    message: 'Valid log'
                },
                {
                    timestamp: '2024-01-15T10:30:00Z',
                    service: 'test-service',
                    level: 'INVALID',
                    message: 'Invalid log'
                }
            ];
            
            const result = LogValidator.validateBatch(logs);
            expect(result.validLogs).toHaveLength(1);
            expect(result.invalidLogs).toHaveLength(1);
            expect(result.invalidLogs[0].index).toBe(1);
        });
    });
});