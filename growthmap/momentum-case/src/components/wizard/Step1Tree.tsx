'use client';

import TreeView from '@/components/tree/TreeView';

export default function Step1Tree() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">營收拆解樹</h2>
        <p className="text-sm text-gray-400 mt-1">
          將公司總營收拆解為驅動因子的樹狀結構。點擊「+」新增子節點，點擊節點可在右側面板編輯。
        </p>
      </div>
      <TreeView />
    </div>
  );
}
