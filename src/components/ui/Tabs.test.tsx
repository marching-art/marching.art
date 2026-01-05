// =============================================================================
// TABS COMPONENT TESTS
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Trophy, Star, Settings } from 'lucide-react';
import { Tabs, TabsList, TabTrigger, TabContent, SimpleTabs } from './Tabs';

describe('Tabs', () => {
  describe('basic rendering', () => {
    it('renders tab triggers correctly', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabsList>
            <TabTrigger value="tab1">Tab 1</TabTrigger>
            <TabTrigger value="tab2">Tab 2</TabTrigger>
            <TabTrigger value="tab3">Tab 3</TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 3' })).toBeInTheDocument();
    });

    it('shows default tab content', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
            <TabTrigger value="second">Second</TabTrigger>
          </TabsList>
          <TabContent value="first">First tab content</TabContent>
          <TabContent value="second">Second tab content</TabContent>
        </Tabs>
      );

      expect(screen.getByText('First tab content')).toBeInTheDocument();
      expect(screen.queryByText('Second tab content')).not.toBeInTheDocument();
    });

    it('renders tablist with correct role', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabsList>
            <TabTrigger value="tab1">Tab 1</TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('switches content when clicking a tab', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
            <TabTrigger value="second">Second</TabTrigger>
          </TabsList>
          <TabContent value="first">First content</TabContent>
          <TabContent value="second">Second content</TabContent>
        </Tabs>
      );

      expect(screen.getByText('First content')).toBeInTheDocument();
      expect(screen.queryByText('Second content')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

      expect(screen.queryByText('First content')).not.toBeInTheDocument();
      expect(screen.getByText('Second content')).toBeInTheDocument();
    });

    it('calls onChange when tab is changed', () => {
      const handleChange = vi.fn();
      render(
        <Tabs defaultTab="first" onChange={handleChange}>
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
            <TabTrigger value="second">Second</TabTrigger>
          </TabsList>
        </Tabs>
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Second' }));
      expect(handleChange).toHaveBeenCalledWith('second');
    });
  });

  describe('aria attributes', () => {
    it('sets aria-selected correctly', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
            <TabTrigger value="second">Second</TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

      expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true');
    });

    it('sets aria-controls on triggers', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-controls', 'tabpanel-first');
    });

    it('sets correct role on tab content', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
          </TabsList>
          <TabContent value="first">Content</TabContent>
        </Tabs>
      );

      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  describe('disabled tabs', () => {
    it('does not switch to disabled tab when clicked', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
            <TabTrigger value="second" disabled>Second</TabTrigger>
          </TabsList>
          <TabContent value="first">First content</TabContent>
          <TabContent value="second">Second content</TabContent>
        </Tabs>
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

      expect(screen.getByText('First content')).toBeInTheDocument();
      expect(screen.queryByText('Second content')).not.toBeInTheDocument();
    });

    it('disabled tab has disabled attribute', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
            <TabTrigger value="second" disabled>Second</TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: 'Second' })).toBeDisabled();
    });
  });

  describe('icons', () => {
    it('renders icon in tab trigger', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first" icon={<Trophy data-testid="trophy-icon" />}>
              First
            </TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(screen.getByTestId('trophy-icon')).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('applies custom className to Tabs', () => {
      const { container } = render(
        <Tabs defaultTab="first" className="custom-tabs">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(container.firstChild).toHaveClass('custom-tabs');
    });

    it('applies custom className to TabsList', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList className="custom-list">
            <TabTrigger value="first">First</TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(screen.getByRole('tablist')).toHaveClass('custom-list');
    });

    it('applies custom className to TabTrigger', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first" className="custom-trigger">First</TabTrigger>
          </TabsList>
        </Tabs>
      );

      expect(screen.getByRole('tab')).toHaveClass('custom-trigger');
    });

    it('applies custom className to TabContent', () => {
      render(
        <Tabs defaultTab="first">
          <TabsList>
            <TabTrigger value="first">First</TabTrigger>
          </TabsList>
          <TabContent value="first" className="custom-content">Content</TabContent>
        </Tabs>
      );

      expect(screen.getByRole('tabpanel')).toHaveClass('custom-content');
    });
  });
});

describe('SimpleTabs', () => {
  const mockTabs = [
    { id: 'overview', label: 'Overview', content: <p>Overview content</p> },
    { id: 'stats', label: 'Statistics', content: <p>Stats content</p> },
    { id: 'settings', label: 'Settings', content: <p>Settings content</p> },
  ];

  it('renders all tab triggers', () => {
    render(<SimpleTabs tabs={mockTabs} />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Statistics' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows first tab content by default', () => {
    render(<SimpleTabs tabs={mockTabs} />);

    expect(screen.getByText('Overview content')).toBeInTheDocument();
  });

  it('shows specified default tab content', () => {
    render(<SimpleTabs tabs={mockTabs} defaultTab="stats" />);

    expect(screen.getByText('Stats content')).toBeInTheDocument();
    expect(screen.queryByText('Overview content')).not.toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    render(<SimpleTabs tabs={mockTabs} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(screen.getByText('Settings content')).toBeInTheDocument();
    expect(screen.queryByText('Overview content')).not.toBeInTheDocument();
  });

  it('calls onChange when tab changes', () => {
    const handleChange = vi.fn();
    render(<SimpleTabs tabs={mockTabs} onChange={handleChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Statistics' }));
    expect(handleChange).toHaveBeenCalledWith('stats');
  });

  it('renders tabs with icons', () => {
    const tabsWithIcons = [
      { id: 'trophy', label: 'Trophies', icon: <Trophy data-testid="trophy" />, content: <p>Trophies</p> },
      { id: 'star', label: 'Stars', icon: <Star data-testid="star" />, content: <p>Stars</p> },
    ];

    render(<SimpleTabs tabs={tabsWithIcons} />);

    expect(screen.getByTestId('trophy')).toBeInTheDocument();
    expect(screen.getByTestId('star')).toBeInTheDocument();
  });

  it('handles disabled tabs', () => {
    const tabsWithDisabled = [
      { id: 'active', label: 'Active', content: <p>Active content</p> },
      { id: 'disabled', label: 'Disabled', content: <p>Disabled content</p>, disabled: true },
    ];

    render(<SimpleTabs tabs={tabsWithDisabled} />);

    expect(screen.getByRole('tab', { name: 'Disabled' })).toBeDisabled();

    fireEvent.click(screen.getByRole('tab', { name: 'Disabled' }));
    expect(screen.queryByText('Disabled content')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SimpleTabs tabs={mockTabs} className="custom-simple-tabs" />
    );

    expect(container.firstChild).toHaveClass('custom-simple-tabs');
  });
});

describe('Tabs context error', () => {
  it('throws error when TabTrigger is used outside Tabs', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TabTrigger value="test">Test</TabTrigger>);
    }).toThrow('Tabs components must be used within a Tabs provider');

    consoleSpy.mockRestore();
  });

  it('throws error when TabContent is used outside Tabs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TabContent value="test">Content</TabContent>);
    }).toThrow('Tabs components must be used within a Tabs provider');

    consoleSpy.mockRestore();
  });
});
