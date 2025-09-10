export function TaskOverviewChart() {
  return (
    <div className="bg-[#033538] rounded-lg p-6 border-2 border-white h-[721px]">
      <h2 className="text-white text-4xl font-bold mb-6 font-['Poppins']">Task Overview</h2>
      
      {/* Chart Container */}
      <div className="bg-[#033538] rounded-lg h-[568px] relative overflow-hidden mt-20">
        {/* Simple Bar Chart Representation */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="flex items-end justify-center gap-8 h-80">
            {/* Completed Tasks Bar (Orange) */}
            <div className="flex flex-col items-center">
              <div className="bg-orange-500 w-32 h-48 rounded-t-lg mb-2"></div>
              <span className="text-gray-400 text-sm">2025-08</span>
            </div>
            
            {/* Total Tasks Bar (Teal) */}
            <div className="flex flex-col items-center">
              <div className="bg-teal-500 w-32 h-32 rounded-t-lg mb-2"></div>
              <span className="text-gray-400 text-sm">Total Tasks</span>
            </div>
          </div>
          
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-gray-400 text-sm py-4">
            <span>32</span>
            <span>24</span>
            <span>16</span>
            <span>8</span>
            <span>0</span>
          </div>
          
          {/* Legend */}
          <div className="absolute bottom-0 left-8 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-teal-500 rounded"></div>
              <span className="text-gray-400">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-gray-400">Total Tasks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}