import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import type { Workflow } from '@/types/workflow';

interface WorkflowCardProps {
  workflow: Workflow;
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  const getStatusIcon = () => {
    switch (workflow.status) {
      case 'active':
        return <Play className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (workflow.status) {
      case 'active':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'pending':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const progressPercentage = (workflow.progress / workflow.totalSteps) * 100;

  const formatLastRun = (lastRun: string | null) => {
    if (!lastRun) return 'Never run';
    const date = new Date(lastRun);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg leading-tight mb-1">{workflow.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{workflow.description}</p>
          </div>
          <Badge 
            variant="secondary" 
            className={`ml-2 text-white ${getStatusColor()}`}
          >
            <span className="flex items-center gap-1">
              {getStatusIcon()}
              {workflow.status}
            </span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{workflow.progress}/{workflow.totalSteps} steps</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Steps Preview */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Steps:</h4>
          <div className="space-y-1">
            {workflow.steps.slice(0, 3).map((step, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  index < workflow.progress ? 'bg-green-500' : 
                  index === workflow.progress ? 'bg-blue-500' : 'bg-gray-300'
                }`} />
                <span className={`${index < workflow.progress ? 'line-through text-muted-foreground' : ''}`}>
                  {step}
                </span>
              </div>
            ))}
            {workflow.steps.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{workflow.steps.length - 3} more steps
              </div>
            )}
          </div>
        </div>

        {/* Connections */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Required Connections:</h4>
          <div className="flex flex-wrap gap-1">
            {workflow.connections.map((connection) => (
              <Badge key={connection} variant="outline" className="text-xs">
                {connection}
              </Badge>
            ))}
          </div>
        </div>

        {/* Last Run */}
        <div className="text-xs text-muted-foreground">
          Last run: {formatLastRun(workflow.lastRun)}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            variant={workflow.status === 'active' ? 'secondary' : 'default'}
            className="flex-1"
          >
            {workflow.status === 'active' ? (
              <>
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                Run
              </>
            )}
          </Button>
          <Button size="sm" variant="outline">
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}