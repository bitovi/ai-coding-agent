import { Layout } from '@/components/layout/Layout';
import { PromptsList } from '@/components/prompts/PromptsList';
import { ConnectionsList } from '@/components/connections/ConnectionsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Workflow } from 'lucide-react';

export function Dashboard() {
  const { data: user } = useAuth();
  const navigate = useNavigate();

  const handleTaskFlowDemo = () => {
    navigate('/taskflow');
  };

  return (
    <Layout user={user}>
      <div className="space-y-8">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button 
                onClick={handleTaskFlowDemo}
                className="flex items-center gap-2"
              >
                <Workflow className="h-4 w-4" />
                View TaskFlow Demo
              </Button>
            </div>
          </CardContent>
        </Card>

        <PromptsList />
        <ConnectionsList />
      </div>
    </Layout>
  );
}
