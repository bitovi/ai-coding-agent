import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export function TaskOverview() {
  return (
    <Card className="bg-[#033538] border-white border-2 text-white">
      <CardHeader>
        <CardTitle className="text-2xl md:text-4xl font-bold">Task Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 md:h-96 flex flex-col items-center justify-center space-y-4">
          {/* Chart Placeholder */}
          <div className="w-full h-48 md:h-64 bg-[#072427] rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 text-sm md:text-lg">Chart showing task completion over time</p>
              <p className="text-gray-500 text-xs md:text-sm mt-2">
                This would display a bar chart comparing completed vs total tasks
              </p>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center space-x-4 md:space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-orange-500 rounded"></div>
              <span className="text-xs md:text-sm text-[#abb4c0]">Total Tasks</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-teal-500 rounded"></div>
              <span className="text-xs md:text-sm text-[#abb4c0]">Completed</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}