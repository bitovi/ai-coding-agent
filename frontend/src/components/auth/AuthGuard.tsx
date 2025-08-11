import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { data: user, isLoading, error, refetch } = useAuth();

  // If we just came back from login, wait a moment and refetch
  // It seemed we had to wait for the cookie to be set
  useEffect(() => {
    if (window.location.search.includes('success=login')) {
      // Clear the URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
      
      // Refetch auth status after a brief delay
      setTimeout(() => {
        refetch();
      }, 200);
    }
  }, [refetch]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If there's an error or no user, redirect to login
  if (error || !user) {
    console.log('🔍 AuthGuard: No user or error, showing fallback/redirect');
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // Redirect to login page
    window.location.href = '/login';
    return null;
  }

  console.log('🔍 AuthGuard: User authenticated, rendering protected content');
  // User is authenticated, render the protected content
  return <>{children}</>;
}
