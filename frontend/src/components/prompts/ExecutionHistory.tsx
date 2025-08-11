import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePromptHistory } from '@/hooks/api';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { ExecutionMessage } from './ExecutionMessage';

interface ExecutionHistoryProps {
  promptName: string;
}

export function ExecutionHistory({ promptName }: ExecutionHistoryProps) {
  const { data: history, isLoading: historyLoading } = usePromptHistory(promptName);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>📈 Execution History</CardTitle>
      </CardHeader>
      <CardContent>
        {historyLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !history || !Array.isArray(history) || history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <h3 className="font-semibold">No executions yet</h3>
            <p>Run this prompt to see its activity here</p>
            <div className="mt-4 text-xs">
              Debug: {JSON.stringify({ history, type: typeof history, isArray: Array.isArray(history) })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((execution) => (
              <div key={execution.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(execution.status)}
                    <Badge variant="outline">{execution.status}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(execution.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {execution.duration && (
                    <span className="text-sm text-muted-foreground">
                      {execution.duration}ms
                    </span>
                  )}
                </div>
                
                {execution.parameters && Object.keys(execution.parameters).length > 0 && (
                  <div className="mb-2">
                    <strong className="text-sm">Parameters:</strong>
                    <pre className="text-xs bg-muted p-2 rounded mt-1">
                      {JSON.stringify(execution.parameters, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Show execution messages - this is the rich content from Claude Code SDK */}
                {execution.messages && execution.messages.length > 0 && (
                  <div className="mb-2">
                    <strong className="text-sm">Execution Messages:</strong>
                    <div className="space-y-2 mt-1">
                      {execution.messages.map((message, index) => (
                        <ExecutionMessage key={index} message={message} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy output field */}
                {execution.output && (
                  <div>
                    <strong className="text-sm">Output:</strong>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-40 overflow-y-auto">
                      {execution.output}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
