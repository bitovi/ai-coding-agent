import { useQuery } from '@tanstack/react-query';

export interface User {
  email: string;
}

export interface AuthResponse {
  success: boolean;
  data: User;
  timestamp: string;
}

// Hook to get current user
export const useAuth = () => {
  return useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async (): Promise<User | null> => {
      try {
        // Add a small delay on initial load to ensure cookies are set
        const isInitialLoad = !document.cookie.includes('ai-coding-agent-session');
        if (isInitialLoad && window.location.search.includes('success=login')) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        const response = await fetch('/api/user', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        console.log('🔍 Auth response status:', response.status);
        
        if (response.status === 401) {
          // Not authenticated - this is expected for unauthenticated users
          return null;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data: AuthResponse = await response.json();
        return data.data;
      } catch (error) {
        console.error('Auth check failed:', error);
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Force a refetch when coming back from login
    refetchOnMount: window.location.search.includes('success=login') ? 'always' : true,
  });
};

// Hook for login request
export const useRequestLogin = () => {
  return async (email: string) => {
    const response = await fetch('/auth/request-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to send login link');
    }
    
    return result;
  };
};

// Hook for logout
export const useLogout = () => {
  return async () => {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    if (response.ok) {
      // Redirect to login page
      window.location.href = '/login';
    }
  };
};
