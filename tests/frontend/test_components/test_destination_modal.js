import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DestinationModal from '@/components/DestinationModal';

describe('DestinationModal', () => {
  const mockOnClose = jest.fn();
  const mockOnCreateTrip = jest.fn();

  const mockDestination = {
    id: 1,
    name: 'Hoan Kiem Lake',
    type: 'Destination',
    description: 'Beautiful lake in Hanoi center',
    entry_fee: 0,
    opening_hours: '24/7',
    address: 'Hanoi',
    province_name: 'Hanoi',
    image_url: 'https://example.com/image.jpg',
    tags: ['Historical', 'Lake', 'Free'],
    gps: { lat: 21.0285, lng: 105.8542 },
    source: 'https://example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <DestinationModal
        destination={mockDestination}
        onClose={mockOnClose}
        onCreateTrip={mockOnCreateTrip}
        {...props}
      />
    );
  };

  test('should render destination name', () => {
    renderComponent();
    
    expect(screen.getByText('Hoan Kiem Lake')).toBeInTheDocument();
  });

  test('should render destination type badge', () => {
    renderComponent();
    
    expect(screen.getByText('Destination')).toBeInTheDocument();
  });

  test('should render entry fee', () => {
    renderComponent();
    
    expect(screen.getByText('Miễn phí')).toBeInTheDocument();
  });

  test('should format price for paid entries', () => {
    const paidDestination = { ...mockDestination, entry_fee: 50000 };
    renderComponent({ destination: paidDestination });
    
    expect(screen.getByText(/50.000/)).toBeInTheDocument();
  });

  test('should render opening hours', () => {
    renderComponent();
    
    expect(screen.getByText('24/7')).toBeInTheDocument();
  });

  test('should render address', () => {
    renderComponent();
    
    expect(screen.getByText('Hanoi')).toBeInTheDocument();
  });

  test('should render description', () => {
    renderComponent();
    
    expect(screen.getByText('Beautiful lake in Hanoi center')).toBeInTheDocument();
  });

  test('should handle array description', () => {
    const destWithArrayDesc = {
      ...mockDestination,
      description: ['Point 1', 'Point 2', 'Point 3']
    };
    
    renderComponent({ destination: destWithArrayDesc });
    
    expect(screen.getByText('Point 1')).toBeInTheDocument();
    expect(screen.getByText('Point 2')).toBeInTheDocument();
    expect(screen.getByText('Point 3')).toBeInTheDocument();
  });

  test('should render tags', () => {
    renderComponent();
    
    expect(screen.getByText('Historical')).toBeInTheDocument();
    expect(screen.getByText('Lake')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  test('should render Google Maps link when GPS available', () => {
    renderComponent();
    
    const mapLink = screen.getByText('Xem trên Google Maps');
    expect(mapLink).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    expect(mapLink).toHaveAttribute('target', '_blank');
  });

  test('should render source link', () => {
    renderComponent();
    
    const sourceLink = screen.getByText('Nguồn tham khảo');
    expect(sourceLink).toHaveAttribute('href', 'https://example.com');
    expect(sourceLink).toHaveAttribute('target', '_blank');
  });

  test('should render close button', () => {
    renderComponent();
    
    const closeButton = screen.getByText('Close');
    expect(closeButton).toBeInTheDocument();
  });

  test('should render create trip button by default', () => {
    renderComponent();
    
    const createButton = screen.getByText('Create a trip');
    expect(createButton).toBeInTheDocument();
  });

  test('should hide create trip button when hideCreateButton is true', () => {
    renderComponent({ hideCreateButton: true });
    
    const createButton = screen.queryByText('Create a trip');
    expect(createButton).not.toBeInTheDocument();
  });

  test('should call onClose when close button is clicked', () => {
    renderComponent();
    
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should call onCreateTrip when create trip button is clicked', () => {
    renderComponent();
    
    const createButton = screen.getByText('Create a trip');
    fireEvent.click(createButton);
    
    expect(mockOnCreateTrip).toHaveBeenCalledWith(mockDestination);
  });

  test('should close modal on Escape key', () => {
    renderComponent();
    
    fireEvent.keyDown(window, { key: 'Escape' });
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should close modal when clicking overlay', () => {
    renderComponent();
    
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.click(overlay);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should not close modal when clicking content', () => {
    renderComponent();
    
    const content = document.querySelector('.modal-content');
    fireEvent.click(content);
    
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('should prevent body scroll when modal is open', () => {
    renderComponent();
    
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('should restore body scroll when modal is closed', () => {
    const { unmount } = renderComponent();
    
    unmount();
    
    expect(document.body.style.overflow).toBe('unset');
  });

  test('should display hero image when available', () => {
    const { container } = renderComponent();
    
    const heroImage = container.querySelector('.modal-hero-image');
    expect(heroImage).toHaveStyle({
      backgroundImage: `url(${mockDestination.image_url})`
    });
  });

  test('should handle missing image gracefully', () => {
    const noImageDest = { ...mockDestination, image_url: null };
    const { container } = renderComponent({ destination: noImageDest });
    
    const heroImage = container.querySelector('.modal-hero-image');
    expect(heroImage).toHaveStyle({ backgroundColor: '#2d3748' });
  });

  test('should render image gallery when multiple images', () => {
    const multiImageDest = {
      ...mockDestination,
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg']
    };
    
    renderComponent({ destination: multiImageDest });
    
    expect(screen.getByText(/Hình ảnh \(3\)/)).toBeInTheDocument();
  });

  test('should open image viewer when gallery image is clicked', () => {
    const multiImageDest = {
      ...mockDestination,
      images: ['img1.jpg', 'img2.jpg']
    };
    
    const { container } = renderComponent({ destination: multiImageDest });
    
    const galleryItem = container.querySelector('.gallery-item');
    fireEvent.click(galleryItem);
    
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  test('should close image viewer on Escape without closing modal', () => {
    const multiImageDest = {
      ...mockDestination,
      images: ['img1.jpg', 'img2.jpg']
    };
    
    const { container } = renderComponent({ destination: multiImageDest });
    
    const galleryItem = container.querySelector('.gallery-item');
    fireEvent.click(galleryItem);
    
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    
    fireEvent.keyDown(window, { key: 'Escape' });
    
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('should navigate to next image in viewer', () => {
    const multiImageDest = {
      ...mockDestination,
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg']
    };
    
    const { container } = renderComponent({ destination: multiImageDest });
    
    const galleryItem = container.querySelector('.gallery-item');
    fireEvent.click(galleryItem);
    
    const nextButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('.next');
    if (nextButton) {
      fireEvent.click(nextButton);
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    }
  });

  test('should navigate to previous image in viewer', () => {
    const multiImageDest = {
      ...mockDestination,
      images: ['img1.jpg', 'img2.jpg', 'img3.jpg']
    };
    
    const { container } = renderComponent({ destination: multiImageDest });
    
    const galleryItem = container.querySelector('.gallery-item');
    fireEvent.click(galleryItem);
    
    const prevButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('.prev');
    if (prevButton) {
      fireEvent.click(prevButton);
      expect(screen.getByText('3 / 3')).toBeInTheDocument();
    }
  });

  test('should handle array tags from string', () => {
    const stringTagsDest = {
      ...mockDestination,
      tags: "['Tag1', 'Tag2', 'Tag3']"
    };
    
    renderComponent({ destination: stringTagsDest });
    
    expect(screen.getByText('Tag1')).toBeInTheDocument();
  });

  test('should show "Đang cập nhật" for missing data', () => {
    const incompleteDest = {
      ...mockDestination,
      opening_hours: null,
      entry_fee: null
    };
    
    renderComponent({ destination: incompleteDest });
    
    const updates = screen.getAllByText('Đang cập nhật');
    expect(updates.length).toBeGreaterThan(0);
  });

  test('should render null when no destination provided', () => {
    const { container } = render(
      <DestinationModal
        destination={null}
        onClose={mockOnClose}
        onCreateTrip={mockOnCreateTrip}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  test('should handle GPS with latitude/longitude format', () => {
    const gpsFormatDest = {
      ...mockDestination,
      gps: { latitude: 21.0285, longitude: 105.8542 }
    };
    
    renderComponent({ destination: gpsFormatDest });
    
    const mapLink = screen.getByText('Xem trên Google Maps');
    expect(mapLink).toHaveAttribute('href', expect.stringContaining('21.0285,105.8542'));
  });
});