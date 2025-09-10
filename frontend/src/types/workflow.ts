export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: string[];
  status: 'active' | 'completed' | 'pending' | 'error';
  progress: number;
  totalSteps: number;
  lastRun: string | null;
  connections: string[];
}