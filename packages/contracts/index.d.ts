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
  evaluate: Readonly<{ reload: string; flushTs: string }>;
}>;

export declare const USERS_COLLECTION: 'users';
export declare const APPS_SUBCOLLECTION: 'apps';
export declare const EVAL_PROJECTS_COLLECTION: 'evalProjects';

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

export interface HandoffTargetSnapshot {
  aspiration: number;
  momentum: number;
  growthGap: number;
  currency: string;
}

export interface HandoffOpportunity {
  id: string;
  opportunityName: string;
  estRevenue: number;
  currency: string;
  sourceToolCodes: unknown[];
  sourceToolNames: string[];
  aiScore: number | null;
  template1: Record<string, unknown> | null;
  template2: Record<string, unknown> | null;
  template3: Record<string, unknown> | null;
}

export interface HandoffCore {
  version: number;
  frozenAt: number;
  archetype: string | null;
  targetSnapshot: HandoffTargetSnapshot | null;
  opportunities: HandoffOpportunity[];
  /** false = 核心識別欄位違約，承接結果不可信 */
  contractOk: boolean;
  criticalViolations: string[];
  minorViolations: string[];
  violations: string[];
}

export interface HandoffVersionInfo {
  version: number;
  frozenAt: number;
  opportunityCount: number;
}

export declare function listHandoffContractViolations(snapshot: unknown): string[];

export declare function listHandoffContractViolationsDetailed(snapshot: unknown): { critical: string[]; minor: string[] };

export declare function listHandoffVersions(data: unknown): HandoffVersionInfo[];

export declare function extractHandoffSnapshot(data: unknown, version?: number | null): HandoffCore | null;

export declare function assertHandoffProducerShape(snapshot: unknown): void;
