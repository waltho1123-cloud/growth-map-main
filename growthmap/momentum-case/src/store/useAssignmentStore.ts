import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { AssignmentState, TreeNodeData } from '@/types';
import { defaultTree, generateDriversFromTree, defaultWickedChallenges } from '@/lib/mockData';

function findAndRemoveNode(node: TreeNodeData, targetId: string): boolean {
  const idx = node.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    node.children.splice(idx, 1);
    return true;
  }
  return node.children.some((c) => findAndRemoveNode(c, targetId));
}

function findNode(node: TreeNodeData, id: string): TreeNodeData | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function deepCloneTree(node: TreeNodeData): TreeNodeData {
  return {
    ...node,
    children: node.children.map(deepCloneTree),
  };
}

export const useAssignmentStore = create<AssignmentState>()(
  persist(
    (set, get) => ({
      tree: defaultTree,
      drivers: generateDriversFromTree(defaultTree),
      wickedChallenges: defaultWickedChallenges,
      currentStep: 0,

      setTree: (tree) => set({ tree }),

      addNode: (parentId) => {
        const tree = deepCloneTree(get().tree);
        const parent = findNode(tree, parentId);
        if (parent) {
          parent.children.push({
            id: uuidv4(),
            name: '新節點',
            logic: 'add',
            children: [],
          });
          set({ tree });
        }
      },

      removeNode: (nodeId) => {
        if (nodeId === 'root') return;
        const tree = deepCloneTree(get().tree);
        findAndRemoveNode(tree, nodeId);
        set({ tree });
      },

      updateNode: (nodeId, updates) => {
        const tree = deepCloneTree(get().tree);
        const node = findNode(tree, nodeId);
        if (node) {
          if (updates.name !== undefined) node.name = updates.name;
          if (updates.logic !== undefined) node.logic = updates.logic;
          set({ tree });
        }
      },

      setDrivers: (drivers) => set({ drivers }),

      updateDriver: (id, updates) => {
        const drivers = get().drivers.map((d) =>
          d.id === id ? { ...d, ...updates } : d
        );
        set({ drivers });
      },

      syncDriversFromTree: () => {
        const { tree, drivers } = get();
        const newDrivers = generateDriversFromTree(tree);
        // Preserve existing values for matching drivers
        const merged = newDrivers.map((nd) => {
          const existing = drivers.find((d) => d.nodeId === nd.nodeId);
          if (existing) {
            return {
              ...nd,
              historicalContribution: existing.historicalContribution,
              futureAssumption: existing.futureAssumption,
            };
          }
          return nd;
        });
        set({ drivers: merged });
      },

      addWickedChallenge: () => {
        set({
          wickedChallenges: [
            ...get().wickedChallenges,
            {
              id: uuidv4(),
              track: '',
              description: '',
              challenge: '',
              wickedType: '',
              guideline: '',
            },
          ],
        });
      },

      updateWickedChallenge: (id, updates) => {
        set({
          wickedChallenges: get().wickedChallenges.map((wc) =>
            wc.id === id ? { ...wc, ...updates } : wc
          ),
        });
      },

      removeWickedChallenge: (id) => {
        set({
          wickedChallenges: get().wickedChallenges.filter((wc) => wc.id !== id),
        });
      },

      setCurrentStep: (step) => set({ currentStep: step }),
    }),
    {
      name: 'bw-growth-map-assignment',
    }
  )
);
