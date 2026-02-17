import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../test/test-utils';
import Card from './Card';

describe('Card', () => {
  it('renders children', () => {
    renderWithProviders(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('renders title', () => {
    renderWithProviders(<Card title="Card Title">Content</Card>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    renderWithProviders(<Card title="Title" subtitle="Subtitle">Content</Card>);
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });

  it('renders action slot', () => {
    renderWithProviders(
      <Card title="Title" action={<button>Action</button>}>Content</Card>
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('applies padding by default', () => {
    const { container } = renderWithProviders(<Card>Content</Card>);
    const contentDiv = container.querySelector('.p-6');
    expect(contentDiv).toBeInTheDocument();
  });

  it('removes padding when padding=false', () => {
    const { container } = renderWithProviders(<Card padding={false}>Content</Card>);
    // The child div should not have p-6 class since padding is false
    const divs = container.querySelectorAll('div');
    const hasP6 = Array.from(divs).some(d => d.className.includes('p-6'));
    expect(hasP6).toBe(false);
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(<Card className="custom-class">Content</Card>);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('renders with border by default', () => {
    const { container } = renderWithProviders(<Card>Content</Card>);
    expect(container.firstElementChild?.className).toContain('border');
  });
});
