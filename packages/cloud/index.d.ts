import type { AppKey } from '@growthmap/contracts';

export interface CloudDoc<T = unknown> {
  data: T;
  updatedAt: number;
  version: number;
  writer?: string | null;
  /** data 各 top-level key 的最後編輯毫秒（additive；舊文件為 null → merge 退回 whole-doc） */
  sectionTs?: Record<string, number> | null;
}

/** saveCloud / saveCloudDebounced 的選配欄位 */
export interface SaveExtra {
  sectionTs?: Record<string, number>;
}

export type ReconcileDecision = 'cloud' | 'upload' | 'same';

export interface SnapshotMetadata {
  hasPendingWrites: boolean;
  fromCache: boolean;
}

export interface CloudSync {
  loadCloud<T = unknown>(uid: string, appKey: AppKey): Promise<CloudDoc<T> | null>;
  saveCloud<T = unknown>(uid: string, appKey: AppKey, data: T, writer?: string | null, extra?: SaveExtra | null): Promise<void>;
  saveCloudDebounced<T = unknown>(
    uid: string,
    appKey: AppKey,
    data: T,
    delay?: number,
    writer?: string | null,
    callbacks?: { onSaved?: () => void; onError?: (e: unknown) => void } | null,
    extra?: SaveExtra | null
  ): void;
  subscribeCloud<T = unknown>(
    uid: string,
    appKey: AppKey,
    onChange: (cloud: CloudDoc<T> | null, metadata: SnapshotMetadata) => void
  ): () => void;
}

export declare function createCloudSync(
  getFirebase: () => Promise<{ db: unknown }>,
  firestoreOverride?: object | null
): CloudSync;

export interface ChunkReloadRecoveryOptions {
  /** sessionStorage key：重載防迴圈標記 */
  reloadKey: string;
  /** sessionStorage key：flush 時間戳（consumeFlushTs 讀取端） */
  flushTsKey?: string;
  /** 冷卻毫秒數，預設 60000 */
  cooldownMs?: number;
  /** 重載前的同步 flush 回呼（本地持久化非同步的單元使用） */
  onBeforeReload?: (() => void) | null;
}

/** 註冊「回報本 session 真實最後編輯時間」的 provider；回傳解除函式 */
export declare function registerLocalTsProvider(flushTsKey: string, provider: () => number): () => void;

export declare function installChunkReloadRecovery(options: ChunkReloadRecoveryOptions): void;

export declare function consumeFlushTs(flushTsKey: string, maxAgeMs?: number): number;

export declare function reconcile(localUpdatedAt: number, cloud: CloudDoc<unknown> | null): ReconcileDecision;

/** 遞迴 key 排序的穩定序列化（跨來源內容比較用；Firestore 讀回 map 為 key 排序） */
export declare function stableStringify(value: unknown): string;

/** Section 級 merge 的裁決結果 */
export interface SectionMergeResult<T = Record<string, unknown>> {
  merged: T;
  mergedSectionTs: Record<string, number>;
  usedCloud: string[];
  keptLocal: string[];
  /** keptLocal 中存在 ts>0 的項目（本地確實較新）→ 呼叫端應把 merged 回傳雲端 */
  needUpload: boolean;
}

export declare function mergeBySection<T = Record<string, unknown>>(
  localData: T,
  localSectionTs: Record<string, number> | null,
  localFallbackTs: number,
  cloud: CloudDoc<Partial<T>> | null
): SectionMergeResult<T>;

export interface CloudSyncBootstrapConfig<TSnapshot = unknown> {
  appKey: AppKey;
  flushTsKey: string;
  /** 單元模組層以 consumeFlushTs(key) 取得後傳入 */
  initialLocalTs?: number;
  useAuth: () => { user: { uid: string } | null; loading: boolean };
  isConfigured: boolean;
  sync: Pick<CloudSync, 'subscribeCloud' | 'saveCloudDebounced'>;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TSnapshot;
  applySnapshot: (data: TSnapshot) => void;
  /** 上傳前守衛（如 dev 契約 assert）；拋出即中止該次上傳 */
  guardSnapshot?: ((snap: TSnapshot) => void) | null;
  pushDelayMs?: number;
}

export declare function createCloudSyncBootstrap<TSnapshot = unknown>(
  config: CloudSyncBootstrapConfig<TSnapshot>
): () => null;
