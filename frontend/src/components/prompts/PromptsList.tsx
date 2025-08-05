import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PromptCard } from './PromptCard';
import { usePrompts, useConnectionStatuses } from '@/hooks/api';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PromptsList() {
  const { data: prompts, isLoading: promptsLoading, error: promptsError } = usePrompts();
  const { data: connectionStatuses, isLoading: connectionsLoading } = useConnectionStatuses();

  if (promptsLoading || connectionsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 Your Prompts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (promptsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 Your Prompts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load prompts: {promptsError.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const promptList = prompts || [];
  const connections = connectionStatuses || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📋 Your Prompts
          <span className="text-sm font-normal text-muted-foreground">
            ({promptList.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {promptList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No prompts available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promptList.map((prompt) => (
              <PromptCard
                key={prompt.name}
                prompt={prompt}
                connectionStatuses={connections}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
