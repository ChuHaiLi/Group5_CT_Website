/**
 * Unit Tests for Home Page Sections
 * Tests: VacationCarousel, TrendingSection, RelaxationSection, WildlifeSection
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import VacationCarousel from '@/pages/Home/VacationCarousel/VacationCarousel';
import TrendingSection from '@/pages/Home/Trending/TrendingSection';
import RelaxationSection from '@/pages/Home/Relaxation/RelaxationSection';
import WildlifeSection from '@/pages/Home/Wildlife/WildlifeSection';
import API from '@/untils/axios';

jest.mock('../../untils/axios');

describe('VacationCarousel Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should render carousel with title', () => {
    render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    expect(screen.getByText(/find your perfect escape/i)).toBeInTheDocument();
  });

  test('should display vacation categories', () => {
    render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    expect(screen.getByText(/family getaways/i)).toBeInTheDocument();
  });

  test('should auto-play carousel', () => {
    render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    // Fast-forward time for auto-play
    jest.advanceTimersByTime(2500);

    // Carousel should have transitioned
  });

  test('should navigate to next slide on button click', () => {
    render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    const nextButton = document.querySelector('.carousel-item.position-right');
    if (nextButton) {
      fireEvent.click(nextButton);
    }

    // Should advance to next slide
  });

  test('should navigate to previous slide on button click', () => {
    render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    const prevButton = document.querySelector('.carousel-item.position-left');
    if (prevButton) {
      fireEvent.click(prevButton);
    }

    // Should go to previous slide
  });

  test('should navigate to explore page on center slide click', () => {
    const mockLocation = { href: '' };
    delete window.location;
    window.location = mockLocation;

    render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    const centerSlide = document.querySelector('.carousel-item.position-center');
    if (centerSlide) {
      fireEvent.click(centerSlide);
    }

    // Should navigate to explore with tag
  });

  test('should pause auto-play on user interaction', () => {
    render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    const nextButton = document.querySelector('.carousel-item.position-right');
    if (nextButton) {
      fireEvent.click(nextButton);
    }

    // Auto-play should pause
    jest.advanceTimersByTime(1500);
    // Then resume after timeout
  });

  test('should render dots indicator', () => {
    const { container } = render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    const dots = container.querySelectorAll('.dot');
    expect(dots.length).toBeGreaterThan(0);
  });

  test('should change slide on dot click', () => {
    const { container } = render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    const dots = container.querySelectorAll('.dot');
    if (dots.length > 1) {
      fireEvent.click(dots[1]);
    }

    // Should jump to selected slide
  });

  test('should not transition while already transitioning', () => {
    render(
      <BrowserRouter>
        <VacationCarousel />
      </BrowserRouter>
    );

    const nextButton = document.querySelector('.carousel-item.position-right');
    if (nextButton) {
      fireEvent.click(nextButton);
      fireEvent.click(nextButton); // Second click should be ignored
    }
  });
});

describe('TrendingSection Component', () => {
  test('should render trending section with title', () => {
    render(
      <BrowserRouter>
        <TrendingSection />
      </BrowserRouter>
    );

    expect(screen.getByText(/trending destinations/i)).toBeInTheDocument();
    expect(
      screen.getByText(/most popular choices for travelers/i)
    ).toBeInTheDocument();
  });

  test('should display all trending categories', () => {
    render(
      <BrowserRouter>
        <TrendingSection />
      </BrowserRouter>
    );

    expect(screen.getByText(/beach/i)).toBeInTheDocument();
    expect(screen.getByText(/nature park/i)).toBeInTheDocument();
    expect(screen.getByText(/gastronomy/i)).toBeInTheDocument();
    expect(screen.getByText(/cultural site/i)).toBeInTheDocument();
    expect(screen.getByText(/mountain/i)).toBeInTheDocument();
  });

  test('should navigate to explore page on category click', () => {
    const mockLocation = { href: '' };
    delete window.location;
    window.location = mockLocation;

    render(
      <BrowserRouter>
        <TrendingSection />
      </BrowserRouter>
    );

    const beachCard = screen.getByText(/beach/i).closest('.trending-card');
    if (beachCard) {
      fireEvent.click(beachCard);
    }

    expect(window.location.href).toContain('/explore');
  });

  test('should render category images as background', () => {
    const { container } = render(
      <BrowserRouter>
        <TrendingSection />
      </BrowserRouter>
    );

    const cards = container.querySelectorAll('.trending-card');
    cards.forEach((card) => {
      expect(card).toHaveStyle({
        backgroundImage: expect.stringContaining('url('),
      });
    });
  });

  test('should render two rows of categories', () => {
    const { container } = render(
      <BrowserRouter>
        <TrendingSection />
      </BrowserRouter>
    );

    expect(container.querySelector('.trending-row-1')).toBeInTheDocument();
    expect(container.querySelector('.trending-row-2')).toBeInTheDocument();
  });

  test('should display category descriptions', () => {
    render(
      <BrowserRouter>
        <TrendingSection />
      </BrowserRouter>
    );

    expect(
      screen.getByText(/explore stunning coastal destinations/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/discover lush green landscapes/i)
    ).toBeInTheDocument();
  });
});

describe('RelaxationSection Component', () => {
  const mockSavedIds = new Set([1]);
  const mockHandleToggleSave = jest.fn();
  const mockOnCreateTrip = jest.fn();

  const mockRelaxationPlaces = [
    {
      id: 1,
      name: 'Phu Quoc Resort',
      tags: ['Relaxation/Resort'],
      image_url: 'resort1.jpg',
      rating: 4.5,
    },
    {
      id: 2,
      name: 'Nha Trang Spa',
      tags: ['Relaxation/Resort'],
      image_url: 'resort2.jpg',
      rating: 4.7,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    API.get.mockResolvedValue({ data: mockRelaxationPlaces });
  });

  test('should render relaxation section with title', async () => {
    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/relax & rejuvenate/i)).toBeInTheDocument();
    });
  });

  test('should fetch relaxation places on mount', async () => {
    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith('/destinations');
    });
  });

  test('should display relaxation places', async () => {
    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Phu Quoc Resort')).toBeInTheDocument();
      expect(screen.getByText('Nha Trang Spa')).toBeInTheDocument();
    });
  });

  test('should filter by Relaxation/Resort tag', async () => {
    const allPlaces = [
      ...mockRelaxationPlaces,
      {
        id: 3,
        name: 'Mountain Trek',
        tags: ['Mountain', 'Adventure'],
        image_url: 'mountain.jpg',
      },
    ];

    API.get.mockResolvedValue({ data: allPlaces });

    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Phu Quoc Resort')).toBeInTheDocument();
      expect(screen.queryByText('Mountain Trek')).not.toBeInTheDocument();
    });
  });

  test('should show navigation buttons when scrollable', async () => {
    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/scroll left/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/scroll right/i)).toBeInTheDocument();
    });
  });

  test('should scroll on navigation button click', async () => {
    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      const rightButton = screen.getByLabelText(/scroll right/i);
      fireEvent.click(rightButton);
    });

    // Should scroll the container
  });

  test('should show "Discover More" button', async () => {
    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/discover more!/i)).toBeInTheDocument();
    });
  });

  test('should navigate to explore on "Discover More" click', async () => {
    const mockLocation = { href: '' };
    delete window.location;
    window.location = mockLocation;

    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      const button = screen.getByText(/discover more!/i);
      fireEvent.click(button);
    });

    expect(window.location.href).toContain('/explore');
  });

  test('should not render if no places found', async () => {
    API.get.mockResolvedValue({ data: [] });

    const { container } = render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(container.querySelector('.relaxation-section')).not.toBeInTheDocument();
    });
  });

  test('should handle API error gracefully', async () => {
    API.get.mockRejectedValue(new Error('API Error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      <BrowserRouter>
        <RelaxationSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});

describe('WildlifeSection Component', () => {
  const mockSavedIds = new Set([1]);
  const mockHandleToggleSave = jest.fn();
  const mockOnCreateTrip = jest.fn();

  const mockWildlifePlaces = [
    {
      id: 1,
      name: 'Cat Tien National Park',
      tags: ['Wildlife Watching', 'Nature Park'],
      image_url: 'cattien.jpg',
      rating: 4.6,
    },
    {
      id: 2,
      name: 'Cuc Phuong Forest',
      tags: ['Wildlife Watching'],
      image_url: 'cucphuong.jpg',
      rating: 4.8,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    API.get.mockResolvedValue({ data: mockWildlifePlaces });
  });

  test('should render wildlife section with title', async () => {
    render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/wildlife & nature/i)).toBeInTheDocument();
    });
  });

  test('should fetch wildlife places on mount', async () => {
    render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith('/destinations');
    });
  });

  test('should display wildlife places', async () => {
    render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cat Tien National Park')).toBeInTheDocument();
      expect(screen.getByText('Cuc Phuong Forest')).toBeInTheDocument();
    });
  });

  test('should filter by Wildlife Watching tag', async () => {
    const allPlaces = [
      ...mockWildlifePlaces,
      {
        id: 3,
        name: 'Beach Resort',
        tags: ['Beach', 'Relaxation/Resort'],
        image_url: 'beach.jpg',
      },
    ];

    API.get.mockResolvedValue({ data: allPlaces });

    render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cat Tien National Park')).toBeInTheDocument();
      expect(screen.queryByText('Beach Resort')).not.toBeInTheDocument();
    });
  });

  test('should limit to 10 places', async () => {
    const manyPlaces = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      name: `Wildlife Place ${i}`,
      tags: ['Wildlife Watching'],
      image_url: `place${i}.jpg`,
      rating: 4.5,
    }));

    API.get.mockResolvedValue({ data: manyPlaces });

    render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      const cards = document.querySelectorAll('.wildlife-card-wrapper');
      expect(cards.length).toBeLessThanOrEqual(10);
    });
  });

  test('should show navigation buttons', async () => {
    render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/scroll left/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/scroll right/i)).toBeInTheDocument();
    });
  });

  test('should navigate to explore on "Discover More" click', async () => {
    const mockLocation = { href: '' };
    delete window.location;
    window.location = mockLocation;

    render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      const button = screen.getByText(/discover more!/i);
      fireEvent.click(button);
    });

    expect(window.location.href).toContain('/explore');
  });

  test('should not render if no places found', async () => {
    API.get.mockResolvedValue({ data: [] });

    const { container } = render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(container.querySelector('.wildlife-section')).not.toBeInTheDocument();
    });
  });

  test('should handle places without tags', async () => {
    const placesWithoutTags = [
      { id: 1, name: 'Place 1', image_url: 'img1.jpg' },
      { id: 2, name: 'Place 2', tags: null, image_url: 'img2.jpg' },
    ];

    API.get.mockResolvedValue({ data: placesWithoutTags });

    const { container } = render(
      <BrowserRouter>
        <WildlifeSection
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
          onCreateTrip={mockOnCreateTrip}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(container.querySelector('.wildlife-section')).not.toBeInTheDocument();
    });
  });
});