import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../test/test-utils';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('renders title and value', () => {
    renderWithProviders(<StatCard title="Total" value="1,234" />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    renderWithProviders(<StatCard title="Total" value="100" subtitle="24h change" />);
    expect(screen.getByText('24h change')).toBeInTheDocument();
  });

  it('renders icon', () => {
    renderWithProviders(
      <StatCard title="Total" value="100" icon={<span data-testid="stat-icon">I</span>} />
    );
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
  });

  it('renders default variant (white bg)', () => {
    const { container } = renderWithProviders(<StatCard title="T" value="0" />);
    expect(container.firstElementChild?.className).toContain('bg-white');
  });

  it('renders gradient-green variant', () => {
    const { container } = renderWithProviders(
      <StatCard title="T" value="0" variant="gradient-green" />
    );
    expect(container.firstElementChild?.className).toContain('from-emerald-500');
  });

  it('renders gradient-indigo variant', () => {
    const { container } = renderWithProviders(
      <StatCard title="T" value="0" variant="gradient-indigo" />
    );
    expect(container.firstElementChild?.className).toContain('from-indigo-500');
  });

  it('renders positive trend', () => {
    renderWithProviders(
      <StatCard title="T" value="0" trend={{ value: 15, label: 'vs last month' }} />
    );
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders negative trend', () => {
    renderWithProviders(
      <StatCard title="T" value="0" trend={{ value: -5, label: 'decrease' }} />
    );
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  it('renders numeric value', () => {
    renderWithProviders(<StatCard title="Count" value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
