import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ConnectionStatus } from '@/services/api';
import { useAuthorizeService } from '@/hooks/api';
import { CheckCircle, XCircle, Lock, Wifi } from 'lucide-react';

interface ConnectionCardProps {
  connection: ConnectionStatus;
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const authorizeServiceMutation = useAuthorizeService();
  
  const isAuthorized = connection.isAvailable;
  
  const handleAuthorize = async () => {
    try {
      const result = await authorizeServiceMutation.mutateAsync(connection.name);
      if (result.authUrl) {
        window.open(result.authUrl, '_blank');
      }
    } catch (error) {
      console.error('Authorization failed:', error);
    }
  };

  const getStatusIcon = () => {
    if (isAuthorized) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getConnectionTypeIcon = () => {
    switch (connection.type) {
      case 'url':
        return <Wifi className="h-4 w-4" />;
      case 'stdio':
        return <Lock className="h-4 w-4" />;
      default:
        return <Lock className="h-4 w-4" />;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getConnectionTypeIcon()}
          {connection.name}
        </CardTitle>
        <CardDescription>
          <span className="block space-y-1">
            <span className="block"><strong>Type:</strong> {connection.type}</span>
            {connection.url && (
              <span className="block"><strong>URL:</strong> {connection.url}</span>
            )}
          </span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <Badge 
            variant={isAuthorized ? 'default' : 'destructive'}
            className="pointer-events-none"
          >
            {isAuthorized ? 'Authorized' : 'Not Authorized'}
          </Badge>
        </div>
      </CardContent>
      
      <CardFooter>
        {isAuthorized ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="w-full"
          >
            ✅ Connected
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleAuthorize}
            disabled={authorizeServiceMutation.isPending}
            className="w-full"
          >
            {authorizeServiceMutation.isPending ? (
              'Authorizing...'
            ) : (
              <>
                🔐 Authorize
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
