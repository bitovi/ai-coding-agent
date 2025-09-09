import { Layout } from '@/components/layout/Layout';
import { PromptsList } from '@/components/prompts/PromptsList';
import { ConnectionsList } from '@/components/connections/ConnectionsList';
import { TaskFlow } from '@/components/taskflow/TaskFlow';
import { useAuth } from '@/hooks/useAuth';

export function Dashboard() {
  const { data: user } = useAuth();

  const handleTaskAction = (taskId: string, action: 'start' | 'pause' | 'retry') => {
    console.log(`Task ${taskId}: ${action}`);
    // In a real implementation, this would call an API to update task status
  };

  return (
    <Layout user={user}>
      <div className="space-y-8">
        <TaskFlow onTaskAction={handleTaskAction} />
        <PromptsList />
        <ConnectionsList />
      </div>
    </Layout>
  );
}
