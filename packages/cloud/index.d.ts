import type { AppKey } from '@growthmap/contracts';

export interface CloudDoc<T = unknown> {
  data: T;
  updatedAt: number;
  version: number;
  writer?: string | null;
}

export type ReconcileDecision = 'cloud' | 'upload' | 'same';

export interface SnapshotMetadata {
  hasPendingWrites: boolean;
  fromCache: boolean;
}

export interface CloudSync {
  loadCloud<T = unknown>(uid: string, appKey: AppKey): Promise<CloudDoc<T> | null>;
  saveCloud<T = unknown>(uid: string, appKey: AppKey, data: T, writer?: string | null): Promise<void>;
  saveCloudDebounced<T = unknown>(uid: string, appKey: AppKey, data: T, delay?: number, writer?: string | null): void;
  subscribeCloud<T = unknown>(
    uid: string,
    appKey: AppKey,
    onChange: (cloud: CloudDoc<T> | null, metadata: SnapshotMetadata) => void
  ): () => void;
}

export declare function createCloudSync(getFirebase: () => Promise<{ db: unknown }>): CloudSync;

export declare function reconcile(localUpdatedAt: number, cloud: CloudDoc<unknown> | null): ReconcileDecision;
