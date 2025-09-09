import { Layout } from '@/components/layout/Layout';
import { TaskFlow } from './TaskFlow';
import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  type: 'code' | 'test' | 'docs' | 'review';
  dependencies?: string[];
  estimatedTime?: string;
}

const demoTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Analyze Repository Structure',
    description: 'Examine the codebase to understand the architecture and dependencies',
    status: 'completed',
    progress: 100,
    type: 'code',
    estimatedTime: '5 min'
  },
  {
    id: 'task-2',
    title: 'Implement TaskFlow Component',
    description: 'Create the TaskFlow component based on design specifications from Figma',
    status: 'running',
    progress: 85,
    type: 'code',
    dependencies: ['task-1'],
    estimatedTime: '15 min'
  },
  {
    id: 'task-3',
    title: 'Write Unit Tests',
    description: 'Create comprehensive tests for the new TaskFlow component',
    status: 'pending',
    progress: 0,
    type: 'test',
    dependencies: ['task-2'],
    estimatedTime: '10 min'
  },
  {
    id: 'task-4',
    title: 'Update Documentation',
    description: 'Add documentation for the TaskFlow component usage',
    status: 'pending',
    progress: 0,
    type: 'docs',
    dependencies: ['task-2'],
    estimatedTime: '8 min'
  },
  {
    id: 'task-5',
    title: 'Code Review',
    description: 'Review the implementation and ensure code quality standards',
    status: 'pending',
    progress: 0,
    type: 'review',
    dependencies: ['task-2', 'task-3'],
    estimatedTime: '12 min'
  }
];

export function TaskFlowDemo() {
  const [tasks, setTasks] = useState<Task[]>(demoTasks);

  const handleTaskAction = (taskId: string, action: 'start' | 'pause' | 'retry') => {
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.id === taskId) {
          switch (action) {
            case 'start':
              return { 
                ...task, 
                status: 'running' as const,
                progress: task.progress || 10
              };
            case 'pause':
              return { ...task, status: 'paused' as const };
            case 'retry':
              return { 
                ...task, 
                status: 'running' as const,
                progress: 5
              };
            default:
              return task;
          }
        }
        return task;
      })
    );

    // Simulate progress updates for running tasks
    if (action === 'start' || action === 'retry') {
      setTimeout(() => {
        setTasks(prevTasks =>
          prevTasks.map(task => {
            if (task.id === taskId && task.status === 'running') {
              const newProgress = Math.min(100, task.progress + 25);
              return {
                ...task,
                progress: newProgress,
                status: newProgress === 100 ? 'completed' as const : task.status
              };
            }
            return task;
          })
        );
      }, 2000);
    }
  };

  // Mock user data for the demo
  const mockUser = { email: 'demo@example.com' };

  return (
    <Layout user={mockUser}>
      <div className="space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">TaskFlow Component Demo</h1>
          <p className="text-gray-600">
            This is a demonstration of the TaskFlow component implementation.
          </p>
        </div>
        
        <TaskFlow tasks={tasks} onTaskAction={handleTaskAction} />
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Demo Features:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Interactive task status management (Start/Pause/Retry)</li>
            <li>• Progress tracking with visual progress bars</li>
            <li>• Task dependency visualization</li>
            <li>• Different task types (Code, Test, Docs, Review)</li>
            <li>• Overall workflow progress tracking</li>
            <li>• Responsive design with Tailwind CSS</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}