/**
 * Unit Tests for RecommendCard Component
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RecommendCard from '@/pages/Home/Recommendations/RecommendCard';

const mockDestination = {
  id: 1,
  name: 'Ha Long Bay',
  province_name: 'Quang Ninh',
  image_url: 'halong.jpg',
  rating: 4.5,
  entry_fee: 200000,
  type: 'Natural Attraction',
};

describe('RecommendCard Component', () => {
  const mockCallbacks = {
    onToggleSave: jest.fn(),
    onViewDetails: jest.fn(),
    onCreateTrip: jest.fn(),
    onSelectPlace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Explore Mode', () => {
    test('should render in explore mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
      expect(screen.getByText(/rating:/i)).toBeInTheDocument();
    });

    test('should show save icon in explore mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const saveIcon = document.querySelector('.save-icon');
      expect(saveIcon).toBeInTheDocument();
    });

    test('should show filled heart when saved', () => {
      const { container } = render(
        <RecommendCard
          destination={mockDestination}
          isSaved={true}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const heartIcon = container.querySelector('[color="red"]');
      expect(heartIcon).toBeInTheDocument();
    });

    test('should show empty heart when not saved', () => {
      const { container } = render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const heartIcon = container.querySelector('[color="white"]');
      expect(heartIcon).toBeInTheDocument();
    });

    test('should call onToggleSave when clicking save icon', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const saveIcon = document.querySelector('.save-icon');
      fireEvent.click(saveIcon);

      expect(mockCallbacks.onToggleSave).toHaveBeenCalledWith(1);
    });

    test('should show "Create a Trip" button in explore mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/create a trip/i)).toBeInTheDocument();
    });

    test('should call onCreateTrip when clicking button', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const button = screen.getByText(/create a trip/i);
      fireEvent.click(button);

      expect(mockCallbacks.onCreateTrip).toHaveBeenCalledWith(mockDestination);
    });

    test('should not show price in explore mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      expect(screen.queryByText(/price:/i)).not.toBeInTheDocument();
    });
  });

  describe('Select Mode', () => {
    test('should render in select mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText('Ha Long Bay')).toBeInTheDocument();
    });

    test('should not show save icon in select mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      const saveIcon = document.querySelector('.save-icon');
      expect(saveIcon).not.toBeInTheDocument();
    });

    test('should show price in select mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/price:/i)).toBeInTheDocument();
      expect(screen.getByText(/200\.000/i)).toBeInTheDocument();
    });

    test('should show "Select Place" button in select mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/select place/i)).toBeInTheDocument();
    });

    test('should call onSelectPlace when clicking button', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      const button = screen.getByText(/select place/i);
      fireEvent.click(button);

      expect(mockCallbacks.onSelectPlace).toHaveBeenCalledWith(mockDestination);
    });

    test('should have select class in select mode', () => {
      const { container } = render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      const card = container.querySelector('.recommend-card.select');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Select-Search Mode', () => {
    test('should render compact view in select-search mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select-search"
          {...mockCallbacks}
        />
      );

      const searchItem = document.querySelector('.search-result-item');
      expect(searchItem).toBeInTheDocument();
    });

    test('should show province name in select-search mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select-search"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/quang ninh/i)).toBeInTheDocument();
    });

    test('should show price in select-search mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select-search"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/200\.000/i)).toBeInTheDocument();
    });

    test('should call onSelectPlace when clicking card', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select-search"
          {...mockCallbacks}
        />
      );

      const searchItem = document.querySelector('.search-result-item');
      fireEvent.click(searchItem);

      expect(mockCallbacks.onSelectPlace).toHaveBeenCalledWith(mockDestination);
    });

    test('should not show action button in select-search mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select-search"
          {...mockCallbacks}
        />
      );

      expect(screen.queryByText(/create a trip/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/select place/i)).not.toBeInTheDocument();
    });
  });

  describe('Rating Display', () => {
    test('should render full stars for whole number rating', () => {
      const dest = { ...mockDestination, rating: 5 };
      const { container } = render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const fullStars = container.querySelectorAll('[color="#FFD700"]');
      expect(fullStars.length).toBe(5);
    });

    test('should render half star for decimal rating', () => {
      const dest = { ...mockDestination, rating: 4.5 };
      const { container } = render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      // Should have half star icon
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    test('should render empty stars for remaining rating', () => {
      const dest = { ...mockDestination, rating: 3 };
      const { container } = render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const emptyStars = container.querySelectorAll('[color="#ccc"]');
      expect(emptyStars.length).toBe(2);
    });

    test('should handle rating of 0', () => {
      const dest = { ...mockDestination, rating: 0 };
      const { container } = render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const emptyStars = container.querySelectorAll('[color="#ccc"]');
      expect(emptyStars.length).toBe(5);
    });
  });

  describe('Price Formatting', () => {
    test('should format VND price correctly', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/200\.000/i)).toBeInTheDocument();
    });

    test('should show "Free" for zero price', () => {
      const dest = { ...mockDestination, entry_fee: 0 };
      render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/free/i)).toBeInTheDocument();
    });

    test('should show "Free" for null price', () => {
      const dest = { ...mockDestination, entry_fee: null };
      render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/free/i)).toBeInTheDocument();
    });

    test('should format large prices correctly', () => {
      const dest = { ...mockDestination, entry_fee: 1500000 };
      render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="select"
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/1\.500\.000/i)).toBeInTheDocument();
    });
  });

  describe('Image Handling', () => {
    test('should display single image URL', () => {
      const { container } = render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const card = container.querySelector('.recommend-card');
      expect(card).toHaveStyle({
        backgroundImage: expect.stringContaining('halong.jpg'),
      });
    });

    test('should display first image from array', () => {
      const dest = {
        ...mockDestination,
        image_url: ['image1.jpg', 'image2.jpg'],
      };
      const { container } = render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const card = container.querySelector('.recommend-card');
      expect(card).toHaveStyle({
        backgroundImage: expect.stringContaining('image1.jpg'),
      });
    });
  });

  describe('Card Interactions', () => {
    test('should call onViewDetails when clicking card in explore mode', () => {
      const { container } = render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const card = container.querySelector('.recommend-card');
      fireEvent.click(card);

      expect(mockCallbacks.onViewDetails).toHaveBeenCalledWith(1);
    });

    test('should call onSelectPlace when clicking card in select-search mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select-search"
          {...mockCallbacks}
        />
      );

      const card = document.querySelector('.search-result-item');
      fireEvent.click(card);

      expect(mockCallbacks.onSelectPlace).toHaveBeenCalledWith(mockDestination);
    });

    test('should stop propagation when clicking action button', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const button = screen.getByText(/create a trip/i);
      const event = new MouseEvent('click', { bubbles: true });
      const stopPropagation = jest.spyOn(event, 'stopPropagation');

      fireEvent.click(button);

      // onViewDetails should not be called
      expect(mockCallbacks.onViewDetails).not.toHaveBeenCalled();
    });

    test('should stop propagation when clicking save icon', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const saveIcon = document.querySelector('.save-icon');
      fireEvent.click(saveIcon);

      // onViewDetails should not be called
      expect(mockCallbacks.onViewDetails).not.toHaveBeenCalled();
      expect(mockCallbacks.onToggleSave).toHaveBeenCalled();
    });
  });

  describe('Missing Callbacks', () => {
    test('should handle missing onToggleSave', () => {
      const props = { ...mockCallbacks };
      delete props.onToggleSave;

      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...props}
        />
      );

      const saveIcon = document.querySelector('.save-icon');
      fireEvent.click(saveIcon);

      // Should not throw error
    });

    test('should handle missing onViewDetails', () => {
      const props = { ...mockCallbacks };
      delete props.onViewDetails;

      const { container } = render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...props}
        />
      );

      const card = container.querySelector('.recommend-card');
      fireEvent.click(card);

      // Should not throw error
    });

    test('should handle missing onSelectPlace', () => {
      const props = { ...mockCallbacks };
      delete props.onSelectPlace;

      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select"
          {...props}
        />
      );

      const button = screen.getByText(/select place/i);
      fireEvent.click(button);

      // Should not throw error
    });
  });

  describe('Default Mode', () => {
    test('should default to explore mode when no mode specified', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          {...mockCallbacks}
        />
      );

      expect(screen.getByText(/create a trip/i)).toBeInTheDocument();
      const saveIcon = document.querySelector('.save-icon');
      expect(saveIcon).toBeInTheDocument();
    });
  });

  describe('CSS Classes', () => {
    test('should have recommend-card class in explore mode', () => {
      const { container } = render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      expect(container.querySelector('.recommend-card')).toBeInTheDocument();
    });

    test('should have search-result-item class in select-search mode', () => {
      render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="select-search"
          {...mockCallbacks}
        />
      );

      expect(document.querySelector('.search-result-item')).toBeInTheDocument();
    });

    test('should have card-overlay in explore/select modes', () => {
      const { container } = render(
        <RecommendCard
          destination={mockDestination}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      expect(container.querySelector('.card-overlay')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing destination name', () => {
      const dest = { ...mockDestination, name: '' };
      render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      // Should still render without crashing
      expect(screen.getByText(/rating:/i)).toBeInTheDocument();
    });

    test('should handle missing image URL', () => {
      const dest = { ...mockDestination, image_url: null };
      const { container } = render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const card = container.querySelector('.recommend-card');
      expect(card).toBeInTheDocument();
    });

    test('should handle empty image array', () => {
      const dest = { ...mockDestination, image_url: [] };
      const { container } = render(
        <RecommendCard
          destination={dest}
          isSaved={false}
          mode="explore"
          {...mockCallbacks}
        />
      );

      const card = container.querySelector('.recommend-card');
      expect(card).toBeInTheDocument();
    });
  });
});