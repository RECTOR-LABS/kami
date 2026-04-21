import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadConversations,
  saveConversations,
  getActiveConversationId,
  setActiveConversationId,
  createConversation,
} from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('createConversation', () => {
  it('uses "New Chat" as the default title', () => {
    const c = createConversation();
    expect(c.title).toBe('New Chat');
    expect(c.messages).toEqual([]);
    expect(c.id).toBeTruthy();
    expect(c.createdAt).toBeLessThanOrEqual(Date.now());
    expect(c.updatedAt).toBeLessThanOrEqual(Date.now());
  });

  it('honours a custom title when provided', () => {
    expect(createConversation('hi').title).toBe('hi');
  });

  it('generates unique ids', () => {
    expect(createConversation().id).not.toBe(createConversation().id);
  });
});

describe('conversation persistence', () => {
  it('returns an empty array when storage is empty', () => {
    expect(loadConversations()).toEqual([]);
  });

  it('round-trips conversations through localStorage', () => {
    const c = createConversation('test');
    saveConversations([c]);
    expect(loadConversations()).toEqual([c]);
  });

  it('returns an empty array when storage is corrupt', () => {
    localStorage.setItem('kami_conversations', '{not valid json}');
    expect(loadConversations()).toEqual([]);
  });
});

describe('active conversation id', () => {
  it('returns null when no active id is stored', () => {
    expect(getActiveConversationId()).toBeNull();
  });

  it('round-trips the active id', () => {
    setActiveConversationId('abc-123');
    expect(getActiveConversationId()).toBe('abc-123');
  });
});
