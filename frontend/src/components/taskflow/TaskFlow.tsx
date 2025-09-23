import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Plus, CheckCircle, Clock, AlertCircle, Play, Pause } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
}

interface TaskFlowProps {
  title?: string;
  description?: string;
}

const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Design System Setup',
    description: 'Create base components and design tokens for the application',
    status: 'completed',
    priority: 'high',
    assignee: 'John Doe',
    dueDate: '2025-01-15'
  },
  {
    id: '2',
    title: 'API Integration',
    description: 'Integrate frontend with backend API endpoints',
    status: 'in-progress',
    priority: 'high',
    assignee: 'Jane Smith'
  },
  {
    id: '3',
    title: 'User Authentication',
    description: 'Implement login, logout, and session management',
    status: 'pending',
    priority: 'medium',
    assignee: 'Mike Johnson',
    dueDate: '2025-01-20'
  },
  {
    id: '4',
    title: 'Testing Setup',
    description: 'Configure unit and integration testing framework',
    status: 'blocked',
    priority: 'medium'
  }
];

const statusConfig = {
  pending: { icon: Clock, color: 'bg-gray-100 text-gray-800 border-gray-200', iconColor: 'text-gray-600' },
  'in-progress': { icon: Play, color: 'bg-blue-100 text-blue-800 border-blue-200', iconColor: 'text-blue-600' },
  completed: { icon: CheckCircle, color: 'bg-green-100 text-green-800 border-green-200', iconColor: 'text-green-600' },
  blocked: { icon: AlertCircle, color: 'bg-red-100 text-red-800 border-red-200', iconColor: 'text-red-600' }
};

const priorityConfig = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800'
};

export function TaskFlow({ title = "Task Flow", description = "Manage and track your project tasks" }: TaskFlowProps) {
  const [tasks] = useState<Task[]>(sampleTasks);
  const [filter, setFilter] = useState<string>('all');
  const { data: user } = useAuth();

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const statusCounts = {
    pending: tasks.filter(t => t.status === 'pending').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    blocked: tasks.filter(t => t.status === 'blocked').length
  };

  return (
    <Layout user={user}>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => {
          const config = statusConfig[status as keyof typeof statusConfig];
          const StatusIcon = config.icon;
          return (
            <Card 
              key={status} 
              className={`cursor-pointer transition-all hover:shadow-md ${filter === status ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setFilter(filter === status ? 'all' : status)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <StatusIcon className={`h-5 w-5 ${config.iconColor}`} />
                  <div>
                    <p className="text-sm font-medium capitalize">{status.replace('-', ' ')}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All Tasks ({tasks.length})
        </Button>
        {Object.entries(statusCounts).map(([status, count]) => (
          <Button 
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status.replace('-', ' ')} ({count})
          </Button>
        ))}
      </div>

      {/* Tasks Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTasks.map((task) => {
          const statusConf = statusConfig[task.status];
          const StatusIcon = statusConf.icon;
          
          return (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{task.title}</CardTitle>
                  <Badge className={priorityConfig[task.priority]}>
                    {task.priority}
                  </Badge>
                </div>
                <CardDescription>{task.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-4 w-4 ${statusConf.iconColor}`} />
                  <Badge variant="outline" className={statusConf.color}>
                    {task.status.replace('-', ' ')}
                  </Badge>
                </div>
                
                {task.assignee && (
                  <div>
                    <p className="text-sm text-muted-foreground">Assignee</p>
                    <p className="text-sm font-medium">{task.assignee}</p>
                  </div>
                )}
                
                {task.dueDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="text-sm font-medium">{task.dueDate}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTasks.length === 0 && (
        <Card className="p-8">
          <div className="text-center">
            <Pause className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No tasks found</h3>
            <p className="text-muted-foreground">
              {filter === 'all' 
                ? 'No tasks have been created yet.' 
                : `No tasks with status "${filter.replace('-', ' ')}" found.`
              }
            </p>
          </div>
        </Card>
      )}
    </div>
    </Layout>
  );
}