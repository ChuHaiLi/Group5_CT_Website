/**
 * Unit tests for PrivateRoute component
 * Tests authentication-based routing logic
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivateRoute from '../PrivateRoute';

// react-router-dom is mocked via __mocks__/react-router-dom.js

describe('PrivateRoute', () => {
  test('renders children when authenticated', () => {
    render(
      <MemoryRouter>
        <PrivateRoute isAuthenticated={true}>
          <div>Protected Content</div>
        </PrivateRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('redirects to login when not authenticated', () => {
    render(
      <MemoryRouter>
        <PrivateRoute isAuthenticated={false}>
          <div>Protected Content</div>
        </PrivateRoute>
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate).toBeInTheDocument();
    expect(navigate.getAttribute('data-to')).toBe('/login');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('redirects when authentication status is null (falsy)', () => {
    render(
      <MemoryRouter>
        <PrivateRoute isAuthenticated={null}>
          <div>Protected Content</div>
        </PrivateRoute>
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate).toBeInTheDocument();
    expect(navigate.getAttribute('data-to')).toBe('/login');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
