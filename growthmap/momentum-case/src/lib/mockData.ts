import { TreeNodeData, DriverData, WickedChallenge } from '@/types';

export const defaultTree: TreeNodeData = {
  id: 'root',
  name: '總營收',
  logic: 'add',
  children: [
    {
      id: 'bu-1',
      name: '事業部 A',
      logic: 'multiply',
      children: [
        {
          id: 'prod-1',
          name: '產品線 A1',
          logic: 'multiply',
          children: [
            { id: 'vol-1', name: '銷量', logic: 'add', children: [] },
            { id: 'price-1', name: '單價', logic: 'add', children: [] },
          ],
        },
        {
          id: 'prod-2',
          name: '產品線 A2',
          logic: 'multiply',
          children: [
            { id: 'vol-2', name: '銷量', logic: 'add', children: [] },
            { id: 'price-2', name: '單價', logic: 'add', children: [] },
          ],
        },
      ],
    },
    {
      id: 'bu-2',
      name: '事業部 B',
      logic: 'multiply',
      children: [
        {
          id: 'prod-3',
          name: '產品線 B1',
          logic: 'multiply',
          children: [
            { id: 'vol-3', name: '銷量', logic: 'add', children: [] },
            { id: 'price-3', name: '單價', logic: 'add', children: [] },
          ],
        },
      ],
    },
  ],
};

export function getLeafNodes(node: TreeNodeData): TreeNodeData[] {
  if (node.children.length === 0) return [node];
  return node.children.flatMap(getLeafNodes);
}

export function generateDriversFromTree(tree: TreeNodeData): DriverData[] {
  const leaves = getLeafNodes(tree);
  return leaves.map((leaf) => ({
    id: `driver-${leaf.id}`,
    nodeId: leaf.id,
    name: getNodePath(tree, leaf.id) || leaf.name,
    historicalContribution: 0,
    futureAssumption: 0,
  }));
}

function getNodePath(root: TreeNodeData, targetId: string, path: string[] = []): string | null {
  if (root.id === targetId) return [...path, root.name].join(' → ');
  for (const child of root.children) {
    const result = getNodePath(child, targetId, [...path, root.name]);
    if (result) return result;
  }
  return null;
}

export const defaultWickedChallenges: WickedChallenge[] = [
  {
    id: 'wc-1',
    track: '',
    description: '',
    challenge: '',
    wickedType: '',
    guideline: '',
  },
];
