import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ExecutionHistory } from '@/components/prompts/ExecutionHistory';
import { RunPrompt } from '@/components/prompts/RunPrompt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  usePrompt, 
  useDashboardData 
} from '@/hooks/api';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle
} from 'lucide-react';

export function PromptActivity() {
  const { promptName } = useParams<{ promptName: string }>();
  const navigate = useNavigate();
  
  const { data: dashboardData } = useDashboardData();
  const { data: prompt, isLoading: promptLoading } = usePrompt(promptName!);

  if (!promptName) {
    return <div>Invalid prompt name</div>;
  }

  const handleBack = () => {
    navigate('/');
  };

  if (promptLoading) {
    return (
      <Layout user={dashboardData?.user}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!prompt) {
    return (
      <Layout user={dashboardData?.user}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Prompt "{promptName}" not found
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout user={dashboardData?.user}>
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-2xl">📊 {promptName}</CardTitle>
                <p className="text-muted-foreground">Prompt Activity & History</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Prompt Details */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Prompt Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p><strong>MCP Services:</strong> {prompt.mcp_servers?.join(', ') || 'None'}</p>
              <p><strong>Messages:</strong> {prompt.messages?.length || 0} message(s)</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">📝 Prompt Messages</h3>
              {prompt.messages?.map((message, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Message {index + 1}</Badge>
                    <Badge>{message.role}</Badge>
                  </div>
                  <pre className="text-sm bg-muted p-2 rounded whitespace-pre-wrap">
                    {message.content}
                  </pre>
                </div>
              )) || <p className="text-muted-foreground">No messages available</p>}
            </div>
          </CardContent>
        </Card>

        {/* Run Prompt */}
        <RunPrompt prompt={prompt} promptName={promptName} />

        {/* Execution History */}
        <ExecutionHistory promptName={promptName} />
      </div>
    </Layout>
  );
}
