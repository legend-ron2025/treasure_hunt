/**
 * Unit tests for CollegeHeader component
 * Validates: Requirements 1.2, 1.3
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CollegeHeader, { COLLEGE_NAME } from '../../components/CollegeHeader';

// Mock next/image so we can control src/alt/onError in jsdom
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    onError,
  }: {
    src: string;
    alt: string;
    onError?: React.ReactEventHandler<HTMLImageElement>;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} />
  ),
}));

describe('CollegeHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('always renders the college name text', () => {
    render(<CollegeHeader />);
    expect(screen.getByText(COLLEGE_NAME)).toBeInTheDocument();
  });

  it('renders logo img by default', () => {
    render(<CollegeHeader />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', `${COLLEGE_NAME} logo`);
  });

  it('hides logo on image load failure (onError)', () => {
    render(<CollegeHeader />);

    // Initially the image should be visible
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();

    // Simulate image load failure
    fireEvent.error(img);

    // After error, image should be removed and name should still show
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(COLLEGE_NAME)).toBeInTheDocument();
  });
});
