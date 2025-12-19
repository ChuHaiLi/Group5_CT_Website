/**
 * Unit Tests for TripDetailsPage Component
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from '../../../../frontend/src/untils/axios';
import TripDetailsPage from '../../../../frontend/src/pages/MyTrips/TripDetailsPage';

// Mock dependencies
jest.mock('../../../../frontend/src/untils/axios');
jest.mock('react-router-dom', () => ({ 
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ tripId: '123' }),
  useNavigate: () => jest.fn(),
}));

const mockTripData = {
  id: 123,
  name: 'Test Trip to Da Lat',
  province_id: 1,
  province_name: 'Da Lat',
  start_date: '2025-01-01',
  end_date: '2025-01-05',
  duration: 5,
  status: 'planning',
  created_at: '2024-12-01',
  metadata: {
    people: '2-4 people',
    budget: '1 - 2 millions VND',
    hotel: {
      id: 101,
      name: 'Test Hotel',
      type: 'hotel',
      entry_fee: 1500000,
    },
  },
  itinerary: [
    {
      day: 1,
      places: [
        {
          id: 1,
          name: 'Xuan Huong Lake',
          category: 'Địa điểm',
          time_slot: '08:00-10:00',
          duration: 120,
          entry_fee: 0,
        },
        {
          id: 'LUNCH',
          name: 'Ăn trưa',
          category: 'Ăn uống',
          time_slot: '12:00-13:00',
          duration: 60,
        },
        {
          id: 'TRAVEL',
          name: 'Di chuyển',
          category: 'Di chuyển',
          time_slot: '13:00-13:30',
          duration: 30,
        },
        {
          id: 2,
          name: 'Dalat Flower Garden',
          category: 'Địa điểm',
          time_slot: '14:00-16:00',
          duration: 120,
          entry_fee: 50000,
        },
        {
          id: 101,
          name: 'Test Hotel',
          type: 'hotel',
          is_accommodation: true,
          category: 'Khách sạn',
          time_slot: '21:00',
        },
      ],
    },
    {
      day: 2,
      places: [
        {
          id: 3,
          name: 'Langbiang Mountain',
          category: 'Địa điểm',
          time_slot: '08:00-12:00',
          duration: 240,
          entry_fee: 100000,
        },
      ],
    },
  ],
};

describe('TripDetailsPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('access_token', 'test-token');
  });

  describe('Data Loading', () => {
    test('should display loading state initially', () => {
      axios.get.mockImplementation(() => new Promise(() => {}));

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/loading trip details/i)).toBeInTheDocument();
    });

    test('should fetch trip details on mount', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/trips/123'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    test('should display error when fetch fails', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/no trip found/i)).toBeInTheDocument();
      });
    });

    test('should display trip data after successful fetch', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Trip to Da Lat')).toBeInTheDocument();
        expect(screen.getByText('Da Lat')).toBeInTheDocument();
      });
    });
  });

  describe('Trip Header', () => {
    test('should display trip name', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Trip to Da Lat')).toBeInTheDocument();
      });
    });

    test('should display status badge', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('planning')).toBeInTheDocument();
      });
    });

    test('should display edit button', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/edit trip/i)).toBeInTheDocument();
      });
    });

    test('should display back button', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/return to my trips/i)).toBeInTheDocument();
      });
    });
  });

  describe('Info Bar', () => {
    test('should display location', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Location')).toBeInTheDocument();
        expect(screen.getByText('Da Lat')).toBeInTheDocument();
      });
    });

    test('should display start date', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Start Date')).toBeInTheDocument();
        expect(screen.getByText('2025-01-01')).toBeInTheDocument();
      });
    });

    test('should display end date', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('End Date')).toBeInTheDocument();
        expect(screen.getByText('2025-01-05')).toBeInTheDocument();
      });
    });

    test('should display duration', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Duration')).toBeInTheDocument();
        expect(screen.getByText('5 days')).toBeInTheDocument();
      });
    });

    test('should display people count', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Number of People')).toBeInTheDocument();
        expect(screen.getByText('2-4 people')).toBeInTheDocument();
      });
    });

    test('should display budget', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Budget')).toBeInTheDocument();
        expect(screen.getByText('1 - 2 millions VND')).toBeInTheDocument();
      });
    });

    test('should show placeholder for missing metadata', async () => {
      const tripNoMetadata = {
        ...mockTripData,
        metadata: {},
      };

      axios.get.mockResolvedValueOnce({ data: tripNoMetadata });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const placeholders = screen.getAllByText('—');
        expect(placeholders.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Primary Accommodation', () => {
    test('should display hotel information', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Primary Residence')).toBeInTheDocument();
        expect(screen.getByText('Test Hotel')).toBeInTheDocument();
      });
    });

    test('should show message when no hotel selected', async () => {
      const tripNoHotel = {
        ...mockTripData,
        metadata: { ...mockTripData.metadata, hotel: null },
        itinerary: mockTripData.itinerary.map(day => ({
          ...day,
          places: day.places.filter(p => !p.is_accommodation),
        })),
      };

      axios.get.mockResolvedValueOnce({ data: tripNoHotel });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/no primary residence/i)).toBeInTheDocument();
      });
    });

    test('should allow viewing hotel details', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const viewButton = screen.getByText(/view details/i);
        expect(viewButton).toBeInTheDocument();
      });
    });
  });

  describe('Itinerary Display', () => {
    test('should display all days', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/day 1/i)).toBeInTheDocument();
        expect(screen.getByText(/day 2/i)).toBeInTheDocument();
      });
    });

    test('should display destinations', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Xuan Huong Lake')).toBeInTheDocument();
        expect(screen.getByText('Dalat Flower Garden')).toBeInTheDocument();
        expect(screen.getByText('Langbiang Mountain')).toBeInTheDocument();
      });
    });

    test('should display lunch items', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Ăn trưa')).toBeInTheDocument();
      });
    });

    test('should display travel items', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Di chuyển')).toBeInTheDocument();
      });
    });

    test('should not display hotel in itinerary (filtered out)', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Hotel should be in Primary Accommodation section only
        const hotelTexts = screen.getAllByText('Test Hotel');
        // Should only appear once in Primary Accommodation section
        expect(hotelTexts.length).toBe(1);
      });
    });

    test('should display time slots', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/08:00-10:00/)).toBeInTheDocument();
        expect(screen.getByText(/12:00-13:00/)).toBeInTheDocument();
      });
    });
  });

  describe('Destination Preview', () => {
    test('should show placeholder when no destination selected', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/click on the location name/i)).toBeInTheDocument();
      });
    });

    test('should fetch destination details when clicking on place', async () => {
      const mockDestination = {
        id: 1,
        name: 'Xuan Huong Lake',
        description: 'Beautiful lake in Da Lat',
        images: ['lake.jpg'],
        opening_hours: '24/7',
        entry_fee: 0,
      };

      axios.get.mockResolvedValueOnce({ data: mockTripData });
      axios.get.mockResolvedValueOnce({ data: mockDestination });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const placeButton = screen.getByText('Xuan Huong Lake');
        fireEvent.click(placeButton);
      });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          '/api/destinations/1',
          expect.any(Object)
        );
      });
    });

    test('should display loading state when fetching destination', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });
      axios.get.mockImplementation(() => new Promise(() => {}));

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const placeButton = screen.getByText('Xuan Huong Lake');
        fireEvent.click(placeButton);
      });

      expect(screen.getByText(/loading information/i)).toBeInTheDocument();
    });

    test('should display destination details after fetch', async () => {
      const mockDestination = {
        id: 1,
        name: 'Xuan Huong Lake',
        description: 'Beautiful lake in Da Lat',
        images: ['lake.jpg'],
        opening_hours: '24/7',
        entry_fee: 0,
        type: 'Natural Attraction',
      };

      axios.get.mockResolvedValueOnce({ data: mockTripData });
      axios.get.mockResolvedValueOnce({ data: mockDestination });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const placeButton = screen.getByText('Xuan Huong Lake');
        fireEvent.click(placeButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Beautiful lake in Da Lat')).toBeInTheDocument();
        expect(screen.getByText('24/7')).toBeInTheDocument();
        expect(screen.getByText(/free/i)).toBeInTheDocument();
      });
    });

    test('should handle destination fetch error', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });
      axios.get.mockRejectedValueOnce(new Error('Fetch failed'));

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const placeButton = screen.getByText('Xuan Huong Lake');
        fireEvent.click(placeButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/không thể tải thông tin/i)).toBeInTheDocument();
      });
    });

    test('should show "see full details" button', async () => {
      const mockDestination = {
        id: 1,
        name: 'Xuan Huong Lake',
        description: 'Beautiful lake',
        images: ['lake.jpg'],
      };

      axios.get.mockResolvedValueOnce({ data: mockTripData });
      axios.get.mockResolvedValueOnce({ data: mockDestination });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const placeButton = screen.getByText('Xuan Huong Lake');
        fireEvent.click(placeButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/see full details/i)).toBeInTheDocument();
      });
    });

    test('should not fetch details for LUNCH items', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const lunchButton = screen.getByText('Ăn trưa');
        fireEvent.click(lunchButton);
      });

      // Should not make additional API call
      expect(axios.get).toHaveBeenCalledTimes(1); // Only initial trip fetch
    });

    test('should not fetch details for TRAVEL items', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const travelButton = screen.getByText('Di chuyển');
        fireEvent.click(travelButton);
      });

      // Should not make additional API call
      expect(axios.get).toHaveBeenCalledTimes(1); // Only initial trip fetch
    });
  });

  describe('Price Formatting', () => {
    test('should format prices correctly', async () => {
      const mockDestination = {
        id: 2,
        name: 'Dalat Flower Garden',
        entry_fee: 50000,
      };

      axios.get.mockResolvedValueOnce({ data: mockTripData });
      axios.get.mockResolvedValueOnce({ data: mockDestination });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const placeButton = screen.getByText('Dalat Flower Garden');
        fireEvent.click(placeButton);
      });

      await waitFor(() => {
        // Should show formatted price
        expect(screen.getByText(/50/)).toBeInTheDocument();
      });
    });

    test('should show "Free" for zero price', async () => {
      const mockDestination = {
        id: 1,
        name: 'Xuan Huong Lake',
        entry_fee: 0,
      };

      axios.get.mockResolvedValueOnce({ data: mockTripData });
      axios.get.mockResolvedValueOnce({ data: mockDestination });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const placeButton = screen.getByText('Xuan Huong Lake');
        fireEvent.click(placeButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/free/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle trip with no itinerary', async () => {
      const tripNoItinerary = {
        ...mockTripData,
        itinerary: [],
      };

      axios.get.mockResolvedValueOnce({ data: tripNoItinerary });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Trip to Da Lat')).toBeInTheDocument();
      });
    });

    test('should handle trip with no metadata', async () => {
      const tripNoMetadata = {
        ...mockTripData,
        metadata: null,
      };

      axios.get.mockResolvedValueOnce({ data: tripNoMetadata });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Trip to Da Lat')).toBeInTheDocument();
      });
    });

    test('should handle missing dates', async () => {
      const tripNoDates = {
        ...mockTripData,
        start_date: null,
        end_date: null,
      };

      axios.get.mockResolvedValueOnce({ data: tripNoDates });

      render(
        <BrowserRouter>
          <TripDetailsPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/not specified/i)).toBeInTheDocument();
      });
    });
  });
});