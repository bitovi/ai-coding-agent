interface Task {
  id: string;
  title: string;
  assignee: string;
  initials: string;
  priority: 'high' | 'medium' | 'low';
}

interface TaskItemProps {
  task: Task;
}

function TaskItem({ task }: TaskItemProps) {
  const priorityColors = {
    high: 'bg-[#072427] text-[#b9bfcc]',
    medium: 'bg-[#072427] text-[#b9bfcc]',
    low: 'bg-[#072427] text-[#b9bfcc]',
  };

  return (
    <div className="flex items-center gap-4 py-4">
      {/* Avatar */}
      <div className="w-[59px] h-[59px] bg-teal-500 rounded-full flex items-center justify-center">
        <span className="text-white text-xl font-bold font-['Inter']">{task.initials}</span>
      </div>
      
      {/* Task Info */}
      <div className="flex-1">
        <h4 className="text-white text-lg font-bold mb-1 font-['Inter'] leading-6">
          {task.title}
        </h4>
        <p className="text-[#b9bfcc] text-lg font-['Inter']">
          Assigned to {task.assignee}
        </p>
      </div>
      
      {/* Priority Badge */}
      <div className={`px-4 py-1 rounded-full ${priorityColors[task.priority]}`}>
        <span className="text-lg font-bold font-['Inter']">{task.priority}</span>
      </div>
    </div>
  );
}

export function RecentTasks() {
  const tasks: Task[] = [
    {
      id: '1',
      title: 'Add video conferencing intergration',
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

  return (
    <div className="bg-[#033539] rounded-lg p-8 border-2 border-white h-[723px]">
      <h2 className="text-white text-4xl font-bold mb-4 font-['Poppins']">Recent Tasks</h2>
      <p className="text-[#b9bfcc] text-lg mb-8 font-bold font-['Inter']">
        An overview of the most recently created tasks
      </p>
      
      {/* Tasks List */}
      <div className="space-y-6">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}