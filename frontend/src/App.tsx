import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { PromptActivity } from '@/components/prompts/PromptActivity';
import { Login } from '@/components/auth/Login';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { TaskFlowDemo } from '@/components/taskflow/TaskFlowDemo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/demo" element={<TaskFlowDemo />} />
          <Route 
            path="/" 
            element={
              <AuthGuard fallback={<Login />}>
                <Dashboard />
              </AuthGuard>
            } 
          />
          <Route 
            path="/prompts/:promptName/activity" 
            element={
              <AuthGuard fallback={<Login />}>
                <PromptActivity />
              </AuthGuard>
            } 
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
