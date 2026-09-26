import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

describe('App Route Shells', () => {
  const routes = [
    { path: '/' },
    { path: '/send' },
    { path: '/receive' },
    { path: '/text' },
    { path: '/how-it-works' },
    { path: '/privacy' },
    { path: '/terms' },
    { path: '/contact' },
    { path: '/feedback' },
  ];

  routes.forEach(({ path }) => {
    it(`renders page for route ${path}`, async () => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      );

      const el = await screen.findByRole('main');
      expect(el).toBeDefined();
    });
  });
});
