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
  const { addNode, removeNode } = useAssignmentStore();
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
            relative cursor-pointer rounded-xl px-4 py-3 min-w-[110px] text-center
            border-2 transition-all select-none
            ${isSelected
              ? 'border-[#00A651] bg-[#00A651]/20 shadow-lg shadow-[#00A651]/20'
              : 'border-white/10 bg-[#242442] hover:border-white/30'
            }
          `}
        >
          <div className="text-sm font-semibold text-white truncate max-w-[120px]">
            {node.name}
          </div>
          <div className={`
            text-[10px] mt-1 px-2 py-0.5 rounded-full inline-block
            ${node.logic === 'add'
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-amber-500/20 text-amber-300'
            }
          `}>
            {node.logic === 'add' ? '＋ 加法' : '× 乘法'}
          </div>
          {isLeaf && (
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#00A651]" title="葉節點" />
          )}
        </div>

        <div className="flex gap-1 mt-2">
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
              className="w-6 h-6 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center text-xs font-bold transition-all"
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
            {/* Horizontal line from parent */}
            <div className="absolute left-0 top-1/2 w-3 h-0.5 bg-[#00A651]/60" />
            {/* Vertical trunk */}
            <div className="absolute left-3 bg-[#00A651]/60 w-0.5"
              style={{
                top: node.children.length === 1 ? '50%' : `${100 / (node.children.length * 2 + (node.children.length - 1))}%`,
                bottom: node.children.length === 1 ? '50%' : `${100 / (node.children.length * 2 + (node.children.length - 1))}%`,
              }}
            />
            {/* Horizontal branches to children (rendered per child below) */}
          </div>

          <div className="flex flex-col gap-4">
            {node.children.map((child, i) => (
              <div key={child.id} className="flex items-center relative">
                {/* Branch line */}
                <div className="absolute -left-[28px] top-1/2 w-7 h-0.5 bg-[#00A651]/60" />
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

  useEffect(() => {
    if (selectedNode) {
      const updated = findNode(tree, selectedNode.id);
      if (updated) setSelectedNode(updated);
      else setSelectedNode(null);
    }
  }, [tree, selectedNode, findNode]);

  return (
    <div className="flex gap-6 items-start">
      {/* Tree Area */}
      <div className="flex-1 overflow-auto">
        <div className="bg-[#1A1A2E]/50 rounded-xl border border-white/5 p-8 min-h-[400px]">
          <TreeNodeComponent
            node={tree}
            onSelect={setSelectedNode}
            selectedId={selectedNode?.id ?? null}
            depth={0}
          />
        </div>
      </div>

      {/* Editor Panel */}
      <div className="w-72 shrink-0">
        <NodeEditor
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      </div>
    </div>
  );
}
