// =============================================================================
// INPUT COMPONENT TESTS
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Search, Eye } from 'lucide-react';
import { Input, Textarea, Select } from './Input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders input element', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Email" />);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('associates label with input', () => {
      render(<Input label="Username" id="username-input" />);
      const input = screen.getByLabelText('Username');
      expect(input).toBeInTheDocument();
    });

    it('renders helper text', () => {
      render(<Input helperText="Enter your email address" />);
      expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      render(<Input error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error styling to input', () => {
      render(<Input error="Error" placeholder="test" />);
      const input = screen.getByPlaceholderText('test');
      expect(input).toHaveClass('border-red-500');
    });

    it('shows error text in red', () => {
      render(<Input error="Error message" />);
      const errorText = screen.getByText('Error message');
      expect(errorText).toHaveClass('text-red-400');
    });

    it('prioritizes error over helper text', () => {
      render(<Input error="Error" helperText="Helper" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      render(<Input leftIcon={Search} placeholder="Search" />);
      const input = screen.getByPlaceholderText('Search');
      expect(input).toHaveClass('pl-10');
    });

    it('renders right icon', () => {
      render(<Input rightIcon={Eye} placeholder="Password" />);
      const input = screen.getByPlaceholderText('Password');
      expect(input).toHaveClass('pr-10');
    });

    it('renders right element', () => {
      render(
        <Input
          rightElement={<button data-testid="toggle-btn">Show</button>}
          placeholder="Password"
        />
      );
      expect(screen.getByTestId('toggle-btn')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies small size', () => {
      render(<Input inputSize="sm" placeholder="small" />);
      const input = screen.getByPlaceholderText('small');
      expect(input).toHaveClass('px-3');
      expect(input).toHaveClass('py-2');
      expect(input).toHaveClass('text-sm');
    });

    it('applies medium size by default', () => {
      render(<Input placeholder="medium" />);
      const input = screen.getByPlaceholderText('medium');
      expect(input).toHaveClass('px-4');
      expect(input).toHaveClass('py-3');
    });

    it('applies large size', () => {
      render(<Input inputSize="lg" placeholder="large" />);
      const input = screen.getByPlaceholderText('large');
      expect(input).toHaveClass('px-5');
      expect(input).toHaveClass('py-4');
      expect(input).toHaveClass('text-lg');
    });
  });

  describe('interactions', () => {
    it('handles onChange', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} placeholder="input" />);
      fireEvent.change(screen.getByPlaceholderText('input'), {
        target: { value: 'test' },
      });
      expect(handleChange).toHaveBeenCalled();
    });

    it('supports disabled state', () => {
      render(<Input disabled placeholder="disabled" />);
      expect(screen.getByPlaceholderText('disabled')).toBeDisabled();
    });

    it('supports type prop', () => {
      render(<Input type="email" placeholder="email" />);
      expect(screen.getByPlaceholderText('email')).toHaveAttribute('type', 'email');
    });
  });

  describe('custom className', () => {
    it('accepts custom className', () => {
      render(<Input className="custom-input" placeholder="custom" />);
      expect(screen.getByPlaceholderText('custom')).toHaveClass('custom-input');
    });
  });
});

describe('Textarea', () => {
  describe('rendering', () => {
    it('renders textarea element', () => {
      render(<Textarea placeholder="Enter message" />);
      const textarea = screen.getByPlaceholderText('Enter message');
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('renders with label', () => {
      render(<Textarea label="Message" />);
      expect(screen.getByText('Message')).toBeInTheDocument();
    });

    it('associates label with textarea', () => {
      render(<Textarea label="Description" id="desc" />);
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('renders helper text', () => {
      render(<Textarea helperText="Max 500 characters" />);
      expect(screen.getByText('Max 500 characters')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      render(<Textarea error="Message is required" />);
      expect(screen.getByText('Message is required')).toBeInTheDocument();
    });

    it('applies error styling', () => {
      render(<Textarea error="Error" placeholder="test" />);
      expect(screen.getByPlaceholderText('test')).toHaveClass('border-red-500');
    });
  });

  describe('interactions', () => {
    it('handles onChange', () => {
      const handleChange = vi.fn();
      render(<Textarea onChange={handleChange} placeholder="text" />);
      fireEvent.change(screen.getByPlaceholderText('text'), {
        target: { value: 'Hello' },
      });
      expect(handleChange).toHaveBeenCalled();
    });

    it('supports disabled state', () => {
      render(<Textarea disabled placeholder="disabled" />);
      expect(screen.getByPlaceholderText('disabled')).toBeDisabled();
    });
  });

  describe('custom className', () => {
    it('accepts custom className', () => {
      render(<Textarea className="custom-textarea" placeholder="custom" />);
      expect(screen.getByPlaceholderText('custom')).toHaveClass('custom-textarea');
    });
  });
});

describe('Select', () => {
  const options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3', disabled: true },
  ];

  describe('rendering', () => {
    it('renders select element', () => {
      render(<Select options={options} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders all options', () => {
      render(<Select options={options} />);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('renders placeholder', () => {
      render(<Select options={options} placeholder="Select an option" />);
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Select options={options} label="Choose" />);
      expect(screen.getByText('Choose')).toBeInTheDocument();
    });

    it('renders helper text', () => {
      render(<Select options={options} helperText="Select one" />);
      expect(screen.getByText('Select one')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      render(<Select options={options} error="Selection required" />);
      expect(screen.getByText('Selection required')).toBeInTheDocument();
    });

    it('applies error styling', () => {
      render(<Select options={options} error="Error" />);
      expect(screen.getByRole('combobox')).toHaveClass('border-red-500');
    });
  });

  describe('disabled options', () => {
    it('marks disabled options', () => {
      render(<Select options={options} />);
      const option3 = screen.getByText('Option 3');
      expect(option3).toHaveAttribute('disabled');
    });
  });

  describe('sizes', () => {
    it('applies small size', () => {
      render(<Select options={options} selectSize="sm" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('px-3');
      expect(select).toHaveClass('py-2');
    });

    it('applies large size', () => {
      render(<Select options={options} selectSize="lg" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('px-5');
      expect(select).toHaveClass('py-4');
    });
  });

  describe('interactions', () => {
    it('handles onChange', () => {
      const handleChange = vi.fn();
      render(<Select options={options} onChange={handleChange} />);
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'opt2' },
      });
      expect(handleChange).toHaveBeenCalled();
    });

    it('supports disabled state', () => {
      render(<Select options={options} disabled />);
      expect(screen.getByRole('combobox')).toBeDisabled();
    });
  });

  describe('custom className', () => {
    it('accepts custom className', () => {
      render(<Select options={options} className="custom-select" />);
      expect(screen.getByRole('combobox')).toHaveClass('custom-select');
    });
  });
});
