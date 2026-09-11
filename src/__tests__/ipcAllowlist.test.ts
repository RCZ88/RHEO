import { describe, it, expect, vi, beforeEach } from 'vitest'
import { READ_IPC, WRITE_IPC, isIPCAllowed } from '../services/ipcAllowlist'

// Mock window.deskflowAPI
beforeEach(() => {
  (window as any).deskflowAPI = {}
})

describe('isIPCAllowed', () => {
  it('allows known READ endpoints', () => {
    expect(isIPCAllowed('getGoals')).toBe(true)
    expect(isIPCAllowed('getLongtermGoals')).toBe(true)
    expect(isIPCAllowed('getReminders')).toBe(true)
    expect(isIPCAllowed('getAiProviders')).toBe(true)
    expect(isIPCAllowed('aiChatLoad')).toBe(true)
  })

  it('allows known WRITE endpoints', () => {
    expect(isIPCAllowed('saveGoal')).toBe(true)
    expect(isIPCAllowed('deleteGoal')).toBe(true)
    expect(isIPCAllowed('createReminder')).toBe(true)
    expect(isIPCAllowed('connectors.sync')).toBe(true)
  })

  it('blocks unknown endpoints', () => {
    expect(isIPCAllowed('deleteAllGoals')).toBe(false)
    expect(isIPCAllowed('runArbitraryCode')).toBe(false)
    expect(isIPCAllowed('__proto__')).toBe(false)
    expect(isIPCAllowed('')).toBe(false)
  })
})

describe('READ_IPC', () => {
  it('has all expected READ endpoints', () => {
    const expected = [
      'getGoals', 'getGoalsBatch', 'getDailyReflection', 'getGoalContext', 'getLongtermGoals',
      'getReminders', 'getDashboardAggregates', 'getAIUsageSummary',
      'getProjects', 'readPlanningMd', 'getTopicDigest', 'isDigestGenerating',
      'connectors.list', 'connectors.items', 'connectors.test',
      'getAiProviders', 'aiChatLoad', 'aiChatListThreads', 'aiChatGetMemories',
      'financeGetSummary', 'financeGetWallets',
    ]
    for (const name of expected) {
      expect(READ_IPC[name]).toBeDefined()
    }
  })
})

describe('WRITE_IPC', () => {
  it('has validation on endpoints that need it', () => {
    expect(WRITE_IPC.saveGoal.validate).toBeDefined()
    expect(WRITE_IPC.deleteGoal.validate).toBeDefined()
    expect(WRITE_IPC.createReminder.validate).toBeDefined()
  })

  it('marks destructive endpoints as requiring confirmation', () => {
    expect(WRITE_IPC.deleteGoal.requiresConfirm).toBe(true)
    expect(WRITE_IPC.deleteReminder.requiresConfirm).toBe(true)
    expect(WRITE_IPC.aiChatReset.requiresConfirm).toBe(true)
  })

  it('does NOT mark non-destructive endpoints as requiring confirmation', () => {
    expect(WRITE_IPC.saveGoal.requiresConfirm).toBeFalsy()
    expect(WRITE_IPC.createReminder.requiresConfirm).toBeFalsy()
    expect(WRITE_IPC['connectors.sync'].requiresConfirm).toBeFalsy()
  })

  it('validates required fields', () => {
    expect(WRITE_IPC.saveGoal.validate!({ date: '2026-01-01', goal: {} })).toBe(true)
    expect(WRITE_IPC.saveGoal.validate!({})).toBe(false)
    expect(WRITE_IPC.saveGoal.validate!(null)).toBe(false)

    expect(WRITE_IPC.deleteGoal.validate!({ id: '123' })).toBe(true)
    expect(WRITE_IPC.deleteGoal.validate!({})).toBe(false)

    expect(WRITE_IPC.createReminder.validate!({ text: 'Hello' })).toBe(true)
    expect(WRITE_IPC.createReminder.validate!({})).toBe(false)
  })
})
