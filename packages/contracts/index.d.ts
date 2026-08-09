export declare const APP_KEYS: Readonly<{
  momentum: 'momentum';
  aspiration: 'aspiration';
  opportunity: 'opportunity';
}>;

export type AppKey = (typeof APP_KEYS)[keyof typeof APP_KEYS];

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
  /** false = 資料存在但形狀違約，數值不可信（消費端應顯示違約狀態） */
  contractOk: boolean;
  /** 違約的欄位路徑清單（contractOk=true 時為空） */
  violations: string[];
}

export declare function listOrientContractViolations(shape: unknown): string[];

export declare function extractOrientSnapshot(data: unknown): OrientCore | null;

export declare function assertOrientProducerShape(snapshot: unknown): void;
