import { BarChart3, Calendar, FileText, Home, Users, Menu } from 'lucide-react';

interface SidebarNavItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
}

const navigationItems: SidebarNavItem[] = [
  { name: 'Dashboard', icon: Home, isActive: true },
  { name: 'Tasks', icon: FileText },
  { name: 'Board', icon: Calendar },
  { name: 'Team', icon: Users },
  { name: 'Analytics', icon: BarChart3 },
];

export function TaskFlowSidebar() {
  return (
    <div className="fixed left-0 top-0 h-full w-full md:w-[386px] bg-[#072427] border-r border-gray-600 z-10">
      {/* Logo Section */}
      <div className="p-6 md:p-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-orange-500 rounded-lg flex items-center justify-center">
            <Menu className="h-6 w-6 md:h-8 md:w-8 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">TaskFlow</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-4 md:px-6 space-y-1 md:space-y-2">
        {navigationItems.map((item) => (
          <div
            key={item.name}
            className={`flex items-center space-x-3 md:space-x-4 px-4 md:px-6 py-3 md:py-4 rounded-lg cursor-pointer transition-colors ${
              item.isActive
                ? 'bg-[#002a2e] text-orange-500'
                : 'text-white hover:bg-[#002a2e] hover:text-gray-300'
            }`}
          >
            <item.icon className="h-5 w-5 md:h-6 md:w-6" />
            <span className="text-lg md:text-xl font-semibold">{item.name}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}