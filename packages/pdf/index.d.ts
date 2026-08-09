export interface CaptureElementToPdfOptions {
  fileName: string;
  /** 'auto'（寬>高轉橫式）| 'p' 直式 | 'l' 橫式；預設 'auto' */
  orientation?: 'auto' | 'p' | 'l';
  /** 空欄位是否以 placeholder 文字（灰色）呈現；預設 false */
  includePlaceholders?: boolean;
  /** html2canvas 取樣倍率；預設 2 */
  scale?: number;
}

export declare function captureElementToPdf(
  element: HTMLElement | null,
  options: CaptureElementToPdfOptions
): Promise<void>;
