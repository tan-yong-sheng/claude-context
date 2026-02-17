const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
    files: 'out/test/**/*.test.js',
    workspaceFolder: './test-fixtures',
    mocha: {
        ui: 'tdd',
        timeout: 60000
    }
});
