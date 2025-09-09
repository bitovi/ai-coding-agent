import { Card, CardContent } from '@/components/ui/card';
import { FileText, CheckCircle, Clock, Users } from 'lucide-react';

interface StatCard {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
}

const statsData: StatCard[] = [
  {
    title: 'Total Tasks',
    value: '30',
    description: 'All tasks in the system',
    icon: FileText,
    iconColor: 'text-blue-400',
  },
  {
    title: 'Completed Tasks',
    value: '5',
    description: '17% completed',
    icon: CheckCircle,
    iconColor: 'text-green-400',
  },
  {
    title: 'Open Tasks',
    value: '10',
    description: 'Tasks currently in progress',
    icon: Clock,
    iconColor: 'text-yellow-400',
  },
  {
    title: 'Team Members',
    value: '8',
    description: 'Active users on the platform',
    icon: Users,
    iconColor: 'text-purple-400',
  },
];

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {statsData.map((stat) => (
        <Card key={stat.title} className="bg-[#033538] border-white border-2">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1 md:space-y-2">
                <h3 className="text-lg md:text-xl font-semibold text-white">{stat.title}</h3>
                <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                <p className="text-xs md:text-sm text-[#abb4c0]">{stat.description}</p>
              </div>
              <stat.icon className={`h-6 w-6 md:h-8 md:w-8 ${stat.iconColor}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}