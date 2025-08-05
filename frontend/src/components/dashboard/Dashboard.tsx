import { Layout } from '@/components/layout/Layout';
import { PromptsList } from '@/components/prompts/PromptsList';
import { ConnectionsList } from '@/components/connections/ConnectionsList';
import { useAuth } from '@/hooks/useAuth';

export function Dashboard() {
  const { data: user } = useAuth();

  return (
    <Layout user={user}>
      <div className="space-y-8">
        <PromptsList />
        <ConnectionsList />
      </div>
    </Layout>
  );
}
