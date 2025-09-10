import { CheckSquare, BarChart3, Users, Home, List } from 'lucide-react';

export function TaskFlowSidebar() {
  const navItems = [
    { icon: Home, label: 'Dashboard', active: true },
    { icon: CheckSquare, label: 'Tasks', active: false },
    { icon: List, label: 'Board', active: false },
    { icon: Users, label: 'Team', active: false },
    { icon: BarChart3, label: 'Analytics', active: false },
  ];

  return (
    <div className="bg-[#072427] w-[386px] h-screen p-6">
      {/* Logo */}
      <div className="flex items-center gap-4 mb-12 pt-10">
        <div className="w-14 h-14 bg-orange-500 rounded-lg flex items-center justify-center">
          {/* Logo placeholder - using a simple icon */}
          <CheckSquare className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-white text-3xl font-bold font-['Poppins']">TaskFlow</h2>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-colors cursor-pointer ${
                item.active 
                  ? 'bg-[#002a2e] text-[#f5532c]' 
                  : 'text-white hover:bg-[#033538]'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xl font-semibold font-['Inter']">{item.label}</span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}