import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardContent, CardFooter } from './Card';
import { Button } from './Button';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'elevated', 'glass', 'outline'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
    interactive: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <CardHeader title="Card Title" subtitle="Card subtitle text" />
        <CardContent>
          <p className="text-cream-300">
            This is the card content. It can contain any elements you need.
          </p>
        </CardContent>
      </>
    ),
  },
};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: (
      <>
        <CardHeader title="Elevated Card" />
        <CardContent>
          <p className="text-cream-300">
            An elevated card has more prominence with a shadow effect.
          </p>
        </CardContent>
      </>
    ),
  },
};

export const Glass: Story = {
  args: {
    variant: 'glass',
    children: (
      <>
        <CardHeader title="Glass Card" />
        <CardContent>
          <p className="text-cream-300">
            A glass card has a translucent backdrop blur effect.
          </p>
        </CardContent>
      </>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    children: (
      <>
        <CardHeader title="Card with Footer" subtitle="Complete card example" />
        <CardContent>
          <p className="text-cream-300">
            This card includes a footer with action buttons.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="ghost" size="sm">Cancel</Button>
          <Button variant="primary" size="sm">Save</Button>
        </CardFooter>
      </>
    ),
  },
};

export const Interactive: Story = {
  args: {
    variant: 'default',
    interactive: true,
    children: (
      <>
        <CardHeader title="Interactive Card" />
        <CardContent>
          <p className="text-cream-300">
            Hover over this card to see the interactive effect.
          </p>
        </CardContent>
      </>
    ),
  },
};
