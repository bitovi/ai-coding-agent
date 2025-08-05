import type { Request, Response } from 'express';
import { getPromptActivity, type PromptActivityDeps } from './execution-history.js';

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
}));

describe('getPromptActivity', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockDeps: PromptActivityDeps;

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
        getPromptHistory: jest.fn()
      }
    };
  });

  it('should return activity data for existing prompt', () => {
    // Arrange
    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt description'
    };

    const mockExecutions = [
      { id: '1', status: 'completed', timestamp: '2023-01-01T00:00:00Z' },
      { id: '2', status: 'pending', timestamp: '2023-01-02T00:00:00Z' }
    ];

    mockDeps.promptManager.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService.getPromptHistory = jest.fn().mockReturnValue(mockExecutions);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.promptManager.getPrompt).toHaveBeenCalledWith('test-prompt');
    expect(mockDeps.executionHistoryService.getPromptHistory).toHaveBeenCalledWith('test-prompt', 50);
    expect(mockRes.json).toHaveBeenCalledWith({
      prompt: {
        name: 'test-prompt',
        description: 'Test prompt description'
      },
      executions: mockExecutions,
      pagination: {
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false
      }
    });
  });

  it('should handle pagination with limit and offset', () => {
    // Arrange
    mockReq.query = { limit: '20', offset: '10' };
    
    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt description'
    };

    const mockExecutions = Array.from({ length: 30 }, (_, i) => ({
      id: `${i + 1}`,
      status: 'completed',
      timestamp: `2023-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`
    }));

    mockDeps.promptManager.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService.getPromptHistory = jest.fn().mockReturnValue(mockExecutions);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.executionHistoryService.getPromptHistory).toHaveBeenCalledWith('test-prompt', 30);
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.executions).toHaveLength(20);
    expect(response.executions[0].id).toBe('11'); // offset 10, so starts at 11
    expect(response.pagination.total).toBe(30);
    expect(response.pagination.limit).toBe(20);
    expect(response.pagination.offset).toBe(10);
    expect(response.pagination.hasMore).toBe(false);
  });

  it('should return 404 for non-existent prompt', () => {
    // Arrange
    mockDeps.promptManager.getPrompt = jest.fn().mockReturnValue(null);

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

  it('should handle empty execution history', () => {
    // Arrange
    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt description'
    };

    mockDeps.promptManager.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService.getPromptHistory = jest.fn().mockReturnValue([]);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      prompt: {
        name: 'test-prompt',
        description: 'Test prompt description'
      },
      executions: [],
      pagination: {
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false
      }
    });
  });

  it('should handle null execution history', () => {
    // Arrange
    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt description'
    };

    mockDeps.promptManager.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService.getPromptHistory = jest.fn().mockReturnValue(null);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      prompt: {
        name: 'test-prompt',
        description: 'Test prompt description'
      },
      executions: [],
      pagination: {
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false
      }
    });
  });

  it('should use default values for limit and offset when not provided', () => {
    // Arrange
    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt description'
    };

    mockDeps.promptManager.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService.getPromptHistory = jest.fn().mockReturnValue([]);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockDeps.executionHistoryService.getPromptHistory).toHaveBeenCalledWith('test-prompt', 50);
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.pagination.limit).toBe(50);
    expect(response.pagination.offset).toBe(0);
  });

  it('should call handleError when an exception occurs', () => {
    // Arrange
    const commonModule = require('./common.js');
    mockDeps.promptManager.getPrompt = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(commonModule.handleError).toHaveBeenCalledWith(mockRes, expect.any(Error));
  });

  it('should handle pagination correctly with hasMore flag', () => {
    // Arrange
    mockReq.query = { limit: '10', offset: '5' };
    
    const mockPrompt = {
      name: 'test-prompt',
      description: 'Test prompt description'
    };

    const mockExecutions = Array.from({ length: 20 }, (_, i) => ({
      id: `${i + 1}`,
      status: 'completed'
    }));

    mockDeps.promptManager.getPrompt = jest.fn().mockReturnValue(mockPrompt);
    mockDeps.executionHistoryService.getPromptHistory = jest.fn().mockReturnValue(mockExecutions);

    // Act
    getPromptActivity(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.executions).toHaveLength(10);
    expect(response.pagination.hasMore).toBe(true); // 5 + 10 < 20
  });
});
