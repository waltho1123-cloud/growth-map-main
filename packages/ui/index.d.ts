import * as React from 'react';

export interface AppErrorBoundaryProps {
  children?: React.ReactNode;
  /** 錯誤畫面副標文案；預設為版本更新/網路不穩說明 */
  subtitle?: string;
  /** fallback 顯示前需移除的 #root 外遮罩元素 id（如 momentum 的 app-loading） */
  clearOverlayIds?: string[];
}

export declare class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, { hasError: boolean; error: unknown }> {
  static getDerivedStateFromError(error: unknown): { hasError: boolean; error: unknown };
}
