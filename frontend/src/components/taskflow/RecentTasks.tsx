import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Task {
  id: string;
  title: string;
  assignee: string;
  initials: string;
  priority: 'high' | 'medium' | 'low';
}

const recentTasks: Task[] = [
  {
    id: '1',
    title: 'Add video conferencing integration',
    assignee: 'Alice Johnson',
    initials: 'AJ',
    priority: 'medium',
  },
  {
    id: '2',
    title: 'Created automated workflow system',
    assignee: 'Charlie Brown',
    initials: 'CB',
    priority: 'high',
  },
  {
    id: '3',
    title: 'Create integration with third-party tools',
    assignee: 'Charlie Brown',
    initials: 'CB',
    priority: 'medium',
  },
  {
    id: '4',
    title: 'Implement advanced project templates',
    assignee: 'Fiona Green',
    initials: 'FG',
    priority: 'low',
  },
  {
    id: '5',
    title: 'Add multi-language support',
    assignee: 'Fiona Green',
    initials: 'FG',
    priority: 'low',
  },
];

const priorityColors = {
  high: 'bg-red-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-gray-500 text-white',
};

export function RecentTasks() {
  return (
    <Card className="bg-[#033539] border-white border-2 text-white">
      <CardHeader>
        <CardTitle className="text-2xl md:text-4xl font-bold">Recent Tasks</CardTitle>
        <p className="text-[#b9bfcc] text-sm md:text-lg">
          An overview of the most recently created tasks
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 md:space-y-6">
          {recentTasks.map((task) => (
            <div key={task.id} className="flex items-start space-x-3 md:space-x-4">
              {/* Avatar */}
              <div className="w-10 h-10 md:w-12 md:h-12 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm md:text-lg">{task.initials}</span>
              </div>
              
              {/* Task Details */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm md:text-lg font-semibold text-white mb-1 leading-tight">
                  {task.title}
                </h4>
                <p className="text-[#b9bfcc] text-xs md:text-base">
                  Assigned to {task.assignee}
                </p>
              </div>
              
              {/* Priority Badge */}
              <Badge 
                variant="secondary"
                className={`${priorityColors[task.priority]} rounded-full px-2 md:px-3 py-1 text-xs md:text-sm font-semibold`}
              >
                {task.priority}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}