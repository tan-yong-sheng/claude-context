import * as vscode from 'vscode';
import { Context } from '@tan-yong-sheng/code-context-core';
import { getLogger } from '../utils/logger';

export class IndexCommand {
    private context: Context;
    private logger = getLogger();
    private isIndexing: boolean = false;

    constructor(context: Context) {
        this.context = context;
        this.logger.debug('IndexCommand instance created');
    }

    /**
     * Check if indexing is currently in progress
     */
    getIsIndexing(): boolean {
        return this.isIndexing;
    }

    /**
     * Update the Context instance (used when configuration changes)
     */
    updateContext(context: Context): void {
        this.logger.debug('IndexCommand context updated');
        this.context = context;
    }

    async execute(): Promise<void> {
        this.logger.enter('IndexCommand.execute');

        // Prevent concurrent indexing operations
        if (this.isIndexing) {
            this.logger.warn('Indexing already in progress, ignoring duplicate request');
            vscode.window.showWarningMessage('Indexing is already in progress. Please wait for it to complete.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.logger.error('No workspace folder found');
            vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
            return;
        }

        // Let user select the folder to index (default is the first workspace folder)
        let selectedFolder = workspaceFolders[0];

        if (workspaceFolders.length > 1) {
            this.logger.debug('Multiple workspace folders found, prompting user to select');
            const items = workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                folder: folder
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select folder to index'
            });

            if (!selected) {
                this.logger.info('User cancelled folder selection');
                return;
            }
            selectedFolder = selected.folder;
        }

        this.logger.info(`Selected folder: ${selectedFolder.uri.fsPath}`);

        // Check if already indexed (MCP-style deduplication)
        const hasExistingIndex = await this.context.hasIndex(selectedFolder.uri.fsPath);

        if (hasExistingIndex) {
            this.logger.info('Codebase is already indexed, prompting for force reindex');
            const reindexConfirm = await vscode.window.showWarningMessage(
                `Codebase '${selectedFolder.uri.fsPath}' is already indexed.\n\nDo you want to force re-index and overwrite the existing index?`,
                { modal: true },
                'Force Re-index',
                'Cancel'
            );

            if (reindexConfirm !== 'Force Re-index') {
                this.logger.info('User cancelled force reindex');
                return;
            }

            this.logger.info('Force reindex confirmed by user');
        } else {
            const confirm = await vscode.window.showInformationMessage(
                `Index codebase at: ${selectedFolder.uri.fsPath}?\n\nThis will create embeddings for all supported code files.`,
                'Yes',
                'Cancel'
            );

            if (confirm !== 'Yes') {
                this.logger.info('User cancelled indexing confirmation');
                return;
            }
        }

        this.isIndexing = true;

        try {
            let indexStats: { indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' } | undefined;

            this.logger.section('INDEXING STARTED');
            const totalStartTime = Date.now();

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Indexing Codebase',
                cancellable: false
            }, async (progress) => {
                this.logger.enter('IndexCommand.withProgress');
                let lastPercentage = 0;

                // Clear existing index first
                this.logger.debug('Clearing existing index...');
                await this.context.clearIndex(
                    selectedFolder.uri.fsPath,
                    (progressInfo) => {
                        this.logger.debug(`Clear index progress: ${progressInfo.phase} (${progressInfo.percentage}%)`);
                        progress.report({ increment: 0, message: progressInfo.phase });
                    }
                );
                this.logger.info('Existing index cleared');

                // Start indexing with progress callback
                this.logger.section('RUNNING INDEX');
                const indexStartTime = Date.now();

                indexStats = await this.context.indexCodebase(
                    selectedFolder.uri.fsPath,
                    (progressInfo) => {
                        // Calculate increment from last reported percentage
                        const increment = progressInfo.percentage - lastPercentage;
                        lastPercentage = progressInfo.percentage;

                        this.logger.debug(`Index progress: ${progressInfo.phase} (${progressInfo.percentage}%)`, {
                            current: progressInfo.current,
                            total: progressInfo.total
                        });

                        progress.report({
                            increment: increment,
                            message: progressInfo.phase
                        });
                    }
                );

                this.logger.info(`Indexing completed in ${Date.now() - indexStartTime}ms`);

                // Save snapshot after full reindex so future sync operations know the current state
                // This prevents auto-sync from re-indexing all files as "new"
                this.logger.debug('Saving snapshot after full reindex...');
                const { FileSynchronizer } = await import("@tan-yong-sheng/code-context-core");
                const snapshotSynchronizer = new FileSynchronizer(selectedFolder.uri.fsPath, this.context.getIgnorePatterns() || []);
                await snapshotSynchronizer.initialize();
                const collectionName = this.context.getCollectionName(selectedFolder.uri.fsPath);
                this.context.setSynchronizer(collectionName, snapshotSynchronizer);
                this.logger.info('Snapshot saved successfully');

                this.logger.exit('IndexCommand.withProgress');
            });

            if (indexStats) {
                const { indexedFiles, totalChunks, status } = indexStats;
                this.logger.info('Index stats:', { indexedFiles, totalChunks, status });

                if (status === 'limit_reached') {
                    this.logger.warn(`Reached chunk limit. Indexed ${indexedFiles} files with ${totalChunks} chunks.`);
                    vscode.window.showWarningMessage(
                        `⚠️ Indexing paused. Reached chunk limit of 450,000.\n\nIndexed ${indexedFiles} files with ${totalChunks} code chunks.`
                    );
                } else {
                    this.logger.info(`Successfully indexed ${indexedFiles} files with ${totalChunks} chunks`);
                    vscode.window.showInformationMessage(
                        `✅ Indexing complete!\n\nIndexed ${indexedFiles} files with ${totalChunks} code chunks.\n\nYou can now use semantic search.`
                    );
                }
            }

            this.logger.info(`Total indexing time: ${Date.now() - totalStartTime}ms`);

        } catch (error: any) {
            this.logger.error('Indexing failed', error);
            const errorString = typeof error === 'string' ? error : (error.message || error.toString() || '');
            vscode.window.showErrorMessage(`❌ Indexing failed: ${errorString}`);
        } finally {
            this.isIndexing = false;
            this.logger.exit('IndexCommand.execute');
        }
    }

    async clearIndex(): Promise<void> {
        this.logger.enter('IndexCommand.clearIndex');

        const confirm = await vscode.window.showWarningMessage(
            'Clear all indexed data?',
            'Yes',
            'Cancel'
        );

        if (confirm !== 'Yes') {
            this.logger.info('User cancelled clear index');
            return;
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this.logger.error('No workspace folder found');
                vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
                return;
            }

            const codebasePath = workspaceFolders[0].uri.fsPath;
            const collectionName = this.context.getCollectionName(codebasePath);
            this.logger.info(`Clearing index for: ${codebasePath}`);
            this.logger.info(`Collection name: ${collectionName}`);
            const startTime = Date.now();

            // Check if index exists before clearing
            const hasIndexBefore = await this.context.hasIndex(codebasePath);
            this.logger.info(`Index exists before clear: ${hasIndexBefore}`);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Clearing Index',
                cancellable: false
            }, async (progress) => {
                await this.context.clearIndex(
                    workspaceFolders![0].uri.fsPath,
                    (progressInfo) => {
                        this.logger.debug(`Clear progress: ${progressInfo.phase} (${progressInfo.percentage}%)`);
                        progress.report({
                            increment: progressInfo.percentage,
                            message: progressInfo.phase
                        });
                    }
                );
            });

            // Verify index is cleared
            const hasIndexAfter = await this.context.hasIndex(codebasePath);
            this.logger.info(`Index exists after clear: ${hasIndexAfter}`);

            const duration = Date.now() - startTime;
            this.logger.info(`Index cleared successfully in ${duration}ms`);
            vscode.window.showInformationMessage(`✅ Index cleared successfully (${duration}ms)`);
        } catch (error) {
            this.logger.error('Failed to clear index', error);
            vscode.window.showErrorMessage(`❌ Failed to clear index: ${error}`);
        } finally {
            this.logger.exit('IndexCommand.clearIndex');
        }
    }
}
