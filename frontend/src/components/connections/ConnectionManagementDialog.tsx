import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ExternalLink, CheckCircle, XCircle, Settings } from 'lucide-react';
import { useAuthorizeMcp, useSetupCredentials } from '@/hooks/api';
import type { MCPServer } from '@/services/api';

interface ConnectionManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mcpServers: MCPServer[];
  unauthorizedServers: string[];
}

export function ConnectionManagementDialog({ 
  open, 
  onOpenChange, 
  mcpServers,
  unauthorizedServers 
}: ConnectionManagementDialogProps) {
  const [gitToken, setGitToken] = useState('');
  const [dockerUsername, setDockerUsername] = useState('');
  const [dockerPassword, setDockerPassword] = useState('');
  
  const authorizeMcpMutation = useAuthorizeMcp();
  const setupCredentialsMutation = useSetupCredentials();

  const handleMcpAuthorization = async (serverName: string) => {
    try {
      const result = await authorizeMcpMutation.mutateAsync(serverName);
      if (result.authUrl) {
        window.open(result.authUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to authorize MCP server:', error);
    }
  };

  const handleGitCredentialsSetup = async () => {
    if (!gitToken.trim()) {
      alert('Please enter a GitHub token');
      return;
    }
    
    try {
      await setupCredentialsMutation.mutateAsync({
        type: 'git-credentials',
        credentials: { token: gitToken }
      });
      setGitToken('');
      alert('Git credentials configured successfully!');
    } catch (error) {
      console.error('Failed to setup git credentials:', error);
      alert('Failed to setup git credentials');
    }
  };

  const handleDockerCredentialsSetup = async () => {
    if (!dockerUsername.trim() || !dockerPassword.trim()) {
      alert('Please enter both username and password');
      return;
    }
    
    try {
      await setupCredentialsMutation.mutateAsync({
        type: 'docker-registry',
        credentials: { username: dockerUsername, password: dockerPassword }
      });
      setDockerUsername('');
      setDockerPassword('');
      alert('Docker credentials configured successfully!');
    } catch (error) {
      console.error('Failed to setup docker credentials:', error);
      alert('Failed to setup docker credentials');
    }
  };

  const getServerStatus = (serverName: string) => {
    return unauthorizedServers.includes(serverName) ? 'unauthorized' : 'authorized';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Connection Management
          </DialogTitle>
          <DialogDescription>
            Manage MCP server authorizations and credential connections required for your prompts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* MCP Servers Section */}
          {mcpServers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔗 MCP Server Connections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mcpServers.map((server) => {
                  const status = getServerStatus(server.name);
                  const isAuthorized = status === 'authorized';
                  
                  return (
                    <div key={server.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {isAuthorized ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <h4 className="font-medium">{server.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {server.url || 'MCP Server Integration'}
                          </p>
                        </div>
                        <Badge variant={isAuthorized ? 'default' : 'destructive'}>
                          {status}
                        </Badge>
                      </div>
                      {!isAuthorized && (
                        <Button
                          size="sm"
                          onClick={() => handleMcpAuthorization(server.name)}
                          disabled={authorizeMcpMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          {authorizeMcpMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                          Authorize
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Git Credentials Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🔑 Git Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Git credentials are used for repository operations. Generate a personal access token from GitHub Settings → Developer settings → Personal access tokens.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="git-token">GitHub Personal Access Token</Label>
                <Input
                  id="git-token"
                  type="password"
                  value={gitToken}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGitToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              
              <Button
                onClick={handleGitCredentialsSetup}
                disabled={setupCredentialsMutation.isPending || !gitToken.trim()}
                className="w-full"
              >
                {setupCredentialsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  'Setup Git Credentials'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Docker Credentials Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🐳 Docker Registry Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Docker credentials are used for container registry operations. Use your Docker Hub or other registry credentials.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="docker-username">Username</Label>
                  <Input
                    id="docker-username"
                    value={dockerUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDockerUsername(e.target.value)}
                    placeholder="your-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docker-password">Password/Token</Label>
                  <Input
                    id="docker-password"
                    type="password"
                    value={dockerPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDockerPassword(e.target.value)}
                    placeholder="your-password-or-token"
                  />
                </div>
              </div>
              
              <Button
                onClick={handleDockerCredentialsSetup}
                disabled={setupCredentialsMutation.isPending || !dockerUsername.trim() || !dockerPassword.trim()}
                className="w-full"
              >
                {setupCredentialsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  'Setup Docker Credentials'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
