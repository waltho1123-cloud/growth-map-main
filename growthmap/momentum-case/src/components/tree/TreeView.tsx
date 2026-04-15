'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { TreeNodeData } from '@/types';
import { useAssignmentStore } from '@/store/useAssignmentStore';
import NodeEditor from './NodeEditor';

interface TreeNodeProps {
  node: TreeNodeData;
  onSelect: (node: TreeNodeData) => void;
  selectedId: string | null;
  depth: number;
}

function TreeNodeComponent({ node, onSelect, selectedId, depth }: TreeNodeProps) {
  const addNode = useAssignmentStore((s) => s.addNode);
  const removeNode = useAssignmentStore((s) => s.removeNode);
  const isSelected = selectedId === node.id;
  const isRoot = node.id === 'root';
  const isLeaf = node.children.length === 0;
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-start gap-0" data-node-id={node.id}>
      {/* This node */}
      <div className="flex flex-col items-center shrink-0" ref={nodeRef}>
        <div
          onClick={() => onSelect(node)}
          className={`
            relative cursor-pointer rounded-xl px-4 py-3 min-w-[110px] max-w-[160px] text-center
            border-2 transition-all select-none
            ${isSelected
              ? 'border-[#00A651] bg-[#00A651]/10 shadow-lg shadow-[#00A651]/10'
              : 'border-gray-200 bg-white/60 hover:border-gray-300'
            }
          `}
        >
          <div className="text-sm font-semibold text-gray-800 whitespace-normal break-words leading-snug">
            {node.name}
          </div>
          {isLeaf && (
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#00A651]" title="葉節點" />
          )}
        </div>

        <div className="pdf-hide flex gap-1 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); addNode(node.id); }}
            className="w-6 h-6 rounded-md bg-[#00A651]/20 text-[#00A651] hover:bg-[#00A651]/30 flex items-center justify-center text-sm font-bold transition-all"
            title="新增子節點"
          >
            +
          </button>
          {!isRoot && (
            <button
              onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
              className="w-6 h-6 rounded-md bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center text-xs font-bold transition-all"
              title="刪除節點"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Children with connector */}
      {node.children.length > 0 && (
        <div className="flex items-center gap-0 ml-2">
          {/* Horizontal connector + branch lines */}
          <div className="flex flex-col items-center justify-center relative w-10 self-stretch">
            {/* Horizontal line from parent — extends left into the ml-2 gap and right into the trunk (overlap) */}
            <div
              className="absolute h-[2px] bg-[#00A651]/40"
              style={{ top: 'calc(50% - 1px)', left: '-8px', width: '22px' }}
            />
            {/* Vertical trunk — only needed when 2+ children (single child connects via stub + branch) */}
            {node.children.length > 1 && (
              <div
                className="absolute w-[2px] bg-[#00A651]/40"
                style={{
                  left: '12px',
                  top: `${100 / (node.children.length * 2 + (node.children.length - 1))}%`,
                  bottom: `${100 / (node.children.length * 2 + (node.children.length - 1))}%`,
                }}
              />
            )}
            {/* Logic badge on the connector line (shown only when there are 2+ children, like BCG) */}
            {node.children.length > 1 && (
              <div
                className={`
                  absolute w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold z-10 leading-none shadow-sm border
                  ${node.logic === 'add'
                    ? 'bg-blue-100 text-blue-600 border-blue-300'
                    : 'bg-amber-100 text-amber-600 border-amber-300'
                  }
                `}
                style={{ left: '3px', top: 'calc(50% - 10px)' }}
                title={node.logic === 'add' ? '加法' : '乘法'}
              >
                {node.logic === 'add' ? '+' : '×'}
              </div>
            )}
            {/* Horizontal branches to children (rendered per child below) */}
          </div>

          <div className="flex flex-col gap-4">
            {node.children.map((child) => (
              <div key={child.id} className="flex items-center relative">
                {/* Branch line — overlaps the trunk by 2px on the left so the T-corner renders solidly */}
                <div
                  className="absolute h-[2px] bg-[#00A651]/40"
                  style={{ top: 'calc(50% - 1px)', left: '-30px', width: '30px' }}
                />
                <TreeNodeComponent
                  node={child}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TreeView() {
  const tree = useAssignmentStore((s) => s.tree);
  const [selectedNode, setSelectedNode] = useState<TreeNodeData | null>(null);

  // Sync selected node data when tree changes
  const findNode = useCallback((root: TreeNodeData, id: string): TreeNodeData | null => {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }, []);

  const selectedIdRef = useRef(selectedNode?.id ?? null);
  selectedIdRef.current = selectedNode?.id ?? null;

  useEffect(() => {
    if (selectedIdRef.current) {
      const updated = findNode(tree, selectedIdRef.current);
      setSelectedNode(updated ?? null);
    }
  }, [tree, findNode]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Tree Area */}
      <div className="flex-1 w-full overflow-auto">
        <div className="glass-card rounded-xl p-4 sm:p-8 min-h-[400px]">
          <TreeNodeComponent
            node={tree}
            onSelect={setSelectedNode}
            selectedId={selectedNode?.id ?? null}
            depth={0}
          />
        </div>
      </div>

      {/* Editor Panel */}
      <div className="w-full lg:w-72 shrink-0">
        <NodeEditor
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      </div>
    </div>
  );
}
