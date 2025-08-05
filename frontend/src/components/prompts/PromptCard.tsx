import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionManagementDialog } from '@/components/connections/ConnectionManagementDialog';
import type { Prompt, ConnectionStatus } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CheckCircle, XCircle } from 'lucide-react';
import { useMCPServers } from '@/hooks/api';

interface PromptCardProps {
  prompt: Prompt;
  connectionStatuses: ConnectionStatus[];
}

export function PromptCard({ prompt, connectionStatuses }: PromptCardProps) {
  const navigate = useNavigate();
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const { data: mcpServers } = useMCPServers();
  
  // Get all required connections - both MCP servers and credential connections
  const requiredMcpServers = prompt.mcp_servers || [];
  const promptConnections = prompt.connections || [];
  const allRequiredConnections = [
    ...requiredMcpServers,
    ...promptConnections.map(conn => conn.name)
  ];
  
  // Create a map of connection statuses
  const connectionStatusMap = new Map(
    connectionStatuses.map(conn => [conn.name, conn.isAvailable ? 'authorized' : 'unauthorized'])
  );
  
  // Truncate description
  const description = prompt.description || prompt.messages[0]?.content || '';
  const truncatedDescription = description.length > 100 
    ? description.substring(0, 100) + '...' 
    : description;

  const handleActivityClick = () => {
    navigate(`/prompts/${prompt.name}/activity`);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl">{prompt.name}</CardTitle>
        <CardDescription>{truncatedDescription}</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        {allRequiredConnections.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Required Connections:</p>
            <div className="flex flex-wrap gap-2">
              {/* MCP Server Connections */}
              {requiredMcpServers.map((serverName: string) => {
                const isAuthorized = connectionStatusMap.get(serverName) === 'authorized';
                return (
                  <div key={serverName} className="flex items-center gap-1">
                    {isAuthorized ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">{serverName}</span>
                  </div>
                );
              })}
              {/* Additional Connections from prompt.connections */}
              {promptConnections.map((connection) => {
                const isAuthorized = connection.isAvailable;
                return (
                  <div key={connection.name} className="flex items-center gap-1">
                    {isAuthorized ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">{connection.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleActivityClick}
          className="flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Explore
        </Button>
      </CardFooter>
      
      <ConnectionManagementDialog
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
        mcpServers={mcpServers?.filter(server => 
          requiredMcpServers.includes(server.name)
        ) || []}
        unauthorizedServers={[]}
      />
    </Card>
  );
}
