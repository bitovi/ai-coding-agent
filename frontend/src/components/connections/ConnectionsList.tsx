import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionCard } from './ConnectionCard';
import { useConnectionStatuses } from '@/hooks/api';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ConnectionsList() {
  const { data: connections, isLoading, error } = useConnectionStatuses();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔗 Your Connections
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔗 Your Connections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load connections: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const connectionList = connections || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔗 Your Connections
          <span className="text-sm font-normal text-muted-foreground">
            ({connectionList.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {connectionList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No connections available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectionList.map((connection) => (
              <ConnectionCard
                key={connection.name}
                connection={connection}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
