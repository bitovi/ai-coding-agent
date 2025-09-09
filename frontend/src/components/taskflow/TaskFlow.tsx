import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Clock, 
  Play,
  Pause
} from 'lucide-react';
import { useState } from 'react';

export interface TaskStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'paused';
  duration?: number;
  startTime?: string;
  endTime?: string;
  output?: string;
  dependencies?: string[];
}

export interface TaskFlowProps {
  title: string;
  description?: string;
  steps: TaskStep[];
  onStepAction?: (stepId: string, action: 'run' | 'pause' | 'retry') => void;
  onFlowAction?: (action: 'start' | 'pause' | 'stop' | 'retry') => void;
  isRunning?: boolean;
  className?: string;
}

export function TaskFlow({ 
  title, 
  description, 
  steps, 
  onStepAction,
  onFlowAction,
  isRunning = false,
  className = ""
}: TaskFlowProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const getStatusIcon = (status: TaskStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'paused':
        return <Pause className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadgeVariant = (status: TaskStep['status']) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      case 'running':
        return 'secondary';
      case 'paused':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getOverallStatus = () => {
    if (steps.some(step => step.status === 'error')) return 'error';
    if (steps.some(step => step.status === 'running')) return 'running';
    if (steps.some(step => step.status === 'paused')) return 'paused';
    if (steps.every(step => step.status === 'completed')) return 'completed';
    return 'pending';
  };

  const getCompletedSteps = () => steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (getCompletedSteps() / totalSteps) * 100 : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              🔄 {title}
              <Badge variant={getStatusBadgeVariant(getOverallStatus())}>
                {getOverallStatus()}
              </Badge>
            </CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-muted-foreground">
                Progress: {getCompletedSteps()}/{totalSteps} steps
              </span>
              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
          {onFlowAction && (
            <div className="flex gap-2">
              {!isRunning ? (
                <Button 
                  size="sm" 
                  onClick={() => onFlowAction('start')}
                  className="flex items-center gap-1"
                >
                  <Play className="h-4 w-4" />
                  Start
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onFlowAction('pause')}
                  className="flex items-center gap-1"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-200" />
              )}
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(step.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{step.title}</h3>
                      <Badge variant={getStatusBadgeVariant(step.status)}>
                        {step.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {step.duration && (
                        <span className="text-xs text-muted-foreground">
                          {step.duration}ms
                        </span>
                      )}
                      {onStepAction && step.status === 'error' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onStepAction(step.id, 'retry')}
                        >
                          Retry
                        </Button>
                      )}
                      {step.output && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedStep(
                            expandedStep === step.id ? null : step.id
                          )}
                        >
                          {expandedStep === step.id ? 'Hide' : 'Show'} Details
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {step.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  )}
                  
                  {step.startTime && (
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Started: {new Date(step.startTime).toLocaleTimeString()}</span>
                      {step.endTime && (
                        <span>Ended: {new Date(step.endTime).toLocaleTimeString()}</span>
                      )}
                    </div>
                  )}
                  
                  {expandedStep === step.id && step.output && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Output:</h4>
                      <pre className="text-xs whitespace-pre-wrap">{step.output}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}