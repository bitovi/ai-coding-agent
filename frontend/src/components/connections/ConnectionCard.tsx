import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ConnectionStatus } from '@/services/api';
import { useAuthorizeService, useSetupCredentials } from '@/hooks/api';
import { CheckCircle, XCircle, Lock, Wifi, ArrowRightLeft } from 'lucide-react';

interface ConnectionCardProps {
  connection: ConnectionStatus;
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const authorizeServiceMutation = useAuthorizeService();
  const setupCredentialsMutation = useSetupCredentials();
  
  const isAuthorized = connection.isAvailable;
  
  const handleAuthorize = async () => {
    // Handle different connection types
    if (connection.type === 'credential') {
      await handleCredentialSetup();
    } else {
      // Handle MCP server authorization
      await handleMcpAuthorization();
    }
  };

  const handleMcpAuthorization = async () => {
    try {
      const result = await authorizeServiceMutation.mutateAsync(connection.name);
      if (result.authUrl) {
        window.open(result.authUrl, '_blank');
      }
    } catch (error) {
      console.error('Authorization failed:', error);
    }
  };

  const handleCredentialSetup = async () => {
    try {
      if (connection.name === 'git-credentials') {
        const token = prompt('Enter your GitHub Personal Access Token:');
        if (!token) {
          return;
        }
        
        await setupCredentialsMutation.mutateAsync({
          type: 'git-credentials',
          credentials: { token }
        });
        
        alert('✅ Git credentials configured successfully!');
      }
    } catch (error) {
      console.error('Credential setup failed:', error);
      alert('Failed to setup credentials. Please try again.');
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
            {connection.isProxy && (
              <span className="block text-blue-600 font-medium">
                <ArrowRightLeft className="inline h-3 w-3 mr-1" />
                Proxied Connection
              </span>
            )}
          </span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          {getStatusIcon()}
          <Badge 
            variant={isAuthorized ? 'default' : 'destructive'}
            className="pointer-events-none"
          >
            {isAuthorized ? 'Authorized' : 'Not Authorized'}
          </Badge>
        </div>
        {connection.isProxy && (
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary"
              className="pointer-events-none text-blue-600 border-blue-200 bg-blue-50"
            >
              <ArrowRightLeft className="h-3 w-3 mr-1" />
              Proxied
            </Badge>
          </div>
        )}
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
            disabled={authorizeServiceMutation.isPending || setupCredentialsMutation.isPending}
            className="w-full"
          >
            {(authorizeServiceMutation.isPending || setupCredentialsMutation.isPending) ? (
              'Setting up...'
            ) : (
              <>
                {connection.type === 'credential' ? '🔐 Setup' : '🔐 Authorize'}
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
