const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class SQLiteStorage {
    constructor(config = {}) {
        this.dbPath = config.dbPath || process.env.SQLITE_PATH || './data';
        this.databases = {};
        this.initializeDatabases();
    }

    initializeDatabases() {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }
        
        // Initialize databases for each service
        const services = ['service1', 'service2', 'service3'];
        
        for (const service of services) {
            const dbFile = path.join(this.dbPath, `logs_${service}.db`);
            const db = new Database(dbFile);
            
            // Create table if not exists
            db.exec(`
                CREATE TABLE IF NOT EXISTS logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    service TEXT NOT NULL,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    received_at TEXT NOT NULL,
                    source_ip TEXT,
                    env TEXT
                )
            `);
            
            // Create index on timestamp for faster queries
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_timestamp 
                ON logs(timestamp)
            `);
            
            this.databases[service] = db;
        }
        
        console.log('SQLite databases initialized');
    }

    insertLog(service, log) {
        const db = this.databases[service];
        
        if (!db) {
            throw new Error(`Database not found for service: ${service}`);
        }
        
        const stmt = db.prepare(`
            INSERT INTO logs (timestamp, service, level, message, received_at, source_ip, env)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        try {
            stmt.run(
                log.timestamp,
                log.service,
                log.level,
                log.message,
                log.received_at,
                log.source_ip || null,
                log.env || null
            );
            return true;
        } catch (error) {
            console.error(`Failed to insert log for ${service}:`, error.message);
            throw error;
        }
    }

    insertBatch(service, logs) {
        const db = this.databases[service];
        
        if (!db) {
            throw new Error(`Database not found for service: ${service}`);
        }
        
        const stmt = db.prepare(`
            INSERT INTO logs (timestamp, service, level, message, received_at, source_ip, env)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertMany = db.transaction((logs) => {
            for (const log of logs) {
                stmt.run(
                    log.timestamp,
                    log.service,
                    log.level,
                    log.message,
                    log.received_at,
                    log.source_ip || null,
                    log.env || null
                );
            }
        });
        
        try {
            insertMany(logs);
            return logs.length;
        } catch (error) {
            console.error(`Failed to insert batch for ${service}:`, error.message);
            throw error;
        }
    }

    getLogCount(service) {
        const db = this.databases[service];
        
        if (!db) {
            return 0;
        }
        
        const stmt = db.prepare('SELECT COUNT(*) as count FROM logs');
        const result = stmt.get();
        return result.count;
    }

    getTotalLogCount() {
        return Object.keys(this.databases).reduce((sum, service) => {
            return sum + this.getLogCount(service);
        }, 0);
    }

    close() {
        for (const db of Object.values(this.databases)) {
            db.close();
        }
        console.log('SQLite databases closed');
    }
}

module.exports = SQLiteStorage;
