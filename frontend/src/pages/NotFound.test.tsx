import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../test/test-utils';
import NotFound from './NotFound';

describe('NotFound', () => {
  it('renders 404 text', () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders error message', () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByText('페이지를 찾을 수 없습니다')).toBeInTheDocument();
  });

  it('renders description text', () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByText(/요청하신 페이지가 존재하지 않거나/)).toBeInTheDocument();
  });

  it('renders link to dashboard', () => {
    renderWithProviders(<NotFound />);
    const link = screen.getByText('대시보드로 이동');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });
});
