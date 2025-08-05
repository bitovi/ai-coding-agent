import { useState } from 'react';
import { useRequestLogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Login() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const requestLogin = useRequestLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const result = await requestLogin(email);
      setMessage({ type: 'success', text: result.message });
      setEmail(''); // Clear the form
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to send login link' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl mb-4">🤖</h1>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            AI Coding Agent
          </h2>
          <p className="text-gray-600">
            Secure passwordless login
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex">
              <span className="mr-2">
                {message.type === 'success' ? '✅' : '❌'}
              </span>
              <span>{message.text}</span>
            </div>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending...
              </>
            ) : (
              <>
                🔗 Send Magic Link
              </>
            )}
          </Button>
        </form>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            🔐 How it works:
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Enter your email address above</li>
            <li>• We'll send you a secure login link</li>
            <li>• Click the link to access your dashboard</li>
            <li>• No passwords required!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
