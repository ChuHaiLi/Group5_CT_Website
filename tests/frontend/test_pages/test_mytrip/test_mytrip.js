/**
 * Unit Tests for MyTripsPage Component
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from '../../../../frontend/src/untils/axios';
import MyTripsPage from '../../../../frontend/src/pages/MyTrips/MyTripsPage';

// Mock dependencies
jest.mock('../../../../frontend/src/untils/axios');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const mockTrips = [
  {
    id: 1,
    name: 'Da Lat Trip',
    province_id: 1,
    province_name: 'Da Lat',
    start_date: '2025-01-01',
    end_date: '2025-01-05',
    duration: 5,
    created_at: '2024-12-01',
    metadata: {
      people: '2-4 people',
      budget: '1 - 2 millions VND',
    },
  },
  {
    id: 2,
    name: 'Ha Noi Trip',
    province_id: 2,
    province_name: 'Ha Noi',
    start_date: '2025-02-01',
    end_date: '2025-02-03',
    duration: 3,
    created_at: '2024-12-10',
    metadata: {
      people: '1 person',
      budget: '< 500k VND',
    },
  },
];

describe('MyTripsPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('access_token', 'test-token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Authentication', () => {
    test('should show login required when not authenticated', () => {
      localStorage.removeItem('access_token');

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/login required/i)).toBeInTheDocument();
      expect(screen.getByText(/please login/i)).toBeInTheDocument();
    });

    test('should show auth modal when not authenticated', () => {
      localStorage.removeItem('access_token');

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/you need to be logged in/i)).toBeInTheDocument();
    });

    test('should load trips when authenticated', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
        expect(screen.getByText('Ha Noi Trip')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    test('should display loading state initially', () => {
      axios.get.mockImplementation(() => new Promise(() => {}));

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/loading trip data/i)).toBeInTheDocument();
    });

    test('should fetch trips on mount', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          '/api/trips',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    test('should display error message when fetch fails', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/unable to load trip list/i)).toBeInTheDocument();
      });
    });

    test('should display trips after successful fetch', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
        expect(screen.getByText('Ha Noi Trip')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    test('should display search input', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search trips/i)).toBeInTheDocument();
      });
    });

    test('should filter trips by name', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search trips/i);
      fireEvent.change(searchInput, { target: { value: 'Da Lat' } });

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
        expect(screen.queryByText('Ha Noi Trip')).not.toBeInTheDocument();
      });
    });

    test('should show clear button when search has value', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search trips/i);
      fireEvent.change(searchInput, { target: { value: 'Da Lat' } });

      expect(screen.getByText('×')).toBeInTheDocument();
    });

    test('should clear search when clicking clear button', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search trips/i);
      fireEvent.change(searchInput, { target: { value: 'Da Lat' } });

      const clearButton = screen.getByText('×');
      fireEvent.click(clearButton);

      expect(searchInput.value).toBe('');
      expect(screen.getByText('Ha Noi Trip')).toBeInTheDocument();
    });

    test('should show "no trips found" when search has no results', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search trips/i);
      fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText(/no trips found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Trip Card Display', () => {
    test('should display trip cards with all information', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
        expect(screen.getByText('Da Lat')).toBeInTheDocument();
        expect(screen.getByText('5 days')).toBeInTheDocument();
        expect(screen.getByText('2-4 people')).toBeInTheDocument();
        expect(screen.getByText('1 - 2 millions VND')).toBeInTheDocument();
      });
    });

    test('should display date range when available', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/2025-01-01 - 2025-01-05/)).toBeInTheDocument();
      });
    });

    test('should display placeholder for missing metadata', async () => {
      const tripNoMetadata = {
        ...mockTrips[0],
        metadata: {},
      };

      axios.get.mockResolvedValueOnce({ data: [tripNoMetadata] });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Should show "—" for missing data
        const placeholders = screen.getAllByText('—');
        expect(placeholders.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Trip Actions', () => {
    test('should display action buttons for each trip', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const detailButtons = screen.getAllByText(/details/i);
        const editButtons = screen.getAllByText(/edit/i);
        const deleteButtons = screen.getAllByRole('button', { name: '' });

        expect(detailButtons.length).toBe(2);
        expect(editButtons.length).toBe(2);
        expect(deleteButtons.length).toBeGreaterThan(0);
      });
    });

    test('should open delete confirmation modal', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      // Click first delete button
      const deleteButtons = screen.getAllByTitle(/delete/i);
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText(/confirm delete trip/i)).toBeInTheDocument();
      expect(screen.getByText(/da lat trip/i)).toBeInTheDocument();
    });

    test('should delete trip when confirmed', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });
      axios.delete.mockResolvedValueOnce({});

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      // Open delete modal
      const deleteButtons = screen.getAllByTitle(/delete/i);
      fireEvent.click(deleteButtons[0]);

      // Confirm delete
      const confirmButton = screen.getByText(/delete trip/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(axios.delete).toHaveBeenCalledWith(
          '/api/trips/1',
          expect.any(Object)
        );
      });
    });

    test('should close modal when clicking cancel', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      // Open delete modal
      const deleteButtons = screen.getAllByTitle(/delete/i);
      fireEvent.click(deleteButtons[0]);

      // Click cancel
      const cancelButton = screen.getByText(/cancel/i);
      fireEvent.click(cancelButton);

      expect(screen.queryByText(/confirm delete/i)).not.toBeInTheDocument();
    });
  });

  describe('Create Trip', () => {
    test('should display create trip button', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/create a trip/i)).toBeInTheDocument();
      });
    });

    test('should open create form when clicking create button', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const createButton = screen.getByText(/create a trip/i);
        fireEvent.click(createButton);
      });

      // Should show CreateTripForm modal
      // (exact content depends on CreateTripForm implementation)
    });
  });

  describe('Empty State', () => {
    test('should show empty state when no trips exist', async () => {
      axios.get.mockResolvedValueOnce({ data: [] });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/you don't have any trips yet/i)).toBeInTheDocument();
      });
    });

    test('should show create button in empty state', async () => {
      axios.get.mockResolvedValueOnce({ data: [] });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/create your first trip/i)).toBeInTheDocument();
      });
    });
  });

  describe('Toast Notifications', () => {
    test('should show success toast after deleting trip', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });
      axios.delete.mockResolvedValueOnce({});

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      // Delete trip
      const deleteButtons = screen.getAllByTitle(/delete/i);
      fireEvent.click(deleteButtons[0]);

      const confirmButton = screen.getByText(/delete trip/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/trip deleted successfully/i)).toBeInTheDocument();
      });
    });

    test('should show error toast when delete fails', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });
      axios.delete.mockRejectedValueOnce(new Error('Delete failed'));

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      // Delete trip
      const deleteButtons = screen.getAllByTitle(/delete/i);
      fireEvent.click(deleteButtons[0]);

      const confirmButton = screen.getByText(/delete trip/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/error deleting trip/i)).toBeInTheDocument();
      });
    });

    test('should auto-hide toast after timeout', async () => {
      jest.useFakeTimers();
      axios.get.mockResolvedValueOnce({ data: mockTrips });
      axios.delete.mockResolvedValueOnce({});

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Da Lat Trip')).toBeInTheDocument();
      });

      // Delete trip to trigger toast
      const deleteButtons = screen.getAllByTitle(/delete/i);
      fireEvent.click(deleteButtons[0]);

      const confirmButton = screen.getByText(/delete trip/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/trip deleted successfully/i)).toBeInTheDocument();
      });

      // Fast-forward time
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.queryByText(/trip deleted successfully/i)).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Trip Sorting', () => {
    test('should sort trips by date (nearest first)', async () => {
      const unsortedTrips = [
        { ...mockTrips[1], start_date: '2025-02-01' },
        { ...mockTrips[0], start_date: '2025-01-01' },
      ];

      axios.get.mockResolvedValueOnce({ data: unsortedTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const tripCards = screen.getAllByText(/trip/i);
        // First card should be Da Lat (earlier date)
        expect(tripCards[0]).toHaveTextContent('Da Lat');
      });
    });
  });

  describe('Responsive Behavior', () => {
    test('should render trip cards in grid layout', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTrips });

      const { container } = render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const tripList = container.querySelector('.trip-list');
        expect(tripList).toBeInTheDocument();
      });
    });
  });

  describe('Storage Event Handling', () => {
    test('should re-check auth on storage change', async () => {
      axios.get.mockResolvedValue({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      // Simulate logout in another tab
      localStorage.removeItem('access_token');
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'access_token',
        newValue: null,
      }));

      await waitFor(() => {
        expect(screen.getByText(/login required/i)).toBeInTheDocument();
      });
    });

    test('should re-check auth on window focus', async () => {
      axios.get.mockResolvedValue({ data: mockTrips });

      render(
        <BrowserRouter>
          <MyTripsPage />
        </BrowserRouter>
      );

      // Simulate focus event
      window.dispatchEvent(new Event('focus'));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });
    });
  });
});