interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="bg-[#033538] rounded-lg p-6 border-2 border-white">
      <h3 className="text-white text-2xl font-semibold mb-6 font-['Inter']">{title}</h3>
      {children}
    </div>
  );
}

function TaskStatusDistribution() {
  return (
    <div className="h-80 flex items-center justify-center">
      {/* Simple pie chart representation */}
      <div className="relative w-48 h-48">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 via-teal-500 to-cyan-300">
        </div>
        <div className="absolute inset-4 rounded-full bg-[#033538]"></div>
        
        {/* Labels */}
        <div className="absolute -right-20 top-8 text-[#b9bfcc] text-sm">
          <div>todo: 13 (43%)</div>
        </div>
        <div className="absolute -left-20 top-20 text-[#b9bfcc] text-sm">
          <div>review: 7 (23%)</div>
        </div>
        <div className="absolute -bottom-12 -left-8 text-[#b9bfcc] text-sm">
          <div>net: 6 (20%)</div>
        </div>
        <div className="absolute -bottom-12 -right-8 text-orange-500 text-sm">
          <div>in_progress:</div>
        </div>
      </div>
    </div>
  );
}

function TasksByPriority() {
  return (
    <div className="h-80 flex items-end justify-center gap-4 p-4">
      {/* Y-axis */}
      <div className="flex flex-col justify-between h-full text-[#b9bfcc] text-xs mr-4">
        <span>16</span>
        <span>12</span>
        <span>8</span>
        <span>4</span>
        <span>0</span>
      </div>
      
      {/* Bars */}
      <div className="flex items-end gap-4 h-full">
        <div className="flex flex-col items-center">
          <div className="bg-cyan-400 w-12 h-32 rounded-t"></div>
          <span className="text-[#b9bfcc] text-xs mt-2">medium</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="bg-cyan-400 w-12 h-24 rounded-t"></div>
          <span className="text-[#b9bfcc] text-xs mt-2">high</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="bg-cyan-400 w-12 h-20 rounded-t"></div>
          <span className="text-[#b9bfcc] text-xs mt-2">low</span>
        </div>
      </div>
    </div>
  );
}

function TasksByAssignee() {
  return (
    <div className="h-80 flex items-end justify-center gap-2 p-4">
      {/* Y-axis */}
      <div className="flex flex-col justify-between h-full text-[#b9bfcc] text-xs mr-4">
        <span>8</span>
        <span>6</span>
        <span>4</span>
        <span>2</span>
        <span>0</span>
      </div>
      
      {/* Bars */}
      <div className="flex items-end gap-2 h-full">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col items-center">
            <div 
              className="bg-cyan-400 w-8 rounded-t" 
              style={{ height: `${Math.random() * 120 + 20}px` }}
            ></div>
            <span className="text-[#b9bfcc] text-xs mt-2 transform -rotate-45 origin-bottom-left">
              User {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksCreatedByUser() {
  return (
    <div className="h-80 flex items-end justify-center gap-2 p-4">
      {/* Y-axis */}
      <div className="flex flex-col justify-between h-full text-[#b9bfcc] text-xs mr-4">
        <span>8</span>
        <span>6</span>
        <span>4</span>
        <span>2</span>
        <span>0</span>
      </div>
      
      {/* Bars */}
      <div className="flex items-end gap-2 h-full">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col items-center">
            <div 
              className="bg-orange-500 w-8 rounded-t" 
              style={{ height: `${Math.random() * 100 + 30}px` }}
            ></div>
            <span className="text-[#b9bfcc] text-xs mt-2 transform -rotate-45 origin-bottom-left">
              User {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <ChartCard title="Task Status Distribution">
        <TaskStatusDistribution />
      </ChartCard>
      
      <ChartCard title="Tasks by Priority">
        <TasksByPriority />
      </ChartCard>
      
      <ChartCard title="Tasks by Assignee">
        <TasksByAssignee />
      </ChartCard>
      
      <ChartCard title="Tasks Created by User">
        <TasksCreatedByUser />
      </ChartCard>
    </div>
  );
}