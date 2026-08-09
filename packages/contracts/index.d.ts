export declare const APP_KEYS: Readonly<{
  momentum: 'momentum';
  aspiration: 'aspiration';
  opportunity: 'opportunity';
}>;

export type AppKey = (typeof APP_KEYS)[keyof typeof APP_KEYS];

export declare const RECOVERY_KEYS: Readonly<{
  momentum: Readonly<{ reload: string; flushTs: string }>;
  aspiration: Readonly<{ reload: string; flushTs: string }>;
  opportunity: Readonly<{ reload: string; flushTs: string }>;
}>;

export declare const USERS_COLLECTION: 'users';
export declare const APPS_SUBCOLLECTION: 'apps';

export declare function userAppDocSegments(uid: string, appKey: AppKey): [string, string, string, string];

export interface OrientCore {
  aspiration: number;
  momentum: number;
  growthGap: number;
  revenue2025: number;
  companyName: string;
  revenueBreakdown: unknown[];
  /** false = 核心數值欄位違約，數值不可信（消費端應擋下並顯示違約狀態） */
  contractOk: boolean;
  /** 核心欄位違約（成長差距計算依賴） */
  criticalViolations: string[];
  /** 輔助欄位缺失（可同步核心數值，僅提示） */
  minorViolations: string[];
  /** 全部違約（critical 在前） */
  violations: string[];
}

export declare function listOrientContractViolations(shape: unknown): string[];

export declare function listOrientContractViolationsDetailed(shape: unknown): { critical: string[]; minor: string[] };

export declare function extractOrientSnapshot(data: unknown): OrientCore | null;

export declare function assertOrientProducerShape(snapshot: unknown): void;
