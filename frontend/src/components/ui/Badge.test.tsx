import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../test/test-utils';
import Badge from './Badge';

describe('Badge', () => {
  it('renders children text', () => {
    renderWithProviders(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders neutral variant by default', () => {
    renderWithProviders(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-gray-50');
  });

  it('renders success variant', () => {
    renderWithProviders(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge.className).toContain('bg-emerald-50');
  });

  it('renders error variant', () => {
    renderWithProviders(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge.className).toContain('bg-red-50');
  });

  it('renders warning variant', () => {
    renderWithProviders(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-amber-50');
  });

  it('renders info variant', () => {
    renderWithProviders(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('bg-blue-50');
  });

  it('renders dot indicator when dot prop is true', () => {
    const { container } = renderWithProviders(<Badge variant="success" dot>Active</Badge>);
    const dot = container.querySelector('.rounded-full.bg-emerald-500');
    expect(dot).toBeInTheDocument();
  });

  it('does not render dot indicator when dot prop is false', () => {
    const { container } = renderWithProviders(<Badge variant="success">Active</Badge>);
    const dot = container.querySelector('.w-1\\.5');
    expect(dot).not.toBeInTheDocument();
  });

  it('renders sm size by default', () => {
    renderWithProviders(<Badge>Small</Badge>);
    const badge = screen.getByText('Small');
    expect(badge.className).toContain('text-xs');
  });

  it('renders md size', () => {
    renderWithProviders(<Badge size="md">Medium</Badge>);
    const badge = screen.getByText('Medium');
    expect(badge.className).toContain('text-sm');
  });
});
