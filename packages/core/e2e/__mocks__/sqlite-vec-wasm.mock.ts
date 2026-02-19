/**
 * Mock for @tan-yong-sheng/sqlite-vec-wasm-node
 * Used in Jest tests to avoid loading WASM module
 */

interface MockRow {
    [key: string]: any;
}

// Global registry of mock databases by path to simulate persistence
const mockDatabaseRegistry = new Map<string, MockDatabase>();

export class MockStatement {
    private sql: string;
    private db: MockDatabase;

    constructor(db: MockDatabase, sql: string) {
        this.db = db;
        this.sql = sql;
    }

    run(values?: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
        this.db._assertOpen();

        // Handle INSERT statements
        const insertMatch = this.sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
        if (insertMatch) {
            const tableName = insertMatch[1];
            const row = this.db._parseInsert(this.sql, values);
            if (row) {
                this.db._insertRow(tableName, row);
            }
        }

        // Handle DELETE statements
        const deleteMatch = this.sql.match(/DELETE\s+FROM\s+(\w+)/i);
        if (deleteMatch) {
            const tableName = deleteMatch[1];
            this.db._deleteRows(tableName, this.sql, values);
        }

        return { changes: 1, lastInsertRowid: ++this.db.lastRowid };
    }

    all(values?: unknown[]): Record<string, unknown>[] {
        this.db._assertOpen();

        // Handle SELECT from documents
        const selectMatch = this.sql.match(/SELECT\s+.+\s+FROM\s+(\w+)/i);
        if (selectMatch) {
            const tableName = selectMatch[1];
            return this.db._selectFrom(tableName, this.sql, values);
        }

        return [];
    }

    get(values?: unknown[]): Record<string, unknown> | null {
        this.db._assertOpen();

        // Handle SELECT from sqlite_master
        if (this.sql.includes('sqlite_master')) {
            const nameMatch = this.sql.match(/name\s*=\s*\?/);
            if (nameMatch && values && values.length > 0) {
                const tableName = values[0] as string;
                if (this.db._hasTable(tableName)) {
                    return { name: tableName };
                }
            }
            return null;
        }

        // Handle SELECT COUNT
        if (this.sql.includes('COUNT(*)')) {
            const tableMatch = this.sql.match(/FROM\s+(\w+)/i);
            if (tableMatch) {
                const tableName = tableMatch[1];
                const count = this.db._getRowCount(tableName);
                return { count };
            }
        }

        // Handle SELECT from documents
        const selectMatch = this.sql.match(/SELECT\s+.+\s+FROM\s+(\w+)/i);
        if (selectMatch) {
            const tableName = selectMatch[1];
            const rows = this.db._selectFrom(tableName, this.sql, values);
            return rows.length > 0 ? rows[0] : null;
        }

        return null;
    }

    finalize(): void {
        // No-op for mock
    }
}

export class MockDatabase {
    private closed = false;
    private tables = new Map<string, MockRow[]>();
    lastRowid = 0;
    private dbPath: string;

    constructor(filename: string, _options?: { fileMustExist?: boolean; readOnly?: boolean }) {
        this.dbPath = filename;
    }

    get isOpen(): boolean {
        return !this.closed;
    }

    get inTransaction(): boolean {
        return false;
    }

    _assertOpen(): void {
        if (this.closed) {
            throw new Error('Database is closed');
        }
    }

    _hasTable(tableName: string): boolean {
        return this.tables.has(tableName);
    }

    _getRowCount(tableName: string): number {
        const table = this.tables.get(tableName);
        return table ? table.length : 0;
    }

    _parseInsert(sql: string, values?: unknown[]): MockRow | null {
        // Extract column names from INSERT statement
        const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
        if (!columnsMatch) return null;

        const columns = columnsMatch[1].split(',').map(c => c.trim());

        // Build row object
        const row: MockRow = {};
        if (values && Array.isArray(values)) {
            columns.forEach((col, i) => {
                row[col] = values[i];
            });
        }
        return row;
    }

    _insertRow(tableName: string, row: MockRow): void {
        if (!this.tables.has(tableName)) {
            this.tables.set(tableName, []);
        }
        this.tables.get(tableName)!.push(row);
    }

    _deleteRows(tableName: string, sql: string, values?: unknown[]): void {
        const table = this.tables.get(tableName);
        if (!table) return;

        // Handle DELETE WHERE id = ?
        const whereMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
        if (whereMatch && values && values.length > 0) {
            const id = values[0];
            const index = table.findIndex(row => row.id === id);
            if (index >= 0) {
                table.splice(index, 1);
            }
        }
    }

    _selectFrom(tableName: string, _sql: string, _values?: unknown[]): MockRow[] {
        const table = this.tables.get(tableName);
        if (!table) return [];

        // Clone the table data
        return table.map(row => ({ ...row }));
    }

    exec(sql: string): void {
        this._assertOpen();

        // Handle CREATE TABLE
        const createMatch = sql.match(/CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        if (createMatch) {
            const tableName = createMatch[1];
            this.tables.set(tableName, []);
        }

        // Handle DROP TABLE
        const dropMatch = sql.match(/DROP\s+TABLE\s+IF\s+EXISTS\s+(\w+)/i);
        if (dropMatch) {
            const tableName = dropMatch[1];
            this.tables.delete(tableName);
        }

        // Handle PRAGMA (no-op for mock)
    }

    prepare(sql: string): MockStatement {
        this._assertOpen();
        return new MockStatement(this, sql);
    }

    run(sql: string, values?: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
        this._assertOpen();

        const stmt = new MockStatement(this, sql);
        const result = stmt.run(values);
        stmt.finalize();
        return result;
    }

    all(sql: string, values?: unknown[]): Record<string, unknown>[] {
        this._assertOpen();

        const stmt = new MockStatement(this, sql);
        const result = stmt.all(values);
        stmt.finalize();
        return result;
    }

    get(sql: string, values?: unknown[]): Record<string, unknown> | null {
        this._assertOpen();

        const stmt = new MockStatement(this, sql);
        const result = stmt.get(values);
        stmt.finalize();
        return result;
    }

    function(_name: string, _func: (...args: unknown[]) => unknown, _options?: { deterministic?: boolean }): this {
        return this;
    }

    transaction<T extends (...args: any[]) => any>(fn: T): T {
        const wrapped = (...args: any[]) => {
            try {
                const result = fn(...args);
                return result;
            } catch (err) {
                throw err;
            }
        };
        return wrapped as T;
    }

    close(): void {
        this.closed = true;
        // Remove from registry when closed
        mockDatabaseRegistry.delete(this.dbPath);
    }
}

// Export a factory function that returns the same instance for the same path
export const Database = Object.assign(
    function(filename: string, options?: { fileMustExist?: boolean; readOnly?: boolean }) {
        // Check if we already have an open database for this path
        const existing = mockDatabaseRegistry.get(filename);
        if (existing && existing.isOpen) {
            return existing;
        }
        // Create new database instance
        const db = new MockDatabase(filename, options);
        mockDatabaseRegistry.set(filename, db);
        return db;
    },
    { MockDatabase }
);

export { MockDatabase as SQLite3Error };
