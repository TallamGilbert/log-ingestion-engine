// src/validation/logValidator.js
const VALID_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
const MAX_SERVICE_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 10000;

class LogValidator {
    static validateLogEntry(log, index) {
        const errors = [];

        // Check timestamp
        if (!log.timestamp) {
            errors.push({
                field: 'timestamp',
                reason: 'timestamp is required'
            });
        } else {
            const timestampDate = new Date(log.timestamp);
            if (isNaN(timestampDate.getTime())) {
                errors.push({
                    field: 'timestamp',
                    reason: 'must be a valid ISO 8601 timestamp'
                });
            }
        }

        // Check service
        if (!log.service) {
            errors.push({
                field: 'service',
                reason: 'service is required'
            });
        } else if (typeof log.service !== 'string') {
            errors.push({
                field: 'service',
                reason: 'must be a string'
            });
        } else if (log.service.length > MAX_SERVICE_LENGTH) {
            errors.push({
                field: 'service',
                reason: `must be less than ${MAX_SERVICE_LENGTH} characters`
            });
        }

        // Check level
        if (!log.level) {
            errors.push({
                field: 'level',
                reason: 'level is required'
            });
        } else if (!VALID_LEVELS.includes(log.level)) {
            errors.push({
                field: 'level',
                reason: `must be one of ${VALID_LEVELS.join('/')}`
            });
        }

        // Check message
        if (!log.message) {
            errors.push({
                field: 'message',
                reason: 'message is required'
            });
        } else if (typeof log.message !== 'string') {
            errors.push({
                field: 'message',
                reason: 'must be a string'
            });
        } else if (log.message.length > MAX_MESSAGE_LENGTH) {
            errors.push({
                field: 'message',
                reason: `must be less than ${MAX_MESSAGE_LENGTH} characters`
            });
        }

        return errors;
    }

    static validateBatch(logs) {
        const validLogs = [];
        const invalidLogs = [];

        logs.forEach((log, index) => {
            const errors = this.validateLogEntry(log, index);
            
            if (errors.length === 0) {
                validLogs.push(log);
            } else {
                invalidLogs.push({
                    index,
                    log,
                    errors
                });
            }
        });

        return { validLogs, invalidLogs };
    }
}

module.exports = LogValidator;