import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Skill } from '@accomplish_ai/agent-core/common';
import type { UseSlashCommandReturn } from '@/hooks/useSlashCommand';

const mockSkills: Skill[] = [
  {
    id: 'skill-1',
    name: 'Code Review',
    command: '/code-review',
    description: 'Review code for quality and bugs',
    source: 'official',
    isEnabled: true,
    isVerified: true,
    isHidden: false,
    filePath: '/skills/code-review',
    updatedAt: '2024-01-01',
  },
  {
    id: 'skill-2',
    name: 'Git Helper',
    command: '/git-helper',
    description: 'Helps with git operations',
    source: 'community',
    isEnabled: true,
    isVerified: false,
    isHidden: false,
    filePath: '/skills/git-helper',
    updatedAt: '2024-01-01',
  },
  {
    id: 'skill-3',
    name: 'Hidden Skill',
    command: '/hidden',
    description: 'Should be filtered out',
    source: 'custom',
    isEnabled: true,
    isVerified: false,
    isHidden: true,
    filePath: '/skills/hidden',
    updatedAt: '2024-01-01',
  },
];

const mockGetEnabledSkills = vi.fn().mockResolvedValue(mockSkills);

vi.mock('@/lib/accomplish', () => ({
  getAccomplish: () => ({
    getEnabledSkills: mockGetEnabledSkills,
  }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { useSlashCommand } from '@/hooks/useSlashCommand';

function createTextareaRef(overrides?: Partial<HTMLTextAreaElement>) {
  return {
    current: {
      selectionStart: 0,
      focus: vi.fn(),
      setSelectionRange: vi.fn(),
      ...overrides,
    } as unknown as HTMLTextAreaElement,
  };
}

function createKeyboardEvent(key: string, extra?: Partial<React.KeyboardEvent>) {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...extra,
  } as unknown as React.KeyboardEvent;
}

describe('useSlashCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEnabledSkills.mockResolvedValue(mockSkills);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderSlashHook(
    initialValue = '',
    textareaRef?: ReturnType<typeof createTextareaRef>,
  ) {
    const onChange = vi.fn();
    const ref = textareaRef ?? createTextareaRef({ selectionStart: initialValue.length });

    const hook = renderHook(() =>
      useSlashCommand({
        value: initialValue,
        textareaRef: ref,
        onChange,
      }),
    );

    await act(async () => {});
    return { hook, onChange, ref };
  }

  // Opening the popover triggers an async skills fetch; this helper
  // calls handleChange and flushes the resulting promise.
  async function openPopover(
    hook: ReturnType<typeof renderHook<UseSlashCommandReturn, unknown>>,
    value = '/',
    cursor?: number,
  ) {
    await act(async () => {
      hook.result.current.handleChange(value, cursor ?? value.length);
    });
  }

  describe('initial state', () => {
    it('should start with popover closed', async () => {
      const { hook } = await renderSlashHook();
      expect(hook.result.current.state.isOpen).toBe(false);
      expect(hook.result.current.state.filteredSkills).toEqual([]);
    });

    it('should load skills on mount', async () => {
      await renderSlashHook();
      expect(mockGetEnabledSkills).toHaveBeenCalledOnce();
    });

    it('should filter out hidden skills', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);

      const { filteredSkills } = hook.result.current.state;
      expect(filteredSkills).toHaveLength(2);
      expect(filteredSkills.every((s) => !s.isHidden)).toBe(true);
    });
  });

  describe('slash trigger detection', () => {
    it('should open popover when "/" is typed at start of input', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, '/', 1);

      expect(hook.result.current.state.isOpen).toBe(true);
      expect(hook.result.current.state.triggerStart).toBe(0);
    });

    it('should open popover when "/" is typed after a space', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, 'hello /', 7);

      expect(hook.result.current.state.isOpen).toBe(true);
      expect(hook.result.current.state.triggerStart).toBe(6);
    });

    it('should open popover when "/" is typed after a newline', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, 'hello\n/', 7);

      expect(hook.result.current.state.isOpen).toBe(true);
      expect(hook.result.current.state.triggerStart).toBe(6);
    });

    it('should not open popover for "/" in the middle of a word', async () => {
      const { hook } = await renderSlashHook();

      await act(async () => {
        hook.result.current.handleChange('http://example.com', 18);
      });

      expect(hook.result.current.state.isOpen).toBe(false);
    });

    it('should not open popover when no "/" is present', async () => {
      const { hook } = await renderSlashHook();

      await act(async () => {
        hook.result.current.handleChange('hello world', 11);
      });

      expect(hook.result.current.state.isOpen).toBe(false);
    });

    it('should close popover when space is typed after slash query', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, '/code', 5);
      expect(hook.result.current.state.isOpen).toBe(true);

      act(() => {
        hook.result.current.handleChange('/code ', 6);
      });
      expect(hook.result.current.state.isOpen).toBe(false);
    });
  });

  describe('filtering', () => {
    it('should show all visible skills when "/" is typed with no query', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);

      expect(hook.result.current.state.filteredSkills).toHaveLength(2);
      expect(hook.result.current.state.query).toBe('');
    });

    it('should filter skills by command', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, '/code', 5);

      expect(hook.result.current.state.filteredSkills).toHaveLength(1);
      expect(hook.result.current.state.filteredSkills[0].command).toBe('/code-review');
    });

    it('should filter skills by name', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, '/git', 4);

      expect(hook.result.current.state.filteredSkills).toHaveLength(1);
      expect(hook.result.current.state.filteredSkills[0].name).toBe('Git Helper');
    });

    it('should filter skills by description', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, '/bugs', 5);

      expect(hook.result.current.state.filteredSkills).toHaveLength(1);
      expect(hook.result.current.state.filteredSkills[0].command).toBe('/code-review');
    });

    it('should be case-insensitive', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, '/CODE', 5);

      expect(hook.result.current.state.filteredSkills).toHaveLength(1);
      expect(hook.result.current.state.filteredSkills[0].command).toBe('/code-review');
    });

    it('should return empty list when no skills match', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook, '/xyz', 4);

      expect(hook.result.current.state.filteredSkills).toHaveLength(0);
    });
  });

  describe('keyboard navigation', () => {
    it('should not handle keys when popover is closed', async () => {
      const { hook } = await renderSlashHook();
      const event = createKeyboardEvent('ArrowDown');

      let handled: boolean;
      act(() => {
        handled = hook.result.current.handleKeyDown(event);
      });

      expect(handled!).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should move selection down with ArrowDown', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);
      expect(hook.result.current.state.selectedIndex).toBe(0);

      const event = createKeyboardEvent('ArrowDown');
      act(() => {
        hook.result.current.handleKeyDown(event);
      });

      expect(hook.result.current.state.selectedIndex).toBe(1);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should wrap around when ArrowDown reaches the end', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);

      act(() => {
        hook.result.current.handleKeyDown(createKeyboardEvent('ArrowDown'));
      });
      act(() => {
        hook.result.current.handleKeyDown(createKeyboardEvent('ArrowDown'));
      });

      expect(hook.result.current.state.selectedIndex).toBe(0);
    });

    it('should move selection up with ArrowUp', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);

      act(() => {
        hook.result.current.handleKeyDown(createKeyboardEvent('ArrowDown'));
      });
      expect(hook.result.current.state.selectedIndex).toBe(1);

      act(() => {
        hook.result.current.handleKeyDown(createKeyboardEvent('ArrowUp'));
      });
      expect(hook.result.current.state.selectedIndex).toBe(0);
    });

    it('should wrap around when ArrowUp goes below 0', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);

      act(() => {
        hook.result.current.handleKeyDown(createKeyboardEvent('ArrowUp'));
      });

      expect(hook.result.current.state.selectedIndex).toBe(1);
    });

    it('should dismiss popover on Escape', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);
      expect(hook.result.current.state.isOpen).toBe(true);

      const event = createKeyboardEvent('Escape');
      act(() => {
        hook.result.current.handleKeyDown(event);
      });

      expect(hook.result.current.state.isOpen).toBe(false);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should select skill on Enter', async () => {
      const { hook, onChange } = await renderSlashHook();

      await openPopover(hook);

      const event = createKeyboardEvent('Enter');
      act(() => {
        hook.result.current.handleKeyDown(event);
      });

      expect(onChange).toHaveBeenCalledWith('/code-review');
      expect(hook.result.current.state.isOpen).toBe(false);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should select skill on Tab', async () => {
      const { hook, onChange } = await renderSlashHook();

      await openPopover(hook);

      const event = createKeyboardEvent('Tab');
      act(() => {
        hook.result.current.handleKeyDown(event);
      });

      expect(onChange).toHaveBeenCalledWith('/code-review');
      expect(hook.result.current.state.isOpen).toBe(false);
    });

    it('should not handle unrelated keys', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);

      const event = createKeyboardEvent('a');
      let handled: boolean;
      act(() => {
        handled = hook.result.current.handleKeyDown(event);
      });

      expect(handled!).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('skill selection', () => {
    it('should replace slash query with skill command', async () => {
      const { hook, onChange } = await renderSlashHook();

      await openPopover(hook, '/cod', 4);

      act(() => {
        hook.result.current.selectSkill(hook.result.current.state.filteredSkills[0]);
      });

      expect(onChange).toHaveBeenCalledWith('/code-review');
    });

    it('should insert skill command in the middle of text', async () => {
      const ref = createTextareaRef({ selectionStart: 10 });
      const onChange = vi.fn();

      const hook = renderHook(() =>
        useSlashCommand({
          value: 'hello /cod world',
          textareaRef: ref,
          onChange,
        }),
      );
      await act(async () => {});

      await openPopover(hook, 'hello /cod world', 10);

      act(() => {
        hook.result.current.selectSkill(hook.result.current.state.filteredSkills[0]);
      });

      expect(onChange).toHaveBeenCalledWith('hello /code-review world');
    });

    it('should add space when inserting before adjacent text', async () => {
      const ref = createTextareaRef({ selectionStart: 1 });
      const onChange = vi.fn();

      const hook = renderHook(() =>
        useSlashCommand({
          value: '/more text',
          textareaRef: ref,
          onChange,
        }),
      );
      await act(async () => {});

      await openPopover(hook, '/', 1);

      act(() => {
        const skill = hook.result.current.state.filteredSkills[0];
        hook.result.current.selectSkill(skill);
      });

      const calledWith = onChange.mock.calls[0][0];
      expect(calledWith).toContain('/code-review');
    });

    it('should close popover after selection', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);
      expect(hook.result.current.state.isOpen).toBe(true);

      act(() => {
        hook.result.current.selectSkill(hook.result.current.state.filteredSkills[0]);
      });
      expect(hook.result.current.state.isOpen).toBe(false);
    });
  });

  describe('dismiss', () => {
    it('should reset state when dismissed', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);
      expect(hook.result.current.state.isOpen).toBe(true);

      act(() => {
        hook.result.current.dismiss();
      });

      expect(hook.result.current.state.isOpen).toBe(false);
      expect(hook.result.current.state.query).toBe('');
      expect(hook.result.current.state.triggerStart).toBe(-1);
      expect(hook.result.current.state.filteredSkills).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle skill loading failure gracefully', async () => {
      mockGetEnabledSkills.mockRejectedValue(new Error('Network error'));

      const { hook } = await renderSlashHook();

      await act(async () => {
        hook.result.current.handleChange('/', 1);
      });

      expect(hook.result.current.state.isOpen).toBe(false);
    });
  });

  describe('selectedIndex clamping', () => {
    it('should clamp selectedIndex when filter narrows results', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);
      expect(hook.result.current.state.filteredSkills).toHaveLength(2);

      act(() => {
        hook.result.current.handleKeyDown(createKeyboardEvent('ArrowDown'));
      });
      expect(hook.result.current.state.selectedIndex).toBe(1);

      act(() => {
        hook.result.current.handleChange('/code', 5);
      });
      expect(hook.result.current.state.filteredSkills).toHaveLength(1);
      expect(hook.result.current.state.selectedIndex).toBe(0);
    });
  });

  describe('fresh fetch on open', () => {
    it('should re-fetch skills each time popover opens', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);
      expect(hook.result.current.state.isOpen).toBe(true);

      act(() => {
        hook.result.current.dismiss();
      });

      const callsBefore = mockGetEnabledSkills.mock.calls.length;

      await openPopover(hook);

      expect(mockGetEnabledSkills.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('should reflect newly added skills after re-open', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);
      expect(hook.result.current.state.filteredSkills).toHaveLength(2);

      act(() => {
        hook.result.current.dismiss();
      });

      mockGetEnabledSkills.mockResolvedValueOnce([
        ...mockSkills,
        {
          id: 'skill-new',
          name: 'New Skill',
          command: '/new-skill',
          description: 'A brand new skill',
          source: 'custom',
          isEnabled: true,
          isVerified: false,
          isHidden: false,
          filePath: '/skills/new',
          updatedAt: '2024-02-01',
        },
      ]);

      await openPopover(hook);
      expect(hook.result.current.state.filteredSkills).toHaveLength(3);
    });

    it('should not show removed skills after re-open', async () => {
      const { hook } = await renderSlashHook();

      await openPopover(hook);
      expect(hook.result.current.state.filteredSkills).toHaveLength(2);

      act(() => {
        hook.result.current.dismiss();
      });

      mockGetEnabledSkills.mockResolvedValueOnce([mockSkills[0]]);

      await openPopover(hook);
      expect(hook.result.current.state.filteredSkills).toHaveLength(1);
      expect(hook.result.current.state.filteredSkills[0].command).toBe('/code-review');
    });
  });
});
