import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { data: user, isLoading, error } = useAuth();

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
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // Redirect to login page
    window.location.href = '/login';
    return null;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
