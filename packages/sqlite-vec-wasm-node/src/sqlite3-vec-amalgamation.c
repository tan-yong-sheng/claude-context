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
 * Initialize sqlite-vec extension on a database connection.
 * This is called automatically for every new connection via sqlite3_auto_extension.
 */
static int core_init_sqlite_vec(
    sqlite3 *db,
    char **pzErrMsg,
    const sqlite3_api_routines *pApi
) {
    /* When SQLITE_CORE is defined, the extension init function expects no pApi */
    (void)pApi;
    return sqlite3_sqlitevec_init(db, pzErrMsg, NULL);
}

/*
 * Called from vfs-pre.js after the WASM module is initialized.
 * Registers sqlite-vec to auto-initialize on all new database connections.
 */
void sqlite_vec_auto_init(void) {
    sqlite3_auto_extension((void(*)(void))core_init_sqlite_vec);
}
