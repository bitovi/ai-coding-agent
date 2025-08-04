import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, Square, AlertCircle } from 'lucide-react';
import { useRunPrompt } from '@/hooks/api';
import type { Prompt } from '@/services/api';

interface PromptExecutionDialogProps {
  prompt: Prompt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptExecutionDialog({ prompt, open, onOpenChange }: PromptExecutionDialogProps) {
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const runPromptMutation = useRunPrompt();

  // Initialize parameters when prompt changes
  useEffect(() => {
    if (prompt?.parameters) {
      const initialParams: Record<string, string> = {};
      Object.entries(prompt.parameters).forEach(([key, param]) => {
        initialParams[key] = param?.default !== undefined 
          ? String(param.default) 
          : '';
      });
      setParameters(initialParams);
    }
  }, [prompt]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setOutput('');
      setError(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [open]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleParameterChange = (key: string, value: string) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const executePrompt = async () => {
    if (!prompt) return;

    setOutput('');
    setError(null);

    try {
      // Create new abort controller for this execution
      abortControllerRef.current = new AbortController();

      console.log('=== FRONTEND DEBUG ===');
      console.log('Parameters being sent:', parameters);

      const stream = await runPromptMutation.mutateAsync({ 
        name: prompt.name, 
        parameters 
      });

      // Handle streaming response
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setOutput(prev => prev + parsed.content);
              }
              if (parsed.error) {
                setError(parsed.error);
                return;
              }
            } catch (e) {
              // If not JSON, treat as plain text
              setOutput(prev => prev + data + '\n');
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setOutput(prev => prev + '\n\n[Execution cancelled by user]');
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    }
  };

  const stopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  if (!prompt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Execute Prompt! {prompt.name}</DialogTitle>
          <DialogDescription>
            {prompt.description || 'Configure parameters and run the prompt'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Parameters Section */}
          {prompt.parameters && Object.keys(prompt.parameters).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Parameters</h3>
              {Object.entries(prompt.parameters).map(([key, param]) => {
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-sm font-medium flex items-center gap-2">
                      {key}
                      {param?.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    </label>
                    {param?.description && (
                      <p className="text-xs text-muted-foreground">{param.description}</p>
                    )}
                    <Textarea
                      value={parameters[key] || ''}
                      onChange={(e) => handleParameterChange(key, e.target.value)}
                      placeholder={param?.default ? `Default: ${param.default}` : `Enter ${key}...`}
                      className="min-h-[60px]"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Output Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Output</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={executePrompt}
                  disabled={runPromptMutation.isPending}
                  variant="default"
                >
                  {runPromptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run
                    </>
                  )}
                </Button>
                {runPromptMutation.isPending && (
                  <Button
                    size="sm"
                    onClick={stopExecution}
                    variant="outline"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
            <div
              ref={outputRef}
              className="flex-1 p-3 bg-muted rounded-md font-mono text-sm overflow-auto border min-h-[200px]"
            >
              {output || (runPromptMutation.isPending ? 'Executing prompt...' : 'Output will appear here when you run the prompt')}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
