import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskFlow } from './TaskFlow';

// Mock the lucide-react icons
jest.mock('lucide-react', () => ({
  CheckCircle: () => <div data-testid="check-circle" />,
  Clock: () => <div data-testid="clock" />,
  Play: () => <div data-testid="play" />,
  Pause: () => <div data-testid="pause" />,
  AlertCircle: () => <div data-testid="alert-circle" />,
  GitBranch: () => <div data-testid="git-branch" />,
  Code: () => <div data-testid="code" />,
  FileText: () => <div data-testid="file-text" />,
  TestTube: () => <div data-testid="test-tube" />
}));

const mockTasks = [
  {
    id: 'task-1',
    title: 'Test Task 1',
    description: 'Test description 1',
    status: 'completed' as const,
    progress: 100,
    type: 'code' as const,
    estimatedTime: '5 min'
  },
  {
    id: 'task-2',
    title: 'Test Task 2',
    description: 'Test description 2',
    status: 'pending' as const,
    progress: 0,
    type: 'test' as const,
    dependencies: ['task-1'],
    estimatedTime: '10 min'
  }
];

describe('TaskFlow Component', () => {
  test('renders tasks correctly', () => {
    render(<TaskFlow tasks={mockTasks} />);
    
    expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    expect(screen.getByText('Test Task 2')).toBeInTheDocument();
    expect(screen.getByText('Test description 1')).toBeInTheDocument();
    expect(screen.getByText('Test description 2')).toBeInTheDocument();
  });

  test('displays correct task status', () => {
    render(<TaskFlow tasks={mockTasks} />);
    
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  test('shows overall progress correctly', () => {
    render(<TaskFlow tasks={mockTasks} />);
    
    expect(screen.getByText('🔄 TaskFlow')).toBeInTheDocument();
    expect(screen.getByText('(1/2 completed)')).toBeInTheDocument();
    expect(screen.getByText('50% Complete')).toBeInTheDocument();
  });

  test('displays task dependencies', () => {
    render(<TaskFlow tasks={mockTasks} />);
    
    expect(screen.getByText('Depends on: task-1')).toBeInTheDocument();
  });

  test('shows start button for pending tasks', () => {
    render(<TaskFlow tasks={mockTasks} />);
    
    const startButton = screen.getByRole('button', { name: /start/i });
    expect(startButton).toBeInTheDocument();
  });

  test('calls onTaskAction when button is clicked', () => {
    const mockOnTaskAction = jest.fn();
    render(<TaskFlow tasks={mockTasks} onTaskAction={mockOnTaskAction} />);
    
    const startButton = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startButton);
    
    expect(mockOnTaskAction).toHaveBeenCalledWith('task-2', 'start');
  });

  test('displays progress bar for running tasks', () => {
    const runningTasks = [
      {
        ...mockTasks[1],
        status: 'running' as const,
        progress: 45
      }
    ];
    
    render(<TaskFlow tasks={runningTasks} />);
    
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  test('shows estimated time for tasks', () => {
    render(<TaskFlow tasks={mockTasks} />);
    
    expect(screen.getByText('5 min')).toBeInTheDocument();
    expect(screen.getByText('10 min')).toBeInTheDocument();
  });
});