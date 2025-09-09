import { BarChart3, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskFlowSidebar } from './TaskFlowSidebar';
import { StatsCards } from './StatsCards';
import { TaskOverview } from './TaskOverview';
import { RecentTasks } from './RecentTasks';

export function TaskFlowDashboard() {
  return (
    <div className="min-h-screen bg-[#002a2e] text-white">
      <div className="flex">
        <TaskFlowSidebar />
        <main className="flex-1 p-4 md:p-8 md:ml-[386px]">
          <div className="max-w-7xl mx-auto">
            {/* Page Title */}
            <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8">Dashboard</h1>
            
            {/* Stats Cards */}
            <StatsCards />
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 mt-6 md:mt-8">
              {/* Task Overview - Takes 2 columns */}
              <div className="xl:col-span-2">
                <TaskOverview />
              </div>
              
              {/* Recent Tasks - Takes 1 column */}
              <div className="xl:col-span-1">
                <RecentTasks />
              </div>
            </div>
            
            {/* Additional Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mt-6 md:mt-8">
              <Card className="bg-[#033538] border-white border-2 text-white">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl">Task Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 md:h-64 flex items-center justify-center text-gray-400">
                    <PieChart className="h-12 w-12 md:h-16 md:w-16" />
                    <span className="ml-4">Chart placeholder</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#033538] border-white border-2 text-white">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl">Tasks by Priority</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 md:h-64 flex items-center justify-center text-gray-400">
                    <BarChart3 className="h-12 w-12 md:h-16 md:w-16" />
                    <span className="ml-4">Chart placeholder</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#033538] border-white border-2 text-white">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl">Tasks by Assignee</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 md:h-64 flex items-center justify-center text-gray-400">
                    <BarChart3 className="h-12 w-12 md:h-16 md:w-16" />
                    <span className="ml-4">Chart placeholder</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#033538] border-white border-2 text-white">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl">Tasks Created by User</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 md:h-64 flex items-center justify-center text-gray-400">
                    <BarChart3 className="h-12 w-12 md:h-16 md:w-16" />
                    <span className="ml-4">Chart placeholder</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}