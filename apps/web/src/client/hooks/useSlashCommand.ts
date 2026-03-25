import { useState, useEffect, useCallback, useRef } from 'react';
import type { Skill } from '@accomplish_ai/agent-core/common';
import { getAccomplish } from '@/lib/accomplish';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useSlashCommand');

interface SlashCommandState {
  isOpen: boolean;
  query: string;
  /** Character index where the '/' trigger starts */
  triggerStart: number;
  skills: Skill[];
  filteredSkills: Skill[];
  selectedIndex: number;
}

const INITIAL_STATE: SlashCommandState = {
  isOpen: false,
  query: '',
  triggerStart: -1,
  skills: [],
  filteredSkills: [],
  selectedIndex: 0,
};

export interface UseSlashCommandOptions {
  value: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}

export interface UseSlashCommandReturn {
  state: SlashCommandState;
  dismiss: () => void;
  selectSkill: (skill: Skill) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  handleChange: (newValue: string, selectionStart: number | null) => void;
}

function filterSkills(skills: Skill[], query: string): Skill[] {
  if (!query) {
    return skills;
  }
  const q = query.toLowerCase();
  return skills.filter(
    (s) =>
      s.command.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q),
  );
}

/**
 * Detect if the character at `pos` is a slash trigger:
 * either at position 0 or preceded by whitespace/newline.
 */
function isSlashTrigger(value: string, pos: number): boolean {
  if (value[pos] !== '/') {
    return false;
  }
  return pos === 0 || /\s/.test(value[pos - 1]);
}

/**
 * Walk backwards from cursor to find the active slash-trigger range.
 * Returns { triggerStart, query } or null if no active trigger.
 */
function findSlashContext(
  value: string,
  cursorPos: number,
): { triggerStart: number; query: string } | null {
  let i = cursorPos - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === '/') {
      if (isSlashTrigger(value, i)) {
        return { triggerStart: i, query: value.slice(i + 1, cursorPos) };
      }
      return null;
    }
    if (/\s/.test(ch)) {
      return null;
    }
    i--;
  }
  return null;
}

export function useSlashCommand({
  value,
  textareaRef,
  onChange,
}: UseSlashCommandOptions): UseSlashCommandReturn {
  const [state, setState] = useState<SlashCommandState>(INITIAL_STATE);
  const skillsCacheRef = useRef<Skill[]>([]);

  const loadSkills = useCallback(async () => {
    try {
      const accomplish = getAccomplish();
      const skills = await accomplish.getEnabledSkills();
      const visible = skills.filter((s) => !s.isHidden);
      skillsCacheRef.current = visible;
      return visible;
    } catch (err) {
      logger.error('Failed to load skills for slash command:', err);
      return skillsCacheRef.current;
    }
  }, []);

  const dismiss = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const selectSkill = useCallback(
    (skill: Skill) => {
      const { triggerStart } = state;
      if (triggerStart < 0) {
        dismiss();
        return;
      }

      const textarea = textareaRef.current;
      const cursorPos = textarea?.selectionStart ?? value.length;

      const before = value.slice(0, triggerStart);
      const after = value.slice(cursorPos);
      const insertion = skill.command;
      const needsSpace = after.length > 0 && after[0] !== ' ';
      const newValue = before + insertion + (needsSpace ? ' ' : '') + after;
      const newCursor = triggerStart + insertion.length + (needsSpace ? 1 : 0);

      onChange(newValue);
      dismiss();

      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(newCursor, newCursor);
        }
      });
    },
    [state, value, textareaRef, onChange, dismiss],
  );

  const handleChange = useCallback(
    (newValue: string, selectionStart: number | null) => {
      const cursorPos = selectionStart ?? newValue.length;
      const ctx = findSlashContext(newValue, cursorPos);

      if (!ctx) {
        if (state.isOpen) {
          dismiss();
        }
        return;
      }

      // Fresh-fetch skills when popover first opens so added/removed/toggled
      // skills are always reflected. While already open, reuse the fetched list.
      if (!state.isOpen) {
        void loadSkills().then((loaded) => {
          if (loaded.length > 0) {
            const filtered = filterSkills(loaded, ctx.query);
            setState({
              isOpen: true,
              query: ctx.query,
              triggerStart: ctx.triggerStart,
              skills: loaded,
              filteredSkills: filtered,
              selectedIndex: 0,
            });
          }
        });
        return;
      }

      const skills = skillsCacheRef.current;
      const filtered = filterSkills(skills, ctx.query);
      setState((prev) => ({
        ...prev,
        isOpen: true,
        query: ctx.query,
        triggerStart: ctx.triggerStart,
        filteredSkills: filtered,
        skills,
        selectedIndex: Math.min(prev.selectedIndex, Math.max(0, filtered.length - 1)),
      }));
    },
    [state.isOpen, dismiss, loadSkills],
  );

  /**
   * Intercepts keyboard events when the popover is open.
   * Returns true if the event was handled (caller should preventDefault/not propagate).
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!state.isOpen || state.filteredSkills.length === 0) {
        return false;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % prev.filteredSkills.length,
        }));
        return true;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex:
            (prev.selectedIndex - 1 + prev.filteredSkills.length) % prev.filteredSkills.length,
        }));
        return true;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const skill = state.filteredSkills[state.selectedIndex];
        if (skill) {
          selectSkill(skill);
        }
        return true;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
        return true;
      }

      return false;
    },
    [state, selectSkill, dismiss],
  );

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  return { state, dismiss, selectSkill, handleKeyDown, handleChange };
}
