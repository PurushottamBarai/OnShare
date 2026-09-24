import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

describe('App Route Shells', () => {
  const routes = [
    { path: '/', testId: 'route-home' },
    { path: '/send', testId: 'route-send' },
    { path: '/receive', testId: 'route-receive' },
    { path: '/text', testId: 'route-text' },
    { path: '/how-it-works', testId: 'route-how-it-works' },
    { path: '/privacy', testId: 'route-privacy' },
    { path: '/terms', testId: 'route-terms' },
    { path: '/contact', testId: 'route-contact' },
    { path: '/report-abuse', testId: 'route-report-abuse' },
  ];

  routes.forEach(({ path, testId }) => {
    it(`renders placeholder for route ${path}`, async () => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      );

      const el = await screen.findByTestId(testId);
      expect(el).toBeDefined();
    });
  });
});
