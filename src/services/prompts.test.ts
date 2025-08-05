import type { Request, Response } from 'express';
import { getPrompts, type GetPromptsDeps } from './prompts.js';

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
  checkConnectionAvailability: jest.fn(),
  getConnectionDescription: jest.fn(),
  getConnectionMethod: jest.fn(),
}));

// Mock the prompt utils
jest.mock('../../public/js/prompt-utils.js', () => ({
  mergeParametersWithDefaults: jest.fn(),
  processPrompt: jest.fn(),
}));

// Mock the auth utils
jest.mock('../auth/authUtils.js', () => ({
  isServerAuthorized: jest.fn(),
}));

describe('getPrompts', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockDeps: GetPromptsDeps;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request
    mockReq = {
      params: {},
      body: {},
      headers: {},
      query: {}
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
        getPrompts: jest.fn()
      },
      configManager: {
        getMcpServers: jest.fn()
      },
      authManager: {
        isAuthorized: jest.fn()
      }
    };
  });

  it('should return empty prompts array when no prompts exist', () => {
    // Arrange
    mockDeps.promptManager.getPrompts = jest.fn().mockReturnValue([]);
    mockDeps.configManager.getMcpServers = jest.fn().mockReturnValue([]);

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      prompts: []
    });
  });

  it('should return prompts with basic information when no connections required', () => {
    // Arrange
    const mockPrompts = [
      {
        name: 'simple-prompt',
        description: 'A simple prompt without connections',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        parameters: {}
      }
    ];

    mockDeps.promptManager.getPrompts = jest.fn().mockReturnValue(mockPrompts);
    mockDeps.configManager.getMcpServers = jest.fn().mockReturnValue([]);

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      prompts: [
        {
          name: 'simple-prompt',
          description: 'A simple prompt without connections',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          parameters: {},
          canRun: true,
          connections: []
        }
      ]
    });
  });

  it('should call handleError when an exception occurs', () => {
    // Arrange
    const commonModule = require('./common.js');
    mockDeps.promptManager.getPrompts = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });

    // Act
    getPrompts(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(commonModule.handleError).toHaveBeenCalledWith(mockRes, expect.any(Error));
  });
});