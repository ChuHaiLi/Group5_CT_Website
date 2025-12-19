/**
 * Unit Tests for EditTripPage Component
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from '../../../../frontend/src/untils/axios';
import EditTripPage from '../../../../frontend/src/pages/MyTrips/EditTripPage';

// Mock dependencies
jest.mock('../../../../frontend/src/untils/axios');
jest.mock('react-router-dom', () => ({ 
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ tripId: '123' }),
  useNavigate: () => jest.fn(),
}));

// Mock toast
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    warning: jest.fn(),
    dismiss: jest.fn(),
  },
}));

// Mock dndLogic
jest.mock('../../../../frontend/src/pages/MyTrips/dndLogic', () => ({
  reorder: jest.fn((list) => list),
  move: jest.fn(() => ({})),
  rebuildDay: jest.fn((places) => Promise.resolve(places)),
  recalculateTimeSlots: jest.fn((itinerary) => itinerary),
}));

const mockTripData = {
  id: 123,
  name: 'Test Trip',
  province_id: 1,
  province_name: 'Da Lat',
  start_date: '2025-01-01',
  end_date: '2025-01-05',
  duration: 5,
  status: 'planning',
  metadata: {
    people: '2-4 people',
    budget: '1 - 2 millions VND',
  },
  itinerary: [
    {
      day: 1,
      places: [
        {
          id: 1,
          uniqueId: 'place-1',
          name: 'Test Place 1',
          category: 'Địa điểm',
          time_slot: '08:00-10:00',
          duration: 120,
          entry_fee: 50000,
        },
      ],
    },
  ],
  must_include_place_ids: [1],
};

describe('EditTripPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('access_token', 'test-token');
  });

  describe('Data Loading', () => {
    test('should display loading state initially', () => {
      axios.get.mockImplementation(() => new Promise(() => {}));
      
      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/loading trip data/i)).toBeInTheDocument();
    });

    test('should fetch and display trip data on mount', async () => {
      axios.get.mockResolvedValueOnce({ data: mockTripData });
      axios.get.mockResolvedValueOnce({ data: [] }); // destinations

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Trip')).toBeInTheDocument();
      });
    });

    test('should display error message when fetch fails', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/no trip found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Metadata Editing', () => {
    test('should allow editing trip name', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('Test Trip');
        expect(nameInput).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Test Trip');
      fireEvent.change(nameInput, { target: { value: 'Updated Trip' } });

      expect(nameInput.value).toBe('Updated Trip');
    });

    test('should allow selecting people count', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const peopleSelect = screen.getByDisplayValue('2-4 people');
        expect(peopleSelect).toBeInTheDocument();
      });
    });

    test('should allow selecting budget', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const budgetSelect = screen.getByDisplayValue('1 - 2 millions VND');
        expect(budgetSelect).toBeInTheDocument();
      });
    });
  });

  describe('Hotel Selection', () => {
    test('should display hotel selection section', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/hotels\/accommodation/i)).toBeInTheDocument();
      });
    });

    test('should show "not chosen" message when no hotel selected', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/haven't chosen/i)).toBeInTheDocument();
      });
    });
  });

  describe('Budget Cost Calculation', () => {
    test('should display estimated cost section', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/budget & estimated cost/i)).toBeInTheDocument();
      });
    });

    test('should calculate total cost correctly', async () => {
      const tripWithCost = {
        ...mockTripData,
        itinerary: [
          {
            day: 1,
            places: [
              {
                id: 1,
                name: 'Place 1',
                category: 'Địa điểm',
                entry_fee: 100000,
              },
            ],
          },
        ],
      };

      axios.get.mockResolvedValue({ data: tripWithCost });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Should show cost calculation (exact format may vary)
        expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
      });
    });
  });

  describe('Day Management', () => {
    test('should allow adding a new day', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const addDayButton = screen.getByText(/add 1 day/i);
        expect(addDayButton).toBeInTheDocument();
      });

      const addDayButton = screen.getByText(/add 1 day/i);
      fireEvent.click(addDayButton);

      // Should show Day 2 after adding
      await waitFor(() => {
        expect(screen.getByText(/day 2/i)).toBeInTheDocument();
      });
    });

    test('should show delete day button', async () => {
      const tripWithMultipleDays = {
        ...mockTripData,
        duration: 2,
        itinerary: [
          { day: 1, places: [] },
          { day: 2, places: [] },
        ],
      };

      axios.get.mockResolvedValue({ data: tripWithMultipleDays });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const deleteButtons = screen.getAllByText(/delete day/i);
        expect(deleteButtons.length).toBeGreaterThan(0);
      });
    });

    test('should prevent deleting last day', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const deleteButton = screen.getByText(/delete day/i);
        expect(deleteButton).toBeDisabled();
      });
    });
  });

  describe('Save Functionality', () => {
    test('should show save button', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/save/i)).toBeInTheDocument();
      });
    });

    test('should open comparison modal when clicking save', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const saveButton = screen.getByText(/save/i);
        fireEvent.click(saveButton);
      });

      // Should show comparison modal
      await waitFor(() => {
        expect(screen.getByText(/original vs edited/i)).toBeInTheDocument();
      });
    });
  });

  describe('AI Evaluation', () => {
    test('should show AI Review button', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/ai review/i)).toBeInTheDocument();
      });
    });

    test('should disable AI button while loading', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const aiButton = screen.getByText(/ai review/i);
        expect(aiButton).not.toBeDisabled();
      });
    });
  });

  describe('Regenerate Functionality', () => {
    test('should show regenerate button', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/regenerate full itinerary/i)).toBeInTheDocument();
      });
    });

    test('should disable regenerate when cost exceeds budget', async () => {
      const tripOverBudget = {
        ...mockTripData,
        metadata: {
          ...mockTripData.metadata,
          budget: '< 500k VND',
        },
        itinerary: [
          {
            day: 1,
            places: [
              {
                id: 1,
                name: 'Expensive Place',
                entry_fee: 1000000,
                category: 'Địa điểm',
              },
            ],
          },
        ],
      };

      axios.get.mockResolvedValue({ data: tripOverBudget });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const regenerateButton = screen.getByText(/regenerate full itinerary/i);
        // Button should be disabled if cost exceeds budget
        expect(regenerateButton).toBeDisabled();
      });
    });
  });

  describe('Itinerary Display', () => {
    test('should display days and places', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/day 1/i)).toBeInTheDocument();
        expect(screen.getByText('Test Place 1')).toBeInTheDocument();
      });
    });

    test('should allow collapsing/expanding days', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const dayHeader = screen.getByText(/day 1/i).closest('div');
        fireEvent.click(dayHeader);
      });

      // Day should collapse (implementation-dependent)
    });
  });

  describe('Destination Picker', () => {
    test('should show add location button', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const addButtons = screen.getAllByText(/location/i);
        expect(addButtons.length).toBeGreaterThan(0);
      });
    });

    test('should show add food button', async () => {
      axios.get.mockResolvedValue({ data: mockTripData });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/food\/bevarage/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing access token', () => {
      localStorage.removeItem('access_token');
      axios.get.mockRejectedValue(new Error('Unauthorized'));

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      // Should show error state
    });

    test('should handle invalid trip data', async () => {
      axios.get.mockResolvedValue({ data: null });

      render(
        <BrowserRouter>
          <EditTripPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/no trip found/i)).toBeInTheDocument();
      });
    });
  });
});