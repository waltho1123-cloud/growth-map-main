'use client';

import { TreeNodeData } from '@/types';
import { useAssignmentStore } from '@/store/useAssignmentStore';

interface TreeNodeProps {
  node: TreeNodeData;
  onSelect: (node: TreeNodeData) => void;
  selectedId: string | null;
}

export default function TreeNode({ node, onSelect, selectedId }: TreeNodeProps) {
  const { addNode, removeNode } = useAssignmentStore();
  const isSelected = selectedId === node.id;
  const isRoot = node.id === 'root';
  const isLeaf = node.children.length === 0;

  return (
    <div className="flex items-start gap-8">
      {/* This node */}
      <div className="flex flex-col items-center">
        <div
          onClick={() => onSelect(node)}
          className={`
            relative cursor-pointer rounded-xl px-4 py-3 min-w-[120px] text-center
            border-2 transition-all select-none
            ${isSelected
              ? 'border-[#00A651] bg-[#00A651]/10 shadow-lg shadow-[#00A651]/10'
              : 'border-gray-200 bg-white/60 hover:border-gray-300'
            }
          `}
        >
          <div className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">
            {node.name}
          </div>
          <div className={`
            text-[10px] mt-1 px-2 py-0.5 rounded-full inline-block
            ${node.logic === 'add'
              ? 'bg-blue-100 text-blue-600'
              : 'bg-amber-100 text-amber-600'
            }
          `}>
            {node.logic === 'add' ? '＋ 加法' : '× 乘法'}
          </div>
          {isLeaf && (
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#00A651]" title="葉節點（驅動因子）" />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); addNode(node.id); }}
            className="w-7 h-7 rounded-lg bg-[#00A651]/20 text-[#00A651] hover:bg-[#00A651]/30 flex items-center justify-center text-lg transition-all"
            title="新增子節點"
          >
            +
          </button>
          {!isRoot && (
            <button
              onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
              className="w-7 h-7 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center text-sm transition-all"
              title="刪除節點"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div className="flex flex-col gap-6 relative">
          {/* SVG connector lines */}
          <svg className="absolute -left-8 top-0 w-8 h-full pointer-events-none overflow-visible">
            {node.children.map((_, i) => {
              const totalChildren = node.children.length;
              const spacing = 100 / (totalChildren + 1);
              const yPercent = spacing * (i + 1);
              return (
                <path
                  key={i}
                  d={`M 0,50% Q 16,50% 16,${yPercent}% Q 16,${yPercent}% 32,${yPercent}%`}
                  className="tree-connector"
                  style={{
                    d: `path("M 0 50% Q 16 50% 16 ${yPercent}% Q 16 ${yPercent}% 32 ${yPercent}%")`,
                  }}
                />
              );
            })}
          </svg>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
