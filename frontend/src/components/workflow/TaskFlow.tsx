import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { WorkflowCard } from './WorkflowCard';
import { CreateWorkflowDialog } from './CreateWorkflowDialog';
import { Plus, Workflow } from 'lucide-react';
import type { Workflow as WorkflowType } from '@/types/workflow';

export function TaskFlow() {
  const { data: user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Mock workflows for now - in real implementation this would come from API
  const workflows: WorkflowType[] = [
    {
      id: '1',
      name: 'Feature Development Workflow',
      description: 'Complete feature development from Figma design to deployed code',
      steps: ['Clone Repository', 'Review Jira Ticket', 'Create Feature Branch', 'Implement Changes', 'Commit & Push'],
      status: 'active' as const,
      progress: 3,
      totalSteps: 5,
      lastRun: '2025-01-28T10:30:00Z',
      connections: ['jira', 'figma', 'github', 'git-credentials']
    },
    {
      id: '2', 
      name: 'Bug Fix Workflow',
      description: 'Quick bug fix workflow with automated testing',
      steps: ['Analyze Issue', 'Create Fix Branch', 'Implement Fix', 'Run Tests', 'Deploy'],
      status: 'completed' as const,
      progress: 5,
      totalSteps: 5,
      lastRun: '2025-01-27T14:15:00Z',
      connections: ['jira', 'github']
    },
    {
      id: '3',
      name: 'Code Review Workflow', 
      description: 'Automated code review and feedback workflow',
      steps: ['Fetch Latest Code', 'Run Analysis', 'Generate Report', 'Create Review Comments'],
      status: 'pending' as const,
      progress: 0,
      totalSteps: 4,
      lastRun: null,
      connections: ['github']
    }
  ];

  return (
    <Layout user={user}>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-6 w-6 text-blue-600" />
                TaskFlow Management
                <span className="text-sm font-normal text-muted-foreground">
                  ({workflows.length})
                </span>
              </CardTitle>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Workflow
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <p className="text-muted-foreground">
                Manage and execute multi-step workflows that integrate Figma designs, Jira tickets, and Git operations.
              </p>
            </div>

            {workflows.length === 0 ? (
              <div className="text-center py-12">
                <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first workflow to automate your development process
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map((workflow) => (
                  <WorkflowCard key={workflow.id} workflow={workflow} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <CreateWorkflowDialog 
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    </Layout>
  );
}