import { describe, it, expect, vi } from 'vitest';
import { AiAgentService } from './aiAgentService';

// Mock the dependencies
vi.mock('./toolRegistry', () => ({
  toolRegistry: {
    getOpenAISpecs: vi.fn(() => []),
    get: vi.fn(() => null),
    execute: vi.fn(() => Promise.resolve({ result: 'test' })),
  },
}));

vi.mock('./securityGuard', () => ({
  securityGuard: {
    requiresConfirm: vi.fn(() => false),
    getStats: vi.fn(() => ({ maxCallsPerMinute: 10, maxCallsPerSession: 100, requireConfirmForLevels: [], auditEnabled: true })),
  },
}));

describe('AiAgentService', () => {
  const DEFAULT_MAX_ROUNDS = 5;

  let aiAgentService: AiAgentService;

  beforeEach(() => {
    aiAgentService = new AiAgentService();
  });

  describe('Progress Tracking', () => {
    it('should call progress callback when starting AI response', async () => {
      const progressCallback = vi.fn();
      aiAgentService.setProgressCallback(progressCallback);

      // Mock the LLM call to return a simple response
      const originalCallLLM = aiAgentService['callLLM'];
      aiAgentService['callLLM'] = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await aiAgentService.processMessage('Test message');

      expect(progressCallback).toHaveBeenCalledWith({
        round: 0,
        totalRounds: aiAgentService.getConfig().maxRounds,
        status: 'thinking',
        message: 'Starting AI response...',
      });
    });

    it('should call progress callback for each round', async () => {
      const progressCallback = vi.fn();
      aiAgentService.setProgressCallback(progressCallback);

      // Mock the LLM call to return a simple response
      const originalCallLLM = aiAgentService['callLLM'];
      aiAgentService['callLLM'] = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await aiAgentService.processMessage('Test message');

      expect(progressCallback).toHaveBeenCalledWith({
        round: 0,
        totalRounds: aiAgentService.getConfig().maxRounds,
        status: 'thinking',
        message: 'Round 1 of 5',
      });
    });

    it('should call progress callback when executing a tool', async () => {
      const progressCallback = vi.fn();
      aiAgentService.setProgressCallback(progressCallback);

      // Mock the LLM call to return a tool call
      const originalCallLLM = aiAgentService['callLLM'];
      aiAgentService['callLLM'] = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Using tool', tool_calls: [{
            id: 'test-id',
            function: { name: 'testTool', arguments: '{}' },
          }] },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await aiAgentService.processMessage('Test message');

      expect(progressCallback).toHaveBeenCalledWith({
        round: 0,
        totalRounds: aiAgentService.getConfig().maxRounds,
        toolName: 'testTool',
        toolArgs: {},
        status: 'executing',
        message: 'Executing tool: testTool',
      });
    });

    it('should call progress callback when tool completes', async () => {
      const progressCallback = vi.fn();
      aiAgentService.setProgressCallback(progressCallback);

      // Mock the LLM call to return a tool call
      const originalCallLLM = aiAgentService['callLLM'];
      aiAgentService['callLLM'] = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Using tool', tool_calls: [{
            id: 'test-id',
            function: { name: 'testTool', arguments: '{}' },
          }] },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await aiAgentService.processMessage('Test message');

      expect(progressCallback).toHaveBeenCalledWith({
        round: 0,
        totalRounds: aiAgentService.getConfig().maxRounds,
        toolName: 'testTool',
        toolArgs: {},
        status: 'completed',
        message: 'Tool completed: testTool',
      });
    });

    it('should call progress callback when tool errors', async () => {
      const progressCallback = vi.fn();
      aiAgentService.setProgressCallback(progressCallback);

      // Mock the LLM call to return a tool call
      const originalCallLLM = aiAgentService['callLLM'];
      aiAgentService['callLLM'] = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Using tool', tool_calls: [{
            id: 'test-id',
            function: { name: 'testTool', arguments: '{}' },
          }] },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await aiAgentService.processMessage('Test message');

      expect(progressCallback).toHaveBeenCalledWith({
        round: 0,
        totalRounds: aiAgentService.getConfig().maxRounds,
        toolName: 'testTool',
        toolArgs: {},
        status: 'error',
        message: 'Tool error: Test error',
      });
    });
  });
});