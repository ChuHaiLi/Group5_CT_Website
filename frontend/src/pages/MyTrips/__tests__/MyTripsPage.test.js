/**
 * Unit tests for MyTripsPage component
 * Tests trip loading, display, and error handling
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyTripsPage from '../MyTripsPage';
import axios from 'axios';

// react-router-dom is mocked via __mocks__/react-router-dom.js
const reactRouterDom = require('react-router-dom');
const mockNavigate = reactRouterDom.__mockNavigate;

// Mock CreateTripForm - use correct path from MyTripsPage location
jest.mock('../../components/CreateTripForm', () => {
  const React = require('react');
  return ({ onTripCreated, onClose }) => (
    <div data-testid="create-trip-form">
      <button onClick={onClose}>Close</button>
    </div>
  );
});

describe('MyTripsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Set up localStorage to return token
    localStorage.getItem = jest.fn((key) => {
      if (key === 'access_token') return 'mock-token';
      return null;
    });
    // Use axios from global mock in setupTests.js
    axios.get.mockClear();
    axios.delete.mockClear();
  });

  test('renders loading state initially', async () => {
    axios.get.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      render(
        <MemoryRouter>
          <MyTripsPage />
        </MemoryRouter>
      );
    });

    expect(screen.getByText(/đang tải dữ liệu chuyến đi/i)).toBeInTheDocument();
  });

  test('renders trips list when API returns data', async () => {
    const mockTrips = [
      {
        id: 1,
        name: 'Trip to Hanoi',
        duration: 3,
        province_name: 'Hà Nội',
        start_date: '2024-01-01',
      },
      {
        id: 2,
        name: 'Trip to Ho Chi Minh',
        duration: 5,
        province_name: 'Hồ Chí Minh',
        start_date: '2024-02-01',
      },
    ];

    axios.get.mockResolvedValueOnce({
      data: mockTrips,
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <MyTripsPage />
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Trip to Hanoi')).toBeInTheDocument();
      expect(screen.getByText('Trip to Ho Chi Minh')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('renders error message when API fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(
        <MemoryRouter>
          <MyTripsPage />
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/không thể tải danh sách chuyến đi/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('renders empty state when no trips', async () => {
    axios.get.mockResolvedValueOnce({
      data: [],
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <MyTripsPage />
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/bạn chưa có chuyến đi nào/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('calls API with correct headers', async () => {
    axios.get.mockResolvedValueOnce({
      data: [],
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <MyTripsPage />
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/trips', {
        headers: { Authorization: 'Bearer mock-token' },
      });
    }, { timeout: 3000 });
  });
});
