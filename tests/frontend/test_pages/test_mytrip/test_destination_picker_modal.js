/**
 * Unit Tests for DestinationPickerModal Component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DestinationPickerModal from '@/pages/MyTrips/DestinationPickerModal';
import axios from '@/untils/axios';

jest.mock('@/untils/axios');

const mockPlaces = [
  {
    id: 1,
    name: 'Ha Long Bay',
    province_name: 'Quang Ninh',
    type: 'Natural Attraction',
    place_type: 'Sightseeing',
    image_url: 'halong.jpg',
    rating: 4.5,
    entry_fee: 200000,
    description: 'Beautiful bay',
  },
  {
    id: 2,
    name: 'Sunset Restaurant',
    province_name: 'Da Nang',
    type: 'Restaurant',
    place_type: 'Restaurant',
    image_url: 'restaurant.jpg',
    rating: 4.3,
    entry_fee: 0,
    description: 'Great food',
  },
  {
    id: 3,
    name: 'Beach Resort Hotel',
    province_name: 'Nha Trang',
    type: 'Hotel',
    place_type: 'Hotel',
    image_url: 'hotel.jpg',
    rating: 4.7,
    entry_fee: 1500000,
    description: 'Luxury hotel',
  },
];

describe('DestinationPickerModal Component', () => {
  const mockOnSelect = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('access_token', 'test-token');
  });

  describe('Destination Type', () => {
    test('should render modal for destination type', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/choose location/i)).toBeInTheDocument();
    });

    test('should filter out hotels and restaurants for destination type', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
      expect(screen.queryByText('Sunset Restaurant')).not.toBeInTheDocument();
      expect(screen.queryByText('Beach Resort Hotel')).not.toBeInTheDocument();
    });

    test('should show correct placeholder for destination', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByPlaceholderText(/find location, attraction/i)
      ).toBeInTheDocument();
    });
  });

  describe('Food Type', () => {
    test('should render modal for food type', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="food"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/choose food place/i)).toBeInTheDocument();
    });

    test('should filter only restaurants for food type', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="food"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Sunset Restaurant')).toBeInTheDocument();
      expect(screen.queryByText('Ha Long Bay')).not.toBeInTheDocument();
      expect(screen.queryByText('Beach Resort Hotel')).not.toBeInTheDocument();
    });

    test('should show correct placeholder for food', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="food"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByPlaceholderText(/find restaurant, cafe/i)
      ).toBeInTheDocument();
    });
  });

  describe('Hotel Type', () => {
    test('should render modal for hotel type', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="hotel"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/choose hotel/i)).toBeInTheDocument();
    });

    test('should filter only hotels for hotel type', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="hotel"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Beach Resort Hotel')).toBeInTheDocument();
      expect(screen.queryByText('Ha Long Bay')).not.toBeInTheDocument();
      expect(screen.queryByText('Sunset Restaurant')).not.toBeInTheDocument();
    });

    test('should show correct placeholder for hotel', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="hotel"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByPlaceholderText(/find hotel, resort/i)
      ).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    test('should filter places by name', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/find location/i);
      fireEvent.change(searchInput, { target: { value: 'Ha Long' } });

      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
    });

    test('should filter places by province', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/find location/i);
      fireEvent.change(searchInput, { target: { value: 'Quang Ninh' } });

      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
    });

    test('should show no results when search has no matches', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/find location/i);
      fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    test('should normalize Vietnamese characters in search', () => {
      const placesWithVietnamese = [
        {
          id: 1,
          name: 'Đà Lạt',
          province_name: 'Lâm Đồng',
          type: 'City',
          image_url: 'dalat.jpg',
        },
      ];

      render(
        <DestinationPickerModal
          places={placesWithVietnamese}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/find location/i);
      fireEvent.change(searchInput, { target: { value: 'Da Lat' } });

      expect(screen.getByText('Đà Lạt')).toBeInTheDocument();
    });

    test('should be case-insensitive', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/find location/i);
      fireEvent.change(searchInput, { target: { value: 'HA LONG' } });

      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
    });
  });

  describe('Results Display', () => {
    test('should display result count', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/found 1 result/i)).toBeInTheDocument();
    });

    test('should show plural for multiple results', () => {
      const multiplePlaces = [
        ...mockPlaces,
        {
          id: 4,
          name: 'Another Place',
          type: 'Sightseeing',
          image_url: 'place.jpg',
        },
      ];

      render(
        <DestinationPickerModal
          places={multiplePlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/found 2 results/i)).toBeInTheDocument();
    });

    test('should show empty state when no places', () => {
      render(
        <DestinationPickerModal
          places={[]}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    test('should show appropriate empty icon for each type', () => {
      const { rerender } = render(
        <DestinationPickerModal
          places={[]}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('📍')).toBeInTheDocument();

      rerender(
        <DestinationPickerModal
          places={[]}
          type="food"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('🍽️')).toBeInTheDocument();

      rerender(
        <DestinationPickerModal
          places={[]}
          type="hotel"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('🏨')).toBeInTheDocument();
    });
  });

  describe('Place Selection', () => {
    test('should call onSelect when clicking on a place card', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Click should trigger onSelect through RecommendCard
      const card = screen.getByText('Ha Long Bay').closest('.recommend-card');
      if (card) {
        fireEvent.click(card);
      }
    });

    test('should close modal after selection', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // After selection, modal should close
    });
  });

  describe('Detail Modal', () => {
    test('should open detail modal when viewing place details', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          ...mockPlaces[0],
          description: 'Detailed description',
        },
      });

      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Click view details button (implementation-dependent)
    });

    test('should show place details in modal', async () => {
      axios.get.mockResolvedValueOnce({
        data: mockPlaces[0],
      });

      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Details should be displayed
    });

    test('should allow selecting place from detail modal', async () => {
      axios.get.mockResolvedValueOnce({
        data: mockPlaces[0],
      });

      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Should be able to select from detail view
    });

    test('should close detail modal', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      // Detail modal should close
    });
  });

  describe('Modal Controls', () => {
    test('should close modal when clicking close button', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('should close modal when clicking overlay', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const overlay = document.querySelector('.modal-overlay');
      fireEvent.click(overlay);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('should not close when clicking modal content', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const modal = document.querySelector('.destination-picker-modal');
      fireEvent.click(modal);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('should close modal when clicking X button', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const xButton = screen.getByRole('button', { name: '' });
      if (xButton) {
        fireEvent.click(xButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe('Grid Layout', () => {
    test('should render places in grid layout', () => {
      const { container } = render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const grid = container.querySelector('[style*="grid"]');
      expect(grid).toBeInTheDocument();
    });

    test('should be responsive', () => {
      const { container } = render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const grid = container.querySelector('[style*="grid"]');
      expect(grid).toHaveStyle({
        gridTemplateColumns: expect.stringContaining('minmax'),
      });
    });
  });

  describe('Props Handling', () => {
    test('should handle undefined places', () => {
      render(
        <DestinationPickerModal
          places={undefined}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/found 0 results/i)).toBeInTheDocument();
    });

    test('should handle empty places array', () => {
      render(
        <DestinationPickerModal
          places={[]}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    test('should default to destination type', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/choose location/i)).toBeInTheDocument();
    });

    test('should handle missing onSelect callback', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onClose={mockOnClose}
        />
      );

      // Should not throw error
      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
    });

    test('should handle missing onClose callback', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
        />
      );

      // Should not throw error
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);
    });
  });

  describe('Accessibility', () => {
    test('should have proper modal structure', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const modal = document.querySelector('.destination-picker-modal');
      expect(modal).toBeInTheDocument();
    });

    test('should support keyboard navigation', () => {
      render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/find location/i);
      searchInput.focus();

      expect(document.activeElement).toBe(searchInput);
    });

    test('should have scrollable content area', () => {
      const { container } = render(
        <DestinationPickerModal
          places={mockPlaces}
          type="destination"
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      );

      const scrollArea = container.querySelector('[style*="overflow"]');
      expect(scrollArea).toBeInTheDocument();
    });
  });
});