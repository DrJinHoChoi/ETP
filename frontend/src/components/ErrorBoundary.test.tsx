import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../test/test-utils';
import ErrorBoundary from './ErrorBoundary';

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error message');
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error during tests since we intentionally throw errors
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error', () => {
    renderWithProviders(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders error message when child throws', () => {
    renderWithProviders(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('renders retry button when error occurs', () => {
    renderWithProviders(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('다시 시도')).toBeInTheDocument();
  });

  it('resets error state on retry click', () => {
    let shouldThrow = true;
    function ConditionalThrow() {
      if (shouldThrow) throw new Error('Test error message');
      return <div>Normal content</div>;
    }

    renderWithProviders(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    // Should show error UI
    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();

    // Stop throwing before retry
    shouldThrow = false;

    // Click retry — ErrorBoundary resets state and re-renders children
    fireEvent.click(screen.getByText('다시 시도'));

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    renderWithProviders(
      <ErrorBoundary fallback={<div>Custom Fallback</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
  });
});
