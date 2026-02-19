#!/bin/bash
# Build WASM module using Docker with Emscripten

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

# Build using Emscripten Docker image
docker run --rm \
    -v "$PACKAGE_DIR:/src" \
    -w /src \
    emscripten/emsdk:3.1.51 \
    bash -c "
        set -e
        echo '=== Downloading sources ==='
        make download || true

        echo '=== Building WASM module ==='
        make

        echo '=== Build complete ==='
        ls -la dist/
    "

echo "Build finished successfully!"
