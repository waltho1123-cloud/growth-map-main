export interface TreeNodeData {
  id: string;
  name: string;
  logic: 'add' | 'multiply';
  children: TreeNodeData[];
}

export interface DriverData {
  id: string;
  nodeId: string;
  name: string;
  historicalContribution: number; // percentage
  futureAssumption: number; // percentage
}

export interface WickedChallenge {
  id: string;
  track: string;        // 賽道
  description: string;  // 說明
  challenge: string;    // 挑戰
  wickedType: string;   // 棘手型挑戰
  guideline: string;    // 指導原則
}

export interface AssignmentState {
  // Step 1: Tree
  tree: TreeNodeData;

  // Clipboard for tree copy/paste (transient — not persisted)
  clipboard: TreeNodeData | null;

  // Step 2: Drivers
  drivers: DriverData[];

  // Step 5: Wicked Challenges
  wickedChallenges: WickedChallenge[];

  // Wizard state
  currentStep: number;

  // Actions
  setTree: (tree: TreeNodeData) => void;
  addNode: (parentId: string) => void;
  removeNode: (nodeId: string) => void;
  moveNode: (nodeId: string, direction: 'up' | 'down') => void;
  updateNode: (nodeId: string, updates: Partial<Pick<TreeNodeData, 'name' | 'logic'>>) => void;
  copyNode: (nodeId: string) => void;
  pasteNode: (parentId: string) => void;
  clearClipboard: () => void;

  setDrivers: (drivers: DriverData[]) => void;
  updateDriver: (id: string, updates: Partial<Pick<DriverData, 'historicalContribution' | 'futureAssumption'>>) => void;
  syncDriversFromTree: () => void;

  addWickedChallenge: () => void;
  updateWickedChallenge: (id: string, updates: Partial<Omit<WickedChallenge, 'id'>>) => void;
  removeWickedChallenge: (id: string) => void;

  setCurrentStep: (step: number) => void;
}
