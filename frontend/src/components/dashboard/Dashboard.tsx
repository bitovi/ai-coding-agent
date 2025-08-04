import { Layout } from '@/components/layout/Layout';
import { PromptsList } from '@/components/prompts/PromptsList';
import { ConnectionsList } from '@/components/connections/ConnectionsList';
import { useDashboardData } from '@/hooks/api';

export function Dashboard() {
  const { data: dashboardData } = useDashboardData();

  return (
    <Layout user={dashboardData?.user}>
      <div className="space-y-8">
        <PromptsList />
        <ConnectionsList />
      </div>
    </Layout>
  );
}
