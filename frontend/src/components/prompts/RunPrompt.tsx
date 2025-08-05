import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useRunPrompt } from '@/hooks/api';
import { Play, Eye } from 'lucide-react';

interface PromptMessage {
  role: string;
  content: string;
  parameters?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface Prompt {
  name: string;
  messages?: PromptMessage[];
}

interface RunPromptProps {
  prompt: Prompt;
  promptName: string;
}

export function RunPrompt({ prompt, promptName }: RunPromptProps) {
  const [parameters, setParameters] = useState('{}');
  const [showPreview, setShowPreview] = useState(false);
  const [processedPrompt, setProcessedPrompt] = useState<any>(null);
  
  const runPromptMutation = useRunPrompt();

  // Process prompt messages for parameter substitution (from prompt-utils.js logic)
  const processPromptWithParameters = (prompt: any, parameters: any) => {
    const processedMessages = prompt.messages?.map((message: any) => {
      let content = message.content;
      
      // Simple parameter substitution using {{parameterName}} syntax
      for (const [key, value] of Object.entries(parameters)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, String(value));
      }
      
      return {
        role: message.role,
        content: content
      };
    });

    return { ...prompt, messages: processedMessages };
  };

  // Generate example parameters using the same logic as legacy WebUIService.js
  useEffect(() => {
    const exampleParams: Record<string, any> = {};
    
    if (prompt.messages) {
      prompt.messages.forEach((message: any) => {
        if (message.parameters?.properties) {
          Object.entries(message.parameters.properties).forEach(([name, prop]: [string, any]) => {
            if (prop.default !== undefined) {
              exampleParams[name] = prop.default;
            } else if (prop.type === 'string') {
              exampleParams[name] = prop.description ? `Example ${prop.description.toLowerCase()}` : `example ${name}`;
            } else if (prop.type === 'number') {
              exampleParams[name] = 42;
            } else if (prop.type === 'boolean') {
              exampleParams[name] = true;
            } else {
              exampleParams[name] = `example ${name}`;
            }
          });
        }
      });
    }

    const exampleParamsJSON = Object.keys(exampleParams).length > 0 ? 
      JSON.stringify(exampleParams, null, 2) : '{}';
    
    setParameters(exampleParamsJSON);
  }, [prompt]);

  const handleRunPrompt = () => {
    try {
      const parsedParams = JSON.parse(parameters);
      runPromptMutation.mutate({ name: promptName, parameters: parsedParams });
    } catch (error) {
      alert('Invalid JSON parameters');
    }
  };

  const handlePreviewPrompt = async () => {
    try {
      const parsedParams = JSON.parse(parameters);
      
      // Process the prompt with the parameters to show template substitution
      const processed = processPromptWithParameters(prompt, parsedParams);
      setProcessedPrompt(processed);
      setShowPreview(true);
    } catch (error) {
      alert('Invalid JSON parameters');
    }
  };



  return (
    <>
      {/* Run Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>▶️ Run Prompt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Parameters (JSON):
            </label>
            <Textarea
              value={parameters}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setParameters(e.target.value)}
              placeholder="Enter parameters as JSON..."
              rows={6}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 Tip: Parameters will be substituted into the prompt messages using {'{{parameterName}}'} syntax
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleRunPrompt}
              disabled={runPromptMutation.isPending}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {runPromptMutation.isPending ? 'Running...' : 'Run with Parameters!'}
            </Button>
            <Button 
              variant="outline"
              onClick={handlePreviewPrompt}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {showPreview && processedPrompt && (
        <Card>
          <CardHeader>
            <CardTitle>👁️ Prompt Preview (with Parameters Applied)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {processedPrompt.messages?.map((message: any, index: number) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Message {index + 1}</Badge>
                    <Badge>{message.role}</Badge>
                  </div>
                  <pre className="text-sm bg-muted p-2 rounded whitespace-pre-wrap">
                    {message.content}
                  </pre>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowPreview(false)}
              className="mt-4"
            >
              Hide Preview
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
