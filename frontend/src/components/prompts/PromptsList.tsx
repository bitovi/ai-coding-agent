import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PromptCard } from './PromptCard';
import { usePrompts, useConnectionStatuses } from '@/hooks/api';
import { Loader2, AlertCircle, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PromptsList() {
  const { data: prompts, isLoading: promptsLoading, error: promptsError } = usePrompts();
  const { data: connectionStatuses, isLoading: connectionsLoading } = useConnectionStatuses();
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter prompts based on search query
  const filteredPrompts = promptList.filter((prompt) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const name = prompt.name.toLowerCase();
    const description = (prompt.description || prompt.messages[0]?.content || '').toLowerCase();
    
    return name.includes(query) || description.includes(query);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📋 Your Prompts
          <span className="text-sm font-normal text-muted-foreground">
            ({promptList.length})
          </span>
        </CardTitle>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search prompts by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {promptList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No prompts available</p>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No prompts found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrompts.map((prompt) => (
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
