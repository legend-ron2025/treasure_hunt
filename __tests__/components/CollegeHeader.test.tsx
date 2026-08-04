/**
 * Unit tests for CollegeHeader component
 * Validates: Requirements 1.2, 1.3
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

const COLLEGE_NAME = 'RJMMsVishwakamal Mahavidhayal';

describe('CollegeHeader', () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it('always renders the college name text', async () => {
    process.env.NEXT_PUBLIC_COLLEGE_LOGO_URL = 'https://example.com/logo.png';
    const { default: CollegeHeader } = await import('../../components/CollegeHeader');
    render(<CollegeHeader />);
    expect(screen.getByText(COLLEGE_NAME)).toBeInTheDocument();
  });

  it('renders logo img when NEXT_PUBLIC_COLLEGE_LOGO_URL is set to a valid URL', async () => {
    process.env.NEXT_PUBLIC_COLLEGE_LOGO_URL = 'https://example.com/logo.png';
    const { default: CollegeHeader } = await import('../../components/CollegeHeader');
    render(<CollegeHeader />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('does NOT render logo when NEXT_PUBLIC_COLLEGE_LOGO_URL is empty string', async () => {
    process.env.NEXT_PUBLIC_COLLEGE_LOGO_URL = '';
    const { default: CollegeHeader } = await import('../../components/CollegeHeader');
    render(<CollegeHeader />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(COLLEGE_NAME)).toBeInTheDocument();
  });

  it('does NOT render logo when NEXT_PUBLIC_COLLEGE_LOGO_URL is undefined/null', async () => {
    delete process.env.NEXT_PUBLIC_COLLEGE_LOGO_URL;
    const { default: CollegeHeader } = await import('../../components/CollegeHeader');
    render(<CollegeHeader />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(COLLEGE_NAME)).toBeInTheDocument();
  });

  it('hides logo on image load failure (onError)', async () => {
    process.env.NEXT_PUBLIC_COLLEGE_LOGO_URL = 'https://example.com/logo.png';
    const { default: CollegeHeader } = await import('../../components/CollegeHeader');
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
