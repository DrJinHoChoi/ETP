import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import Modal from './Modal';

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not open', () => {
    renderWithProviders(
      <Modal open={false} onClose={onClose}>Content</Modal>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders children when open', () => {
    renderWithProviders(
      <Modal open={true} onClose={onClose}>Modal Content</Modal>
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('renders title', () => {
    renderWithProviders(
      <Modal open={true} onClose={onClose} title="My Modal">Content</Modal>
    );
    expect(screen.getByText('My Modal')).toBeInTheDocument();
  });

  it('renders footer', () => {
    renderWithProviders(
      <Modal open={true} onClose={onClose} footer={<button>Save</button>}>Content</Modal>
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const { container } = renderWithProviders(
      <Modal open={true} onClose={onClose}>Content</Modal>
    );
    const backdrop = container.querySelector('.bg-black\\/50');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    renderWithProviders(
      <Modal open={true} onClose={onClose}>Content</Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders close button in title header', () => {
    renderWithProviders(
      <Modal open={true} onClose={onClose} title="Title">Content</Modal>
    );
    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
