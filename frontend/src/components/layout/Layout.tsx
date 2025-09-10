import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useLogout } from '@/hooks/useAuth';
import { User, LogOut, Home, Workflow } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

interface HeaderProps {
  user?: { email: string } | null;
}

export function Header({ user }: HeaderProps) {
  const logout = useLogout();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <CardTitle className="text-4xl font-bold text-blue-600 mb-2">
              🤖 AI Coding Agent
            </CardTitle>
            <p className="text-lg text-muted-foreground">
              Claude Code with MCP Service Integration
            </p>
          </div>
          
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          )}
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
          <Link to="/">
            <Button 
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link to="/taskflow">
            <Button 
              variant={isActive('/taskflow') ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center gap-2"
            >
              <Workflow className="h-4 w-4" />
              TaskFlow
            </Button>
          </Link>
        </div>
      </CardHeader>
    </Card>
  );
}

interface LayoutProps {
  children: ReactNode;
  user?: { email: string } | null;
}

export function Layout({ children, user }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Header user={user} />
        {children}
      </div>
    </div>
  );
}
