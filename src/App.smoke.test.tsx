import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App (scaffold smoke test)', () => {
  it('renders the VimRace title', () => {
    render(<App />);
    expect(screen.getByText('VimRace')).toBeInTheDocument();
  });
});
