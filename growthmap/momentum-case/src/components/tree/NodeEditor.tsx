'use client';

import { TreeNodeData } from '@/types';
import { useAssignmentStore } from '@/store/useAssignmentStore';

interface NodeEditorProps {
  node: TreeNodeData | null;
  onClose: () => void;
}

export default function NodeEditor({ node, onClose }: NodeEditorProps) {
  const { updateNode } = useAssignmentStore();

  if (!node) {
    return (
      <div className="glass-card rounded-xl p-6">
        <p className="text-gray-500 text-center">點擊節點以編輯</p>
      </div>
    );
  }

  const isRoot = node.id === 'root';

  return (
    <div className="glass-card rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">編輯節點</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-800 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            節點名稱
          </label>
          <input
            type="text"
            value={node.name}
            onChange={(e) => updateNode(node.id, { name: e.target.value })}
            className="w-full neu-input rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            邏輯類型
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateNode(node.id, { logic: 'add' })}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${node.logic === 'add'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                }
              `}
            >
              ＋ 加法
            </button>
            <button
              onClick={() => updateNode(node.id, { logic: 'multiply' })}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${node.logic === 'multiply'
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                }
              `}
            >
              × 乘法
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {node.logic === 'add'
              ? '子節點的值相加 (例如：事業部 A + 事業部 B = 總營收)'
              : '子節點的值相乘 (例如：銷量 × 單價 = 產品營收)'
            }
          </p>
        </div>

        {isRoot && (
          <div className="bg-[#00A651]/10 border border-[#00A651]/20 rounded-lg p-3">
            <p className="text-xs text-[#00A651]">
              這是根節點，代表公司總營收。無法刪除此節點。
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            節點 ID
          </label>
          <p className="text-xs text-gray-500 font-mono">{node.id}</p>
        </div>
      </div>
    </div>
  );
}
