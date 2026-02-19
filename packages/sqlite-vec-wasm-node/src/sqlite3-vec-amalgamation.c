/*
 * SQLite amalgamation with sqlite-vec extension compiled in.
 *
 * This file includes both SQLite and sqlite-vec source code,
 * allowing them to be compiled together as a single WASM module.
 *
 * MIT License for node-sqlite3-wasm VFS code
 * Apache-2.0/MIT License for sqlite-vec
 */

/* Define SQLITE_CORE so sqlite-vec compiles directly into SQLite */
#define SQLITE_CORE 1

/* Include the SQLite amalgamation first */
#include "sqlite3.c"

/* Define SQLITE_CORE for sqlite-vec so it knows we're compiling into core */
#ifndef SQLITE_CORE
#define SQLITE_CORE 1
#endif

/* Include the sqlite-vec implementation */
#include "sqlite-vec.c"

/*
 * Initialize sqlite-vec extension for a specific database connection.
 * Called directly from JavaScript after opening a database.
 */
int sqlite_vec_init_for_db(sqlite3 *db) {
    return sqlite3_vec_init(db, NULL, NULL);
}
