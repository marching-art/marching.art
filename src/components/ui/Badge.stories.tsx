import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';
import { Star, Trophy, AlertTriangle } from 'lucide-react';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'danger', 'info', 'gold'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    dot: {
      control: 'boolean',
    },
    pulse: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Badge',
  },
};

export const Primary: Story = {
  args: {
    children: 'Primary',
    variant: 'primary',
  },
};

export const Success: Story = {
  args: {
    children: 'Success',
    variant: 'success',
  },
};

export const Warning: Story = {
  args: {
    children: 'Warning',
    variant: 'warning',
  },
};

export const Danger: Story = {
  args: {
    children: 'Danger',
    variant: 'danger',
  },
};

export const Gold: Story = {
  args: {
    children: 'Premium',
    variant: 'gold',
  },
};

export const Small: Story = {
  args: {
    children: 'Small',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    children: 'Large',
    size: 'lg',
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Star className="w-3 h-3" />
        Featured
      </>
    ),
    variant: 'gold',
  },
};

export const WithDot: Story = {
  args: {
    children: 'Active',
    dot: true,
    variant: 'success',
  },
};

export const Pulsing: Story = {
  args: {
    children: 'Live',
    pulse: true,
    variant: 'danger',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="gold">Gold</Badge>
    </div>
  ),
};
