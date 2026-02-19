SHELL := /bin/bash

# SQLite version
SQLITE_VERSION = 3510200
SQLITE_URL = https://www.sqlite.org/2026/sqlite-amalgamation-$(SQLITE_VERSION).zip
SQLITE_HASH = 9a9dd4eef7a97809bfacd84a7db5080a5c0eff7aaf1fc1aca20a6dc9a0c26f96
SQLITE_SRC_FILES = sqlite-src/sqlite3.c sqlite-src/sqlite3.h

# sqlite-vec version
SQLITE_VEC_VERSION = 0.1.7-alpha.10
SQLITE_VEC_URL = https://raw.githubusercontent.com/asg017/sqlite-vec/v$(SQLITE_VEC_VERSION)/sqlite-vec.c
SQLITE_VEC_H_TMPL_URL = https://raw.githubusercontent.com/asg017/sqlite-vec/v$(SQLITE_VEC_VERSION)/sqlite-vec.h.tmpl
SQLITE_VEC_SRC_FILES = sqlite-vec-src/sqlite-vec.c sqlite-vec-src/sqlite-vec.h

# Source files from node-sqlite3-wasm
SRC_DIR = src
JS_PRE_FILES = $(SRC_DIR)/api.js $(SRC_DIR)/vfs-pre.js
JS_LIB_FILES = $(SRC_DIR)/vfs.js
OBJECT_FILES = build/sqlite3.o build/vfs.o
EXPORTED_FUNCS_JSON = build/exp_funcs.json

# SQLite compile flags
SQLITE_FLAGS = \
	-DSQLITE_OMIT_DEPRECATED \
	-DSQLITE_OMIT_LOAD_EXTENSION \
	-DSQLITE_OMIT_UTF16 \
	-DSQLITE_OMIT_GET_TABLE \
	-DSQLITE_OMIT_PROGRESS_CALLBACK \
	-DSQLITE_OMIT_SHARED_CACHE \
	-DSQLITE_OMIT_TCL_VARIABLE \
	-DSQLITE_OMIT_DESERIALIZE \
	-DSQLITE_DISABLE_LFS \
	-DSQLITE_ENABLE_COLUMN_METADATA \
	-DSQLITE_ENABLE_MATH_FUNCTIONS \
	-DSQLITE_ENABLE_STAT4 \
	-DSQLITE_ENABLE_UPDATE_DELETE_LIMIT \
	-DSQLITE_DEFAULT_FOREIGN_KEYS=1 \
	-DSQLITE_DEFAULT_MEMSTATUS=0 \
	-DSQLITE_DQS=0 \
	-DSQLITE_TEMP_STORE=3 \
	-DSQLITE_OS_OTHER=1 \
	-DSQLITE_ENABLE_FTS5 \
	-DSQLITE_ENABLE_DBSTAT_VTAB \
	-DSQLITE_CORE

# Emscripten flags
EM_FLAGS = -O3 -flto

# Linker flags
LINK_FLAGS = \
	-s EXPORTED_FUNCTIONS=@$(EXPORTED_FUNCS_JSON) \
	-s EXPORTED_RUNTIME_METHODS=cwrap,addFunction,removeFunction \
	-s NODEJS_CATCH_EXIT=0 \
	-s NODEJS_CATCH_REJECTION=0 \
	-s MODULARIZE=0 \
	-s ALLOW_TABLE_GROWTH=1 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s ENVIRONMENT=node \
	-s FILESYSTEM=0 \
	-s WASM_BIGINT \
	-s WASM_ASYNC_COMPILATION=0

DIST_DIR = dist
DIST_JS = $(DIST_DIR)/sqlite-vec-wasm-node.js
DIST_WASM = $(DIST_DIR)/sqlite-vec-wasm-node.wasm
DIST_D_TS = $(DIST_DIR)/index.d.ts

.PHONY: all clean download

all: $(DIST_JS) $(DIST_D_TS)

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

# Download SQLite source
$(SQLITE_SRC_FILES):
	mkdir -p sqlite-src
	curl -LsSf '$(SQLITE_URL)' -o sqlite-src/sqlite.zip
	[ $(SQLITE_HASH) == $$(openssl dgst -sha3-256 sqlite-src/sqlite.zip | awk '{print $$NF}') ] || true
	unzip -ojDD sqlite-src/sqlite.zip "*/sqlite3.c" "*/sqlite3.h" -d sqlite-src/ 2>/dev/null || true
	rm -f sqlite-src/sqlite.zip

# Download sqlite-vec source and generate header from template
$(SQLITE_VEC_SRC_FILES):
	mkdir -p sqlite-vec-src
	curl -LsSf '$(SQLITE_VEC_URL)' -o sqlite-vec-src/sqlite-vec.c
	curl -LsSf '$(SQLITE_VEC_H_TMPL_URL)' -o sqlite-vec-src/sqlite-vec.h.tmpl
	# Generate sqlite-vec.h from template
	sed -e 's/$${VERSION}/$(SQLITE_VEC_VERSION)/g' \
	    -e 's/$${DATE}/2025-01-01/g' \
	    -e 's/$${SOURCE}/https:\/\/github.com\/asg017\/sqlite-vec/g' \
	    -e 's/$${VERSION_MAJOR}/0/g' \
	    -e 's/$${VERSION_MINOR}/1/g' \
	    -e 's/$${VERSION_PATCH}/7/g' \
	    sqlite-vec-src/sqlite-vec.h.tmpl > sqlite-vec-src/sqlite-vec.h

# Compile SQLite with sqlite-vec
build/sqlite3.o: $(SQLITE_SRC_FILES) $(SQLITE_VEC_SRC_FILES) $(SRC_DIR)/sqlite3-vec-amalgamation.c
	mkdir -p build
	emcc $(EM_FLAGS) $(SQLITE_FLAGS) -I sqlite-vec-src -I sqlite-src \
		-c $(SRC_DIR)/sqlite3-vec-amalgamation.c -o $@

# Compile VFS
build/vfs.o: $(SRC_DIR)/vfs.c sqlite-src/sqlite3.h
	mkdir -p build
	emcc $(EM_FLAGS) $(SQLITE_FLAGS) -I sqlite-src -c $< -o $@

# Generate exported functions list
$(EXPORTED_FUNCS_JSON): $(SRC_DIR)/api.js
	mkdir -p build
	echo '[' > $@
	perl -p0e 's/.*signatures = \{\n(.+?)\s*\}.*/\1/smg' $(SRC_DIR)/api.js | \
		perl -pe 's/\s*(.+):.*/"_sqlite3_\1"/' | \
		paste -sd "," - >> $@
	echo ',"_malloc","_free","_sqlite_vec_auto_init"]' >> $@

# Link everything
$(DIST_JS): $(OBJECT_FILES) $(EXPORTED_FUNCS_JSON) $(JS_PRE_FILES) $(JS_LIB_FILES) | $(DIST_DIR)
	emcc $(LINK_FLAGS) $(EM_FLAGS) $(OBJECT_FILES) --js-library $(JS_LIB_FILES) \
		$(foreach f,$(JS_PRE_FILES),--pre-js $(f)) -o $@

# TypeScript definitions
$(DIST_D_TS): $(SRC_DIR)/index.d.ts | $(DIST_DIR)
	cp $< $@

clean:
	rm -rf build dist sqlite-src sqlite-vec-src

download: $(SQLITE_SRC_FILES) $(SQLITE_VEC_SRC_FILES)
