import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { webClientServices, type ConnectionTestResult, type ConfigValidationResult } from '@/services/api';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, XCircle, RotateCcw, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface TestSectionProps {
  title: string;
  children: React.ReactNode;
}

function TestSection({ title, children }: TestSectionProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </Card>
  );
}

interface TestResultItemProps {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

function TestResultItem({ name, status, message, details }: TestResultItemProps) {
  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />
  };

  const bgColorMap = {
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200', 
    error: 'bg-red-50 border-red-200'
  };

  return (
    <div className={`border rounded-lg p-3 ${bgColorMap[status]}`}>
      <div className="flex items-start gap-3">
        {iconMap[status]}
        <div className="flex-1">
          <div className="font-medium">{name}</div>
          <div className="text-sm text-gray-600">{message}</div>
          {details && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Show details
              </summary>
              <pre className="text-xs mt-1 text-gray-600 whitespace-pre-wrap">
                {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionTestResults({ connections }: { connections: ConnectionTestResult[] }) {
  return (
    <div className="space-y-2">
      {connections.map((connection) => (
        <TestResultItem
          key={connection.connectionName}
          name={connection.connectionName}
          status={connection.success ? 'success' : 'error'}
          message={connection.message}
          details={connection.details}
        />
      ))}
    </div>
  );
}

function ConfigValidationResults({ validation }: { validation: ConfigValidationResult[] }) {
  return (
    <div className="space-y-4">
      {validation.map((category) => (
        <div key={category.category}>
          <h4 className="font-medium mb-2">{category.category}</h4>
          <div className="space-y-2">
            {category.items.map((item) => (
              <TestResultItem
                key={item.name}
                name={item.name}
                status={item.status}
                message={item.message}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TestsDashboard() {
  const { data: user } = useAuth();
  const [isRunningTests, setIsRunningTests] = useState(false);

  const {
    data: systemTests,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['systemTests'],
    queryFn: webClientServices.getSystemTests,
    staleTime: 30000, // 30 seconds
  });

  const runTests = async () => {
    setIsRunningTests(true);
    try {
      await refetch();
    } finally {
      setIsRunningTests(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 animate-spin" />
            <span>Running system tests...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-5 h-5" />
            <span>Failed to load test results</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <Button onClick={runTests} className="mt-4" variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </Card>
      );
    }

    const overall = systemTests?.overall;
    const connections = systemTests?.connections || [];
    const configuration = systemTests?.configuration || [];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">🧪 System Tests</h2>
            <p className="text-gray-600">Test your AI Coding Agent configuration and connections</p>
          </div>
          <Button 
            onClick={runTests} 
            disabled={isRunningTests}
            className="flex items-center gap-2"
          >
            {isRunningTests ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunningTests ? 'Running Tests...' : 'Run Tests'}
          </Button>
        </div>

        {/* Overall Status */}
        {overall && (
          <Card className="p-6">
            <div className="flex items-center gap-3">
              {overall.success ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
              <div>
                <h3 className="font-semibold text-lg">Overall System Status</h3>
                <p className="text-gray-600">{overall.message}</p>
                {overall.details && (
                  <div className="text-sm text-gray-500 mt-1">
                    {overall.details.passed}/{overall.details.totalTests} tests passed
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Connection Tests */}
        <TestSection title="🔗 Connection Tests">
          {connections.length > 0 ? (
            <ConnectionTestResults connections={connections} />
          ) : (
            <p className="text-gray-500">No connections to test</p>
          )}
        </TestSection>

        {/* Configuration Validation */}
        <TestSection title="⚙️ Configuration Validation">
          {configuration.length > 0 ? (
            <ConfigValidationResults validation={configuration} />
          ) : (
            <p className="text-gray-500">No configuration to validate</p>
          )}
        </TestSection>

        {/* Test Information */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">About System Tests</h4>
              <p className="text-sm text-blue-700 mt-1">
                These tests help ensure your AI Coding Agent is properly configured and all connections are working.
                Run tests regularly to catch issues early and ensure optimal performance.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <Layout user={user}>
      {renderContent()}
    </Layout>
  );
}