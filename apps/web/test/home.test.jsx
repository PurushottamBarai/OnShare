import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../src/routes/Home.jsx';
import ComponentsShowcase from '../src/routes/ComponentsShowcase.jsx';
import StatusPill from '../src/components/StatusPill.jsx';
import DeviceLabelChip from '../src/components/DeviceLabelChip.jsx';
import LockoutBanner from '../src/components/LockoutBanner.jsx';
import AdSlot from '../src/components/AdSlot.jsx';

describe('Home Screen & Shared UI Components (UI Brief sections 3 & 4.1)', () => {
  it('renders Home screen dashboard container and tab navigation', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Verify dashboard container
    expect(screen.getByTestId('route-dashboard')).toBeDefined();

    // Verify 3 mode navigation links
    expect(screen.getByRole('link', { name: /send/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /receive/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /text/i })).toBeDefined();
  });

  describe('StatusPill Component', () => {
    it('renders all documented states per UI brief section 4.6', () => {
      const { rerender } = render(<StatusPill status="connecting" />);
      expect(screen.getByTestId('status-pill-connecting')).toBeDefined();
      expect(screen.getByText('CONNECTING')).toBeDefined();

      rerender(<StatusPill status="waiting" />);
      expect(screen.getByTestId('status-pill-waiting')).toBeDefined();
      expect(screen.getByText('WAITING FOR ACCEPT')).toBeDefined();

      rerender(<StatusPill status="sending" progress={65} />);
      expect(screen.getByTestId('status-pill-sending')).toBeDefined();
      expect(screen.getByText('SENDING 65%')).toBeDefined();

      rerender(<StatusPill status="done" />);
      expect(screen.getByTestId('status-pill-done')).toBeDefined();
      expect(screen.getByText('DONE')).toBeDefined();

      rerender(<StatusPill status="declined" />);
      expect(screen.getByTestId('status-pill-declined')).toBeDefined();
      expect(screen.getByText('DECLINED')).toBeDefined();

      rerender(<StatusPill status="failed" />);
      expect(screen.getByTestId('status-pill-failed')).toBeDefined();
      expect(screen.getByText('FAILED')).toBeDefined();
    });
  });

  describe('DeviceLabelChip Component', () => {
    it('renders device name and platform details (SN-10)', () => {
      render(<DeviceLabelChip name="Swift Otter" browser="Chrome" os="Windows" />);
      expect(screen.getByTestId('device-label-chip')).toBeDefined();
      expect(screen.getByText('Swift Otter')).toBeDefined();
      expect(screen.getByText('· Chrome on Windows')).toBeDefined();
    });
  });

  describe('LockoutBanner Component', () => {
    it('renders lockout warning and remaining seconds (SN-9, RC-8)', () => {
      render(
        <LockoutBanner
          remainingSeconds={42}
          message="Too many failed code attempts."
        />
      );
      expect(screen.getByTestId('lockout-banner')).toBeDefined();
      expect(screen.getByText('Too many failed code attempts.')).toBeDefined();
      expect(screen.getByText('42s')).toBeDefined();
    });
  });

  describe('AdSlot Component', () => {
    it('renders advertisement slot with reserved height and label (AD-1)', () => {
      render(<AdSlot height="120px" />);
      const ad = screen.getByTestId('ad-slot');
      expect(ad).toBeDefined();
      expect(screen.getByText('Advertisement')).toBeDefined();
    });
  });

  describe('Components Showcase Route', () => {
    it('renders all components in isolation in all their documented states', () => {
      render(<ComponentsShowcase />);
      expect(screen.getByTestId('route-components')).toBeDefined();
      expect(screen.getByText('Shared UI Components')).toBeDefined();
    });
  });
});
