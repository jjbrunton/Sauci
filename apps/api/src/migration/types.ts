import type { Pool } from 'pg';

export interface MigrationCheckpoint {
  version: 1;
  runId: string;
  mode: 'initial' | 'final';
  completedTables: string[];
  storage: Record<string, { updatedAt: string | null; byteSize: number }>;
  updatedAt: string;
}

export interface TableResult {
  table: string;
  sourceRows: number;
  targetRows: number;
  importedRows: number;
  prunedRows: number;
  status: 'equal' | 'different' | 'skipped';
  note?: string;
}

export interface StorageResult {
  sourceFiles: number;
  targetFiles: number;
  preservedTargetFiles: number;
  copiedFiles: number;
  quarantinedFiles: number;
  skippedFiles: number;
  prunedFiles: number;
  failedFiles: number;
  sourceBytes: number;
  copiedBytes: number;
  missingOnDisk: string[];
  failures: Array<{ storageKey: string; error: string }>;
}

export interface ParityReport {
  runId: string;
  dryRun: boolean;
  finalSync: boolean;
  startedAt: string;
  finishedAt: string;
  tables: TableResult[];
  storage: StorageResult | null;
  relational: Record<string, number>;
  parity: boolean;
}

export interface DatabaseMigrationOptions {
  dryRun: boolean;
  finalSync: boolean;
  prune: boolean;
  checkpoint: MigrationCheckpoint;
  saveCheckpoint?: (value: MigrationCheckpoint) => Promise<void>;
}

export interface StorageMigrationOptions {
  dryRun: boolean;
  prune?: boolean;
  mediaRoot: string;
  checkpoint: MigrationCheckpoint;
  storageSchema?: string;
  download: (bucket: string, name: string) => Promise<Uint8Array>;
  saveCheckpoint?: (value: MigrationCheckpoint) => Promise<void>;
}

export interface MigrationPools { source: Pool; target: Pool }
