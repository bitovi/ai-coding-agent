import type { Request, Response } from 'express';
import type { User } from '../../types/index.js';
import { getUserInfo } from './user.js';
import type { Dependencies } from './common.js';

// Mock the common module
jest.mock('./common.js', () => ({
  handleError: jest.fn(),
  isBrowserRequest: jest.fn(),
}));

describe('getUserInfo', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockDeps: Dependencies;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request
    mockReq = {
      params: {},
      body: {},
      headers: {},
      user: undefined,
      xhr: false
    };

    // Mock response
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn()
    };

    // Mock dependencies (getUserInfo doesn't use any deps, but keeping for consistency)
    mockDeps = {};
  });

  it('should return user information when user is authenticated', () => {
    // Arrange
    const mockUser = {
      email: 'test@example.com',
      sessionId: 'session_123',
      isAuthenticated: true
    };
    
    mockReq.user = mockUser;

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: mockUser,
      timestamp: expect.any(String)
    });
  });

  it('should redirect to login for browser requests when user is not authenticated', () => {
    // Arrange
    const commonModule = require('./common.js');
    mockReq.user = undefined;
    commonModule.isBrowserRequest.mockReturnValue(true);

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.redirect).toHaveBeenCalledWith('/login');
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(commonModule.isBrowserRequest).toHaveBeenCalledWith(mockReq);
  });

  it('should return 401 JSON response for API requests when user is not authenticated', () => {
    // Arrange
    const commonModule = require('./common.js');
    mockReq.user = undefined;
    commonModule.isBrowserRequest.mockReturnValue(false);

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Login required',
      loginUrl: '/login'
    });
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('should handle null user object', () => {
    // Arrange
    const commonModule = require('./common.js');
    mockReq.user = null;
    commonModule.isBrowserRequest.mockReturnValue(false);

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Login required',
      loginUrl: '/login'
    });
  });

  it('should handle user object with minimal properties', () => {
    // Arrange
    const minimalUser = {
      email: 'minimal@example.com'
    };
    
    (mockReq as any).user = minimalUser;

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: minimalUser,
      timestamp: expect.any(String)
    });
  });

  it('should handle user object with extra properties', () => {
    // Arrange
    const detailedUser = {
      email: 'detailed@example.com',
      sessionId: 'session_456',
      isAuthenticated: true,
      name: 'John Doe',
      role: 'admin',
      lastLogin: '2024-01-15T10:30:00Z'
    };
    
    mockReq.user = detailedUser;

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: detailedUser,
      timestamp: expect.any(String)
    });
  });

  it('should call handleError when an exception occurs', () => {
    // Arrange
    const commonModule = require('./common.js');
    const error = new Error('Test error');
    
    // Mock a scenario where accessing req.user throws an error
    Object.defineProperty(mockReq, 'user', {
      get() {
        throw error;
      }
    });

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    expect(commonModule.handleError).toHaveBeenCalledWith(mockRes, error);
  });

  it('should include timestamp in response', () => {
    // Arrange
    const mockUser = {
      email: 'timestamp@example.com',
      sessionId: 'session_789',
      isAuthenticated: true
    };
    
    mockReq.user = mockUser;
    const beforeCall = new Date().toISOString();

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.timestamp).toEqual(expect.any(String));
    
    // Verify timestamp is a valid ISO string and recent
    const timestamp = new Date(response.timestamp);
    const afterCall = new Date();
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date(beforeCall).getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });

  it('should preserve all user data without modification', () => {
    // Arrange
    const originalUser = {
      email: 'preserve@example.com',
      sessionId: 'session_preserve',
      isAuthenticated: true,
      metadata: {
        nested: {
          property: 'value'
        },
        array: [1, 2, 3]
      }
    };
    
    mockReq.user = originalUser;

    // Act
    getUserInfo(mockDeps)(mockReq as Request, mockRes as Response);

    // Assert
    const response = (mockRes.json as jest.Mock).mock.calls[0][0];
    expect(response.data).toEqual(originalUser);
    expect(response.data).toBe(originalUser); // Should be the same reference for efficiency
  });
});
