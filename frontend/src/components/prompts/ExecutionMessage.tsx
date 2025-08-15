//import { Badge } from '@/components/ui/badge';

interface ExecutionMessageProps {
  message: {
    type: string;
    timestamp: string;
    data?: any;
  };
}

// Helper function to format tool names
function formatToolName(toolName: string): string {
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    if (parts.length >= 3) {
      return `${parts[1]}.${parts[2]}`;
    }
  }
  return toolName;
}

// Helper function to parse and format JSON content
function formatJsonContent(content: string): { isJson: boolean; formatted?: any; raw: string } {
  try {
    const parsed = JSON.parse(content);
    return { isJson: true, formatted: parsed, raw: content };
  } catch {
    return { isJson: false, raw: content };
  }
}

export function ExecutionMessage({ message }: ExecutionMessageProps) {
  const data = message.data;
  
  return (
    <div className="text-xs border rounded p-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      {/* System initialization message */}
      {data?.type === 'system' && data?.subtype === 'init' && (
        <div className="bg-blue-50 p-2 rounded">
          <div className="font-semibold mb-2">🏗️ System Initialized</div>
          <div className="space-y-1">
            <div><strong>Working Directory:</strong> {data.cwd}</div>
            <div><strong>Model:</strong> {data.model}</div>
            <div><strong>Permission Mode:</strong> {data.permissionMode}</div>
            {data.mcp_servers && data.mcp_servers.length > 0 && (
              <div>
                <strong>MCP Servers:</strong> {data.mcp_servers.map((s: any) => s.name).join(', ')}
              </div>
            )}
            <div>
              <strong>Available Tools:</strong> {data.tools?.length || 0} tools
              {data.tools && data.tools.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-blue-600">Show all tools</summary>
                  <div className="mt-1 text-xs bg-white p-2 rounded max-h-32 overflow-y-auto">
                    {data.tools.map((tool: string, idx: number) => (
                      <div key={idx} className="font-mono">{formatToolName(tool)}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assistant tool use message */}
      {data?.type === 'assistant' && data?.message?.content && (
        <div className="space-y-2">
          {data.message.content.map((content: any, idx: number) => (
            <div key={idx}>
              {content.type === 'text' && (
                <div className="bg-green-50 p-2 rounded">
                  <div className="font-semibold mb-1">🤖 Claude Response</div>
                  <div className="whitespace-pre-wrap">{content.text}</div>
                </div>
              )}
              
              {content.type === 'tool_use' && (
                <div className="bg-orange-50 p-2 rounded">
                  <div className="font-semibold mb-1">🔧 Tool Call: {formatToolName(content.name)}</div>
                  {content.input && Object.keys(content.input).length > 0 && (
                    <div>
                      <strong>Parameters:</strong>
                      <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(content.input, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tool result message */}
      {data?.type === 'user' && data?.message?.content && (
        <div className="space-y-2">
          {data.message.content.map((content: any, idx: number) => (
            <div key={idx}>
              {content.type === 'tool_result' && (
                <div className={`p-2 rounded ${content.is_error ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="font-semibold mb-1">
                    {content.is_error ? '❌ Tool Error' : '✅ Tool Result'}
                  </div>
                  
                  {content.is_error ? (
                    <div className="text-red-700">
                      <strong>Error:</strong> {content.content}
                    </div>
                  ) : (
                    <div>
                      {Array.isArray(content.content) ? (
                        content.content.map((item: any, itemIdx: number) => {
                          if (item.type === 'text') {
                            const jsonResult = formatJsonContent(item.text);
                            return (
                              <div key={itemIdx}>
                                {jsonResult.isJson ? (
                                  <div>
                                    <strong>JSON Response:</strong>
                                    <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto max-h-40">
                                      {JSON.stringify(jsonResult.formatted, null, 2)}
                                    </pre>
                                  </div>
                                ) : (
                                  <div>
                                    <strong>Response:</strong>
                                    <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto max-h-40 whitespace-pre-wrap">
                                      {item.text}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })
                      ) : (
                        <div>
                          <strong>Response:</strong>
                          <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto max-h-40 whitespace-pre-wrap">
                            {content.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Final result message */}
      {data?.type === 'result' && (
        <div className="bg-gray-50 p-2 rounded">
          <div className="font-semibold mb-1">✅ Execution Complete</div>
          <div>Result: {data.result}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Duration: {data.duration_ms}ms | 
            Turns: {data.num_turns} | 
            Cost: ${data.total_cost_usd?.toFixed(6)}
          </div>
        </div>
      )}

      {/* Raw message data for debugging */}
      <details className="mt-2">
        <summary className="text-xs cursor-pointer text-muted-foreground hover:text-gray-700">
          Show raw data
        </summary>
        <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto max-h-60">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
