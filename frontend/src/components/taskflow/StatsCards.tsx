import { CheckSquare, Clock, Users } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ title, value, subtitle, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-[#033538] rounded-lg p-6 border-2 border-white relative">
      {/* Icon */}
      <div className="absolute top-6 right-6">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      
      {/* Content */}
      <div>
        <h3 className="text-white text-xl font-bold mb-4 font-['Inter']">{title}</h3>
        <div className="text-white text-4xl font-bold mb-2 font-['Inter']">{value}</div>
        <p className="text-[#abb4c0] text-lg font-['Inter']">{subtitle}</p>
      </div>
    </div>
  );
}

export function StatsCards() {
  const stats = [
    {
      title: 'Total Tasks',
      value: '30',
      subtitle: 'All tasks in the system',
      icon: CheckSquare,
    },
    {
      title: 'Completed Tasks',
      value: '5',
      subtitle: '17% completed',
      icon: CheckSquare,
    },
    {
      title: 'Open Tasks',
      value: '10',
      subtitle: 'Tasks currently in progress',
      icon: Clock,
    },
    {
      title: 'Team Members',
      value: '8',
      subtitle: 'Active users on the platform',
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
}