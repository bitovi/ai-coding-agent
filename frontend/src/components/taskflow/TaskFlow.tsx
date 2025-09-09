import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Clock, 
  Play, 
  Pause, 
  AlertCircle,
  GitBranch,
  Code,
  FileText,
  TestTube
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  type: 'code' | 'test' | 'docs' | 'review';
  dependencies?: string[];
  estimatedTime?: string;
}

interface TaskFlowProps {
  tasks?: Task[];
  onTaskAction?: (taskId: string, action: 'start' | 'pause' | 'retry') => void;
}

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Analyze Repository Structure',
    description: 'Examine the codebase to understand the architecture and dependencies',
    status: 'completed',
    progress: 100,
    type: 'code',
    estimatedTime: '5 min'
  },
  {
    id: 'task-2',
    title: 'Implement Component',
    description: 'Create the TaskFlow component based on design specifications',
    status: 'running',
    progress: 65,
    type: 'code',
    dependencies: ['task-1'],
    estimatedTime: '15 min'
  },
  {
    id: 'task-3',
    title: 'Write Unit Tests',
    description: 'Create comprehensive tests for the new TaskFlow component',
    status: 'pending',
    progress: 0,
    type: 'test',
    dependencies: ['task-2'],
    estimatedTime: '10 min'
  },
  {
    id: 'task-4',
    title: 'Update Documentation',
    description: 'Add documentation for the TaskFlow component usage',
    status: 'pending',
    progress: 0,
    type: 'docs',
    dependencies: ['task-2'],
    estimatedTime: '8 min'
  }
];

const getStatusIcon = (status: Task['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Play className="h-4 w-4 text-blue-500" />;
    case 'paused':
      return <Pause className="h-4 w-4 text-yellow-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const getTypeIcon = (type: Task['type']) => {
  switch (type) {
    case 'code':
      return <Code className="h-4 w-4" />;
    case 'test':
      return <TestTube className="h-4 w-4" />;
    case 'docs':
      return <FileText className="h-4 w-4" />;
    case 'review':
      return <GitBranch className="h-4 w-4" />;
    default:
      return <Code className="h-4 w-4" />;
  }
};

const getStatusColor = (status: Task['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'running':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'pending':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function TaskFlow({ tasks = mockTasks, onTaskAction }: TaskFlowProps) {
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const totalTasks = tasks.length;
  const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const handleTaskAction = (taskId: string, action: 'start' | 'pause' | 'retry') => {
    if (onTaskAction) {
      onTaskAction(taskId, action);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            🔄 TaskFlow
            <span className="text-sm font-normal text-muted-foreground">
              ({completedTasks}/{totalTasks} completed)
            </span>
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {Math.round(overallProgress)}% Complete
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Overall Progress</div>
          <Progress value={overallProgress} className="w-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task, index) => (
            <div key={task.id} className="relative">
              {/* Connection line to next task */}
              {index < tasks.length - 1 && (
                <div className="absolute left-4 top-12 w-0.5 h-8 bg-gray-200" />
              )}
              
              <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-background border">
                  {getStatusIcon(task.status)}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{task.title}</h4>
                      <div className="flex items-center gap-1">
                        {getTypeIcon(task.type)}
                        <span className="text-xs text-muted-foreground capitalize">{task.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.estimatedTime && (
                        <span className="text-xs text-muted-foreground">{task.estimatedTime}</span>
                      )}
                      <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  
                  {task.progress > 0 && task.status !== 'completed' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{task.progress}%</span>
                      </div>
                      <Progress value={task.progress} className="h-2" />
                    </div>
                  )}
                  
                  {task.dependencies && task.dependencies.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Depends on: {task.dependencies.join(', ')}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    {task.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTaskAction(task.id, 'start')}
                        className="text-xs"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start
                      </Button>
                    )}
                    {task.status === 'running' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTaskAction(task.id, 'pause')}
                        className="text-xs"
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause
                      </Button>
                    )}
                    {task.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTaskAction(task.id, 'retry')}
                        className="text-xs"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}