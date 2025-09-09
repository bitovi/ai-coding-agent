import { Layout } from '@/components/layout/Layout';
import { TaskFlow } from '@/components/taskflow';
import type { TaskStep } from '@/components/taskflow';
import { useDashboardData } from '@/hooks/api';
import { useState } from 'react';

export function TaskFlowDemo() {
  const { data: dashboardData } = useDashboardData();
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>([
    {
      id: 'step-1',
      title: 'Initialize Repository',
      description: 'Clone the repository and set up the workspace',
      status: 'completed',
      duration: 1200,
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:00:01Z',
      output: 'Repository cloned successfully to /workspace/project'
    },
    {
      id: 'step-2',
      title: 'Analyze Code Structure',
      description: 'Scan codebase and identify patterns',
      status: 'completed',
      duration: 3400,
      startTime: '2024-01-15T10:00:02Z',
      endTime: '2024-01-15T10:00:05Z',
      output: 'Found 24 files, 3 main modules, TypeScript project with React frontend'
    },
    {
      id: 'step-3',
      title: 'Generate Implementation Plan',
      description: 'Create detailed plan for the requested changes',
      status: 'running',
      startTime: '2024-01-15T10:00:06Z'
    },
    {
      id: 'step-4',
      title: 'Implement Changes',
      description: 'Apply the necessary code modifications',
      status: 'pending',
      dependencies: ['step-3']
    },
    {
      id: 'step-5',
      title: 'Run Tests',
      description: 'Execute test suite to verify changes',
      status: 'pending',
      dependencies: ['step-4']
    },
    {
      id: 'step-6',
      title: 'Create Pull Request',
      description: 'Commit changes and create PR',
      status: 'pending',
      dependencies: ['step-5']
    }
  ]);

  const handleStepAction = (stepId: string, action: string) => {
    console.log(`Step action: ${action} on step ${stepId}`);
    if (action === 'retry') {
      setSteps(prevSteps => 
        prevSteps.map(step => 
          step.id === stepId 
            ? { ...step, status: 'pending' as const }
            : step
        )
      );
    }
  };

  const handleFlowAction = (action: string) => {
    console.log(`Flow action: ${action}`);
    setIsRunning(action === 'start');
    
    if (action === 'start') {
      // Simulate workflow progression
      setTimeout(() => {
        setSteps(prevSteps => 
          prevSteps.map(step => 
            step.id === 'step-3'
              ? { 
                  ...step, 
                  status: 'completed' as const,
                  endTime: new Date().toISOString(),
                  duration: 2100,
                  output: 'Implementation plan generated:\n1. Create TaskFlow component\n2. Add routing\n3. Update tests'
                }
              : step.id === 'step-4'
              ? { ...step, status: 'running' as const, startTime: new Date().toISOString() }
              : step
          )
        );
      }, 2000);
    }
  };

  return (
    <Layout user={dashboardData?.user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">🔄 TaskFlow Demo</h1>
          <p className="text-muted-foreground mt-2">
            Interactive demonstration of the TaskFlow component for visualizing AI agent workflows
          </p>
        </div>

        <TaskFlow
          title="AI Code Implementation Workflow"
          description="Automated workflow for implementing the requested TaskFlow component"
          steps={steps}
          onStepAction={handleStepAction}
          onFlowAction={handleFlowAction}
          isRunning={isRunning}
        />

        <TaskFlow
          title="Jira Issue Creation Workflow"
          description="Sample workflow showing Jira integration steps"
          steps={[
            {
              id: 'jira-1',
              title: 'Authenticate with Jira',
              description: 'Verify credentials and establish connection',
              status: 'completed',
              duration: 800
            },
            {
              id: 'jira-2', 
              title: 'Validate Project',
              description: 'Check if project key exists and user has permissions',
              status: 'completed',
              duration: 450
            },
            {
              id: 'jira-3',
              title: 'Create Issue',
              description: 'Submit new issue with provided details',
              status: 'error',
              output: 'Error: Field "Epic Link" is required but not provided'
            }
          ]}
          onStepAction={handleStepAction}
        />
      </div>
    </Layout>
  );
}