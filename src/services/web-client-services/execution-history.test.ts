import type { Request, Response } from 'express';
import { getPromptActivity } from './execution-history.js';
import type { Dependencies } from './common.js';

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
}));

describe('getPromptActivity', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockDeps: Dependencies;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request
    mockReq = {
      params: { promptName: 'test-prompt' },
      query: {},
      body: {},
      headers: {}
    };

    // Mock response
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn()
    };

    // Mock dependencies
    mockDeps = {
      promptManager: {
        getPrompt: jest.fn()
      },
      executionHistoryService: {
        getExecutionsForPrompt: jest.fn(),
        getPendingExecutions: jest.fn(),
        getTotalExecutions: jest.fn()
      }
    };
  });

  it('should return prompt activity with default pagination', () => {
    // Arrange
    const mockPrompt = {
      name: 'test-prompt',
      description: 'A test prompt for activity tracking'
    };

    const mockExecutions = [
      {
        id: 'exec_1',
        timestamp: '2024-01-15T10:30:00Z',
        userEmail: 'user@example.com',
        status: 'completed',
        duration: 5200,
        parameters: { param1: 'value1' },
        output: 'Execution completed successfully'
      },
      {
        id: 'exec_2',
        timestamp: '2024-01-15T09:15:00Z',
        userEmail: 'admin@example.com',
        status: 'failed',
        duration: 2100,
        parameters: { param1: 'value2' },
        output: 'Execution failed with error'
      }
    ];

    const mockPendingExecutions = [
      {
        id: 'pending_1',
        timestamp: '2024-01-15T11:00:00Z',
        parameters: { param1: 'value3' },
        waitingFor: ['jira'],
        reason: 'MCP servers need authorization'
      }
    ];

    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService!.getExecutionsForPrompt = jest.fn().mockReturnValue(mockExecutions);
    mockDeps.executionHistoryService!.getPendingExecutions = jest.fn().mockReturnValue(mockPendingExecutions);
    mockDeps.executionHistoryService!.getTotalExecutions = jest.fn().mockReturnValue(25);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        prompt: {
          name: 'test-prompt',
          description: 'A test prompt for activity tracking'
        },
        executions: mockExecutions,
        pendingExecutions: mockPendingExecutions,
        pagination: {
          total: 25,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      },
      timestamp: expect.any(String)
    });

    expect(mockDeps.executionHistoryService!.getExecutionsForPrompt).toHaveBeenCalledWith('test-prompt', { limit: 50, offset: 0 });
    expect(mockDeps.executionHistoryService!.getPendingExecutions).toHaveBeenCalledWith('test-prompt');
    expect(mockDeps.executionHistoryService!.getTotalExecutions).toHaveBeenCalledWith('test-prompt');
  });

  it('should handle custom pagination parameters', () => {
    // Arrange
    mockReq.query = {
      limit: '20',
      offset: '10'
    };

    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt with custom pagination'
    };

    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService!.getExecutionsForPrompt = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getPendingExecutions = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getTotalExecutions = jest.fn().mockReturnValue(100);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.executionHistoryService!.getExecutionsForPrompt).toHaveBeenCalledWith('test-prompt', { limit: 20, offset: 10 });
    
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.pagination).toEqual({
      total: 100,
      limit: 20,
      offset: 10,
      hasMore: true
    });
  });

  it('should return 404 when prompt does not exist', () => {
    // Arrange
    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(null);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: "Prompt 'test-prompt' does not exist",
      timestamp: expect.any(String)
    });
  });

  it('should return 404 when prompt is undefined', () => {
    // Arrange
    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(undefined);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: "Prompt 'test-prompt' does not exist",
      timestamp: expect.any(String)
    });
  });

  it('should handle missing execution history service gracefully', () => {
    // Arrange
    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt without history service'
    };

    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService = undefined;

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.executions).toEqual([]);
    expect(response.data.pendingExecutions).toEqual([]);
    expect(response.data.pagination.total).toBe(0);
  });

  it('should handle missing prompt manager gracefully', () => {
    // Arrange
    mockDeps.promptManager = undefined;

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: "Prompt 'test-prompt' does not exist",
      timestamp: expect.any(String)
    });
  });

  it('should handle invalid pagination parameters', () => {
    // Arrange
    mockReq.query = {
      limit: 'invalid',
      offset: 'also-invalid'
    };

    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt with invalid pagination'
    };

    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService!.getExecutionsForPrompt = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getPendingExecutions = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getTotalExecutions = jest.fn().mockReturnValue(0);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.executionHistoryService!.getExecutionsForPrompt).toHaveBeenCalledWith('test-prompt', { limit: 50, offset: 0 });
    
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.pagination).toEqual({
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false
    });
  });

  it('should calculate hasMore correctly', () => {
    // Arrange
    mockReq.query = {
      limit: '10',
      offset: '20'
    };

    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt for hasMore calculation'
    };

    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService!.getExecutionsForPrompt = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getPendingExecutions = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getTotalExecutions = jest.fn().mockReturnValue(35);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.pagination).toEqual({
      total: 35,
      limit: 10,
      offset: 20,
      hasMore: true // 20 + 10 = 30 < 35
    });
  });

  it('should handle edge case where total equals offset + limit', () => {
    // Arrange
    mockReq.query = {
      limit: '10',
      offset: '20'
    };

    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt for edge case'
    };

    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService!.getExecutionsForPrompt = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getPendingExecutions = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getTotalExecutions = jest.fn().mockReturnValue(30);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.pagination.hasMore).toBe(false); // 20 + 10 = 30, so no more
  });

  it('should call handleError when an exception occurs', () => {
    // Arrange
    const commonModule = require('./common.js');
    const error = new Error('Test error');
    
    mockDeps.promptManager!.getPrompt = jest.fn().mockImplementation(() => {
      throw error;
    });

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(commonModule.handleError).toHaveBeenCalledWith(mockRes, error);
  });

  it('should handle execution history service methods that don\'t exist', () => {
    // Arrange
    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt with incomplete history service'
    };

    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService = {
      // Missing some expected methods
    };

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data.executions).toEqual([]);
    expect(response.data.pendingExecutions).toEqual([]);
    expect(response.data.pagination.total).toBe(0);
  });

  it('should preserve prompt name from request params', () => {
    // Arrange
    mockReq.params = { promptName: 'my-special-prompt' };

    const mockPrompt = {
      name: 'my-special-prompt',
      description: 'A special test prompt'
    };

    mockDeps.promptManager!.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService!.getExecutionsForPrompt = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getPendingExecutions = jest.fn().mockReturnValue([]);
    mockDeps.executionHistoryService!.getTotalExecutions = jest.fn().mockReturnValue(0);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.promptManager!.getPrompt).toHaveBeenCalledWith('my-special-prompt');
    expect(mockDeps.executionHistoryService!.getExecutionsForPrompt).toHaveBeenCalledWith('my-special-prompt', { limit: 50, offset: 0 });
    expect(mockDeps.executionHistoryService!.getPendingExecutions).toHaveBeenCalledWith('my-special-prompt');
    expect(mockDeps.executionHistoryService!.getTotalExecutions).toHaveBeenCalledWith('my-special-prompt');
  });
});
