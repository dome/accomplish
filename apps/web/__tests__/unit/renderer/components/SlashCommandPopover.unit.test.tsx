/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Skill } from '@accomplish_ai/agent-core/common';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/accomplish', () => ({
  getAccomplish: () => ({}),
}));

import { SlashCommandPopover } from '@/components/landing/SlashCommandPopover';

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
];

function createTextareaRef() {
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  return { current: textarea };
}

describe('SlashCommandPopover', () => {
  let textareaRef: { current: HTMLTextAreaElement };

  beforeEach(() => {
    vi.clearAllMocks();
    textareaRef = createTextareaRef();
  });

  afterEach(() => {
    if (textareaRef.current?.parentNode) {
      textareaRef.current.parentNode.removeChild(textareaRef.current);
    }
  });

  const defaultProps = {
    query: '',
    triggerStart: 0,
    onSelect: vi.fn(),
    onDismiss: vi.fn(),
  };

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={false}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('should not render when skills list is empty', () => {
    const { container } = render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={[]}
        selectedIndex={0}
        textareaRef={textareaRef}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('should render skill commands when open', () => {
    render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
      />,
    );

    expect(screen.getByText('/code-review')).toBeInTheDocument();
    expect(screen.getByText('/git-helper')).toBeInTheDocument();
  });

  it('should render skill descriptions', () => {
    render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
      />,
    );

    expect(screen.getByText('Review code for quality and bugs')).toBeInTheDocument();
    expect(screen.getByText('Helps with git operations')).toBeInTheDocument();
  });

  it('should highlight the selected skill', () => {
    const { container } = render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
      />,
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons[0].className).toContain('bg-accent');
    expect([...buttons[1].classList]).not.toContain('bg-accent');
  });

  it('should highlight second skill when selectedIndex is 1', () => {
    const { container } = render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={1}
        textareaRef={textareaRef}
      />,
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons[1].className).toContain('bg-accent');
  });

  it('should call onSelect when a skill is clicked', () => {
    const onSelect = vi.fn();

    render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
        onSelect={onSelect}
      />,
    );

    fireEvent.mouseDown(screen.getByText('/code-review'));
    expect(onSelect).toHaveBeenCalledWith(mockSkills[0]);
  });

  it('should call onDismiss when clicking outside', () => {
    const onDismiss = vi.fn();

    render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.mouseDown(document.body);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('should display keyboard hint text', () => {
    render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
      />,
    );

    expect(screen.getByText(/navigate/i)).toBeInTheDocument();
    expect(screen.getByText(/select/i)).toBeInTheDocument();
    expect(screen.getByText(/dismiss/i)).toBeInTheDocument();
  });

  it('should show header when no query', () => {
    render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
        query=""
      />,
    );

    // The i18n key falls back to `home:slashCommand.title` in test env
    expect(screen.getByText('home:slashCommand.title')).toBeInTheDocument();
  });

  it('should show filtering header when query is present', () => {
    render(
      <SlashCommandPopover
        {...defaultProps}
        isOpen={true}
        skills={mockSkills}
        selectedIndex={0}
        textareaRef={textareaRef}
        query="code"
      />,
    );

    // The i18n key falls back to `home:slashCommand.filtering` in test env
    expect(screen.getByText('home:slashCommand.filtering')).toBeInTheDocument();
  });
});
