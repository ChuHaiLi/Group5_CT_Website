/**
 * Unit tests for Footer component
 * Tests rendering of links and contact information
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

// react-router-dom is mocked via __mocks__/react-router-dom.js

describe('Footer', () => {
  test('renders footer with brand name', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText(/wonderai journeys/i)).toBeInTheDocument();
  });

  test('renders quick links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText(/home/i)).toBeInTheDocument();
    expect(screen.getByText(/explore/i)).toBeInTheDocument();
    expect(screen.getByText(/my trips/i)).toBeInTheDocument();
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
    expect(screen.getByText(/profile/i)).toBeInTheDocument();
  });

  test('renders contact information', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText(/contact us/i)).toBeInTheDocument();
    expect(screen.getByText(/hellowonderai@gmail.com/i)).toBeInTheDocument();
  });

  test('renders social media links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const facebookLink = screen.getByLabelText(/facebook/i);
    expect(facebookLink).toBeInTheDocument();
    expect(facebookLink.getAttribute('href')).toContain('facebook.com');
  });
});

