import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webClientServices } from '@/services/api';

// Dashboard data
export const useDashboardData = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: webClientServices.getDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Prompts
export const usePrompts = () => {
  return useQuery({
    queryKey: ['prompts'],
    queryFn: webClientServices.getPrompts,
    staleTime: 5 * 60 * 1000,
  });
};

export const usePrompt = (name: string) => {
  return useQuery({
    queryKey: ['prompts', name],
    queryFn: () => webClientServices.getPrompt(name),
    enabled: !!name,
  });
};

export const usePromptHistory = (promptName: string, limit = 20) => {
  return useQuery({
    queryKey: ['prompts', promptName, 'history'],
    queryFn: () => webClientServices.getPromptHistory(promptName, limit),
    enabled: !!promptName,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

// MCP Servers and Connections
export const useMCPServers = () => {
  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: webClientServices.getMCPServers,
    staleTime: 5 * 60 * 1000,
  });
};

export const useConnectionStatuses = () => {
  return useQuery({
    queryKey: ['connections'],
    queryFn: webClientServices.getConnectionStatuses,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

// Mutations
export const useRunPrompt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ name, parameters }: { name: string; parameters: any }) =>
      webClientServices.runPrompt(name, parameters),
    onSuccess: (_, variables) => {
      // Invalidate prompt history to refetch after execution
      queryClient.invalidateQueries({ 
        queryKey: ['prompts', variables.name, 'history'] 
      });
    },
  });
};

export const usePreviewPrompt = () => {
  return useMutation({
    mutationFn: ({ name, parameters }: { name: string; parameters: any }) =>
      webClientServices.previewPrompt(name, parameters),
  });
};

export const useAuthorizeService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (serviceName: string) =>
      webClientServices.authorizeService(serviceName),
    onSuccess: () => {
      // Invalidate connections to refetch status
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: webClientServices.logout,
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
      window.location.href = '/login';
    },
  });
};

export const useAuthorizeMcp = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (serverName: string) =>
      webClientServices.authorizeMcpServer(serverName),
    onSuccess: () => {
      // Invalidate connections to refetch status
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
};

export const useSetupCredentials = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ type, credentials }: { type: string; credentials: any }) =>
      webClientServices.setupCredentials(type, credentials),
    onSuccess: () => {
      // Invalidate connections to refetch status
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
};
