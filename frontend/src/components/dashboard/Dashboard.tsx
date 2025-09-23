import { Layout } from '@/components/layout/Layout';
import { PromptsList } from '@/components/prompts/PromptsList';
import { ConnectionsList } from '@/components/connections/ConnectionsList';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Workflow, Zap, Settings } from 'lucide-react';

export function Dashboard() {
  const { data: user } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout user={user}>
      <div className="space-y-8">
        {/* Quick Navigation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Access key features and tools</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => navigate('/taskflow')}
              >
                <Workflow className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Task Flow</div>
                  <div className="text-sm text-muted-foreground">Manage project tasks</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => {}}
              >
                <Zap className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">AI Prompts</div>
                  <div className="text-sm text-muted-foreground">Run AI workflows</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => {}}
              >
                <Settings className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Connections</div>
                  <div className="text-sm text-muted-foreground">Manage integrations</div>
                </div>
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
