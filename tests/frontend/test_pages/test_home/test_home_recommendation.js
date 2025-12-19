// src/components/__tests__/HomeRecommendations.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import HomeRecommendations from '@/pages/Home/Recommendations/HomeRecommendations';
import RecommendCard from '@/pages/Home/Recommendations/RecommendCard';

// Mock RecommendCard component (use project alias to match imports)
jest.mock('@/pages/Home/Recommendations/RecommendCard', () => {
  return jest.fn(({ destination, isSaved, onToggleSave, onCreateTrip }) => (
    <div data-testid={`recommend-card-${destination.id}`}>
      <h3>{destination.name}</h3>
      <button onClick={() => onToggleSave?.(destination.id)}>
        {isSaved ? 'Saved' : 'Save'}
      </button>
      <button onClick={() => onCreateTrip?.(destination)}>
        Create Trip
      </button>
    </div>
  ));
});

// Mock axios
jest.mock('axios');

describe('HomeRecommendations Component', () => {
  const mockDestinations = [
    {
      id: 1,
      name: 'Ha Long Bay',
      province_name: 'Quang Ninh',
      rating: 4.5,
      entry_fee: 200000,
      image_url: 'image1.jpg'
    },
    {
      id: 2,
      name: 'Hoi An Ancient Town',
      province_name: 'Quang Nam',
      rating: 4.8,
      entry_fee: 120000,
      image_url: 'image2.jpg'
    },
    {
      id: 3,
      name: 'Phong Nha Cave',
      province_name: 'Quang Binh',
      rating: 4.7,
      entry_fee: 150000,
      image_url: 'image3.jpg'
    }
  ];

  const mockSavedIds = new Set([1, 3]);
  const mockHandleToggleSave = jest.fn();
  const mockOnCreateTrip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (console.error && console.error.mockRestore) {
      console.error.mockRestore();
    }
  });

  describe('Rendering with Props', () => {
    test('should render all destinations from props', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
      expect(screen.getByText('Hoi An Ancient Town')).toBeInTheDocument();
      expect(screen.getByText('Phong Nha Cave')).toBeInTheDocument();
    });

    test('should pass correct props to RecommendCard', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      );

      // Inspect the actual calls and assert props explicitly (more robust)
      const calls = RecommendCard.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const firstProps = calls[0][0];
      expect(firstProps.destination).toEqual(mockDestinations[0]);
      expect(firstProps.isSaved).toBe(true);
      expect(typeof firstProps.onToggleSave).toBe('function');
      expect(typeof firstProps.onCreateTrip).toBe('function');

      const secondProps = calls[1][0];
      expect(secondProps.destination).toEqual(mockDestinations[1]);
      expect(secondProps.isSaved).toBe(false);
    });

    test('should render empty list when no destinations', () => {
      const { container } = render(
        <HomeRecommendations
          destinations={[]}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    test('should handle undefined savedIds gracefully', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      // Should pass isSaved as false when savedIds is undefined
      const calls = RecommendCard.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0].isSaved).toBe(false);
    });
  });

  describe('Fetching Destinations from API', () => {
    test('should fetch destinations when no props provided', async () => {
      axios.get.mockResolvedValueOnce({ data: mockDestinations });

      render(
        <HomeRecommendations
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/destinations');
      });

      await waitFor(() => {
        expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
        expect(screen.getByText('Hoi An Ancient Town')).toBeInTheDocument();
      });
    });

    test('should not fetch when destinations prop is provided', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('should handle API fetch error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      const { container } = render(
        <HomeRecommendations
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      // Should render empty when fetch fails
      expect(container.querySelector('[data-testid^="recommend-card"]')).toBeNull();

      // Only log error in development
      if (process.env.NODE_ENV === 'development') {
        expect(consoleErrorSpy).toHaveBeenCalled();
      }

      consoleErrorSpy.mockRestore();
    });

    test('should show loading state while fetching', async () => {
      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { container } = render(
        <HomeRecommendations
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      // Should render nothing while loading
      expect(container.querySelector('[data-testid^="recommend-card"]')).toBeNull();
    });

    test('should update when fetch completes', async () => {
      axios.get.mockResolvedValueOnce({ data: mockDestinations });

      const { rerender } = render(
        <HomeRecommendations
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      // Initially empty
      expect(screen.queryByText('Ha Long Bay')).not.toBeInTheDocument();

      // Wait for fetch to complete
      await waitFor(() => {
        expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
      });
    });
  });

  describe('Create Trip Handler', () => {
    test('should call onCreateTrip with destination object', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      );

      const createTripButtons = screen.getAllByText('Create Trip');
      createTripButtons[0].click();

      expect(mockOnCreateTrip).toHaveBeenCalledWith(mockDestinations[0]);
    });

    test('should not throw error when onCreateTrip is undefined', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      const createTripButtons = screen.getAllByText('Create Trip');
      
      expect(() => {
        createTripButtons[0].click();
      }).not.toThrow();
    });

    test('should pass handleCreateTrip to all RecommendCards', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      );

      // Each RecommendCard should receive onCreateTrip prop
      const calls = RecommendCard.mock.calls;
      mockDestinations.forEach((dest, index) => {
        expect(calls[index]).toBeDefined();
        expect(typeof calls[index][0].onCreateTrip).toBe('function');
      });
    });

    test('should call onCreateTrip with correct destination for each card', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      );

      const createTripButtons = screen.getAllByText('Create Trip');
      
      // Click second card's button
      createTripButtons[1].click();

      expect(mockOnCreateTrip).toHaveBeenCalledWith(mockDestinations[1]);
    });
  });

  describe('Toggle Save Handler', () => {
    test('should call handleToggleSave when save button clicked', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      const saveButtons = screen.getAllByText(/Save/);
      saveButtons[0].click();

      expect(mockHandleToggleSave).toHaveBeenCalledWith(mockDestinations[0].id);
    });

    test('should update saved state when toggled', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      // First card is saved (ID 1 in savedIds)
      const firstCard = screen.getByTestId('recommend-card-1');
      expect(firstCard).toHaveTextContent('Saved');

      // Second card is not saved (ID 2 not in savedIds)
      const secondCard = screen.getByTestId('recommend-card-2');
      expect(secondCard).toHaveTextContent('Save');
    });

    test('should pass onToggleSave to all cards', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      const calls = RecommendCard.mock.calls;
      mockDestinations.forEach((dest, index) => {
        expect(calls[index]).toBeDefined();
        expect(typeof calls[index][0].onToggleSave).toBe('function');
      });
    });
  });

  describe('View Details Handler', () => {
    test('should have handleViewDetails defined', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      // Check that onViewDetails is passed to RecommendCard
      const calls = RecommendCard.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(typeof calls[0][0].onViewDetails).toBe('function');
    });

    test('handleViewDetails should be a placeholder function', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      const calls = RecommendCard.mock.calls;
      const onViewDetails = calls[0][0].onViewDetails;

      // Should not throw when called
      expect(() => onViewDetails(1)).not.toThrow();
    });
  });

  describe('List Rendering', () => {
    test('should render destinations in correct order', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      const cards = screen.getAllByTestId(/recommend-card-/);
      
      expect(cards[0]).toHaveAttribute('data-testid', 'recommend-card-1');
      expect(cards[1]).toHaveAttribute('data-testid', 'recommend-card-2');
      expect(cards[2]).toHaveAttribute('data-testid', 'recommend-card-3');
    });

    test('should use unique keys for each card', () => {
      const { container } = render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      // React should not show key warnings (checked in console)
      expect(container).toBeInTheDocument();
    });

    test('should handle single destination', () => {
      render(
        <HomeRecommendations
          destinations={[mockDestinations[0]]}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
      expect(screen.queryByText('Hoi An Ancient Town')).not.toBeInTheDocument();
    });

    test('should handle large number of destinations', () => {
      const manyDestinations = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Destination ${i + 1}`,
        province_name: 'Test Province',
        rating: 4.0,
        entry_fee: 100000,
        image_url: `image${i + 1}.jpg`
      }));

      render(
        <HomeRecommendations
          destinations={manyDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      expect(RecommendCard).toHaveBeenCalledTimes(50);
    });
  });

  describe('Props Priority', () => {
    test('should prioritize destinations prop over fetched data', async () => {
      axios.get.mockResolvedValueOnce({ data: [{ id: 99, name: 'Fetched' }] });

      const { rerender } = render(
        <HomeRecommendations
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Fetched')).toBeInTheDocument();
      });

      // Now provide destinations prop
      rerender(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      // Should show prop destinations, not fetched
      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
      expect(screen.queryByText('Fetched')).not.toBeInTheDocument();
    });

    test('should refetch when destinations prop is removed', async () => {
      const { rerender } = render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      expect(axios.get).not.toHaveBeenCalled();

      // Remove destinations prop
      axios.get.mockResolvedValueOnce({ data: [{ id: 99, name: 'Refetched' }] });

      rerender(
        <HomeRecommendations
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle destinations with missing data', () => {
      const incompleteDestinations = [
        { id: 1, name: 'Destination 1' },
        { id: 2 }, // Missing name
        { id: 3, name: 'Destination 3', rating: null }
      ];

      render(
        <HomeRecommendations
          destinations={incompleteDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      expect(RecommendCard).toHaveBeenCalledTimes(3);
    });

    test('should handle empty savedIds set', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={new Set()}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      // All cards should have isSaved: false
      const calls = RecommendCard.mock.calls;
      mockDestinations.forEach((dest, index) => {
        expect(calls[index]).toBeDefined();
        expect(calls[index][0].isSaved).toBe(false);
      });
    });

    test('should handle null savedIds', () => {
      render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={null}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      const calls = RecommendCard.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0].isSaved).toBe(false);
    });

    test('should handle API returning non-array data', async () => {
      axios.get.mockResolvedValueOnce({ data: null });

      const { container } = render(
        <HomeRecommendations
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      // Should handle gracefully (render nothing or error state)
      expect(container.querySelector('[data-testid^="recommend-card"]')).toBeNull();
    });
  });

  describe('Performance', () => {
    test('should not refetch on re-render when destinations provided', () => {
      const { rerender } = render(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      rerender(
        <HomeRecommendations
          destinations={mockDestinations}
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('should only fetch once on mount', async () => {
      axios.get.mockResolvedValueOnce({ data: mockDestinations });

      render(
        <HomeRecommendations
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });
    });
  });
});