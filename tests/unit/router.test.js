const { LogRouter } = require('../../src/routing/router');

describe('LogRouter', () => {
    let router;
    
    beforeEach(() => {
        router = new LogRouter('config/rules.yaml');
    });

    test('routes ERROR logs to service1', () => {
        const log = { level: 'ERROR' };
        expect(router.route(log)).toBe('service1');
    });

    test('routes WARN logs to service2', () => {
        const log = { level: 'WARN' };
        expect(router.route(log)).toBe('service2');
    });

    test('routes INFO logs to default', () => {
        const log = { level: 'INFO' };
        expect(router.route(log)).toBe('service3');
    });

    test('supports contains operator', () => {
        const customRouter = new LogRouter(null);
        customRouter.rules = [{
            name: 'route-error-message',
            condition: { field: 'message', operator: 'contains', value: 'error' },
            destination: 'service1'
        }];
        
        expect(customRouter.route({ message: 'this is an error' })).toBe('service1');
    });

    test('supports starts_with operator', () => {
        const customRouter = new LogRouter(null);
        customRouter.rules = [{
            name: 'route-auth',
            condition: { field: 'service', operator: 'starts_with', value: 'auth' },
            destination: 'service1'
        }];
        
        expect(customRouter.route({ service: 'auth-service' })).toBe('service1');
    });

    test('routes batch of logs', () => {
        const logs = [
            { level: 'ERROR' },
            { level: 'INFO' }
        ];
        
        const routed = router.routeBatch(logs);
        expect(routed.service1).toHaveLength(1);
        expect(routed.service3).toHaveLength(1);
    });
});
