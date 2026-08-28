const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class LogRouter {
    constructor(configPath = 'config/rules.yaml') {
        this.configPath = configPath;
        this.rules = [];
        this.defaultDestination = 'service3';
        this.loadRules();
    }

    loadRules() {
        try {
            const configFile = fs.readFileSync(this.configPath, 'utf8');
            const config = yaml.load(configFile);
            
            if (config.rules) {
                this.rules = config.rules;
            }
            
            if (config.default_destination) {
                this.defaultDestination = config.default_destination;
            }
            
            console.log(`Loaded ${this.rules.length} routing rules`);
        } catch (error) {
            console.error(`Failed to load routing rules: ${error.message}`);
            console.log('Using default routing rules');
            
            this.rules = [
                {
                    name: 'route-errors',
                    condition: { field: 'level', operator: 'equals', value: 'ERROR' },
                    destination: 'service1'
                },
                {
                    name: 'route-warnings',
                    condition: { field: 'level', operator: 'equals', value: 'WARN' },
                    destination: 'service2'
                }
            ];
        }
    }

    checkCondition(log, condition) {
        const { field, operator, value } = condition;
        
        if (!log[field]) {
            return false;
        }
        
        const logValue = log[field];
        
        switch (operator) {
            case 'equals':
                return logValue === value;
            case 'contains':
                return logValue.includes(value);
            case 'starts_with':
                return logValue.startsWith(value);
            default:
                return false;
        }
    }

    route(log) {
        for (const rule of this.rules) {
            if (this.checkCondition(log, rule.condition)) {
                return rule.destination;
            }
        }
        
        return this.defaultDestination;
    }

    routeBatch(logs) {
        const routedLogs = {};
        
        for (const log of logs) {
            const destination = this.route(log);
            
            if (!routedLogs[destination]) {
                routedLogs[destination] = [];
            }
            
            routedLogs[destination].push(log);
        }
        
        return routedLogs;
    }

    getRules() {
        return this.rules;
    }

    reloadRules() {
        this.loadRules();
    }
}

const router = new LogRouter();

module.exports = router;
module.exports.LogRouter = LogRouter;
