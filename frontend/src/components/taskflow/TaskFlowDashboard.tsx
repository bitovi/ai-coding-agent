import { TaskFlowSidebar } from './TaskFlowSidebar';
import { StatsCards } from './StatsCards';
import { TaskOverviewChart } from './TaskOverviewChart';
import { RecentTasks } from './RecentTasks';
import { ChartGrid } from './ChartGrid';

export function TaskFlowDashboard() {
  return (
    <div className="bg-[#002a2e] min-h-screen flex">
      {/* Sidebar */}
      <TaskFlowSidebar />
      
      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Dashboard Title */}
        <h1 className="text-white text-6xl font-bold mb-8 font-['Poppins']">
          Dashboard
        </h1>
        
        {/* Stats Cards */}
        <StatsCards />
        
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Task Overview Chart - spans 2 columns */}
          <div className="lg:col-span-2">
            <TaskOverviewChart />
          </div>
          
          {/* Recent Tasks */}
          <div className="lg:col-span-1">
            <RecentTasks />
          </div>
        </div>
        
        {/* Bottom Charts Grid */}
        <ChartGrid />
      </div>
    </div>
  );
}