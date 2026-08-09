import * as React from 'react';

export interface AppErrorBoundaryProps {
  children?: React.ReactNode;
  /** 錯誤畫面副標文案；預設為版本更新/網路不穩說明 */
  subtitle?: string;
}

export declare class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, { error: unknown }> {
  static getDerivedStateFromError(error: unknown): { error: unknown };
}
