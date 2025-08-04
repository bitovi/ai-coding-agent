import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { PromptActivity } from '@/components/prompts/PromptActivity';

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/prompts/:promptName/activity" element={<PromptActivity />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
