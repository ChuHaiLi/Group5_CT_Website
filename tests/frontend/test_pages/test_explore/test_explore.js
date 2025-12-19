/**
 * Unit tests for ExplorePage component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ExplorePage from '@/pages/Explore/ExplorePage';
import API from '@/untils/axios';

jest.mock('../../untils/axios');
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    state: null,
    search: ''
  })
}));

describe('ExplorePage', () => {
  const mockDestinations = [
    {
      id: 1,
      name: 'Vịnh Hạ Long',
      province_name: 'Quảng Ninh',
      region_name: 'Miền Bắc',
      type: 'Sightseeing',
      entry_fee: 200000,
      tags: ['Beach', 'UNESCO'],
      rating: 4.5,
      category: 'Nature'
    },
    {
      id: 2,
      name: 'Phố Cổ Hội An',
      province_name: 'Quảng Nam',
      region_name: 'Miền Trung',
      type: 'Historical Site',
      entry_fee: 0,
      tags: ['Historical Site', 'Cultural Site'],
      rating: 4.8,
      category: 'Culture'
    },
    {
      id: 3,
      name: 'Chợ Bến Thành',
      province_name: 'TP. Hồ Chí Minh',
      region_name: 'Miền Nam',
      type: 'Shopping',
      entry_fee: 0,
      tags: ['Shopping', 'Urban Area'],
      rating: 4.2,
      category: 'Shopping'
    }
  ];

  const mockProvinces = [
    {
      region_name: 'Miền Bắc',
      provinces: [
        { id: 1, province_name: 'Hà Nội' },
        { id: 2, province_name: 'Quảng Ninh' }
      ]
    },
    {
      region_name: 'Miền Trung',
      provinces: [
        { id: 3, province_name: 'Quảng Nam' }
      ]
    }
  ];

  const mockSavedIds = new Set([1]);
  const mockHandleToggleSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    API.get.mockImplementation((url) => {
      if (url === '/destinations') {
        return Promise.resolve({ data: mockDestinations });
      }
      if (url === '/locations/vietnam') {
        return Promise.resolve({ data: mockProvinces });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  test('renders explore page with search and filters', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Find Your Dream Trip ✈️')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/Search by place name/i)).toBeInTheDocument();
    expect(screen.getByText('All Provinces')).toBeInTheDocument();
  });

  test('loads destinations on mount', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith('/destinations');
      expect(API.get).toHaveBeenCalledWith('/locations/vietnam');
    });
  });

  test('filters destinations by search text', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by place name/i);
    fireEvent.change(searchInput, { target: { value: 'Hội An' } });

    await waitFor(() => {
      expect(screen.getByText('Phố Cổ Hội An')).toBeInTheDocument();
      expect(screen.queryByText('Vịnh Hạ Long')).not.toBeInTheDocument();
    });
  });

  test('filters destinations by province', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const provinceSelect = screen.getByRole('combobox');
    fireEvent.change(provinceSelect, { target: { value: '2' } });

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });
  });

  test('filters destinations by region search', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Vịnh Hạ Long|Phố Cổ|Chợ Bến/)).toHaveLength(3);
    });

    const searchInput = screen.getByPlaceholderText(/Search by place name/i);
    fireEvent.change(searchInput, { target: { value: 'Miền Bắc' } });

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });
  });

  test('shows autocomplete suggestions', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by place name/i);
    
    fireEvent.change(searchInput, { target: { value: 'Vịnh' } });
    fireEvent.focus(searchInput);

    await waitFor(() => {
      const autocomplete = document.querySelector('.search-autocomplete-dropdown');
      expect(autocomplete).toBeInTheDocument();
    });
  });

  test('handles tag selection and filtering', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    // Open category
    const categoryButton = screen.getByText('Destination Type');
    fireEvent.click(categoryButton);

    await waitFor(() => {
      const beachTag = screen.getByText('Beach');
      fireEvent.click(beachTag);
    });

    await waitFor(() => {
      expect(screen.getByText('Beach')).toHaveClass('active');
    });
  });

  test('removes selected tags', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    // Add a tag
    const categoryButton = screen.getByText('Destination Type');
    fireEvent.click(categoryButton);

    await waitFor(() => {
      const beachTag = screen.getByText('Beach');
      fireEvent.click(beachTag);
    });

    // Remove tag
    await waitFor(() => {
      const clearAllButton = screen.getByText('Clear All');
      fireEvent.click(clearAllButton);
    });
  });

  test('filters by budget range', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    // Open Price category
    const priceCategory = screen.getByText('Price');
    fireEvent.click(priceCategory);

    await waitFor(() => {
      const freeTag = screen.getByText('Free');
      fireEvent.click(freeTag);
    });

    await waitFor(() => {
      expect(screen.getByText('Phố Cổ Hội An')).toBeInTheDocument();
      expect(screen.queryByText('Vịnh Hạ Long')).not.toBeInTheDocument();
    });
  });

  test('shows popular destinations section', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("🔥 Vietnam's Most Famous Spots")).toBeInTheDocument();
    });
  });

  test('shows region cards', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Northern Vietnam')).toBeInTheDocument();
      expect(screen.getByText('Central Coast')).toBeInTheDocument();
      expect(screen.getByText('Southern Vietnam')).toBeInTheDocument();
    });
  });

  test('handles region card click', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Northern Vietnam')).toBeInTheDocument();
    });

    const northRegion = screen.getByText('Northern Vietnam').closest('.region-card');
    fireEvent.click(northRegion);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Search by place name/i);
      expect(searchInput.value).toBe('Miền Bắc');
    });
  });

  test('shows empty state when no results', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by place name/i);
    fireEvent.change(searchInput, { target: { value: 'NonexistentPlace12345' } });

    await waitFor(() => {
      expect(screen.getByText('No destinations found')).toBeInTheDocument();
      expect(screen.getByText(/couldn't find any trips/i)).toBeInTheDocument();
    });
  });

  test('pagination works correctly', async () => {
    // Create more destinations for pagination
    const manyDestinations = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `Destination ${i + 1}`,
      province_name: 'Test Province',
      region_name: 'Miền Bắc',
      type: 'Sightseeing',
      entry_fee: 0,
      tags: ['Beach'],
      rating: 4.0
    }));

    API.get.mockImplementation((url) => {
      if (url === '/destinations') {
        return Promise.resolve({ data: manyDestinations });
      }
      if (url === '/locations/vietnam') {
        return Promise.resolve({ data: mockProvinces });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Destination 1')).toBeInTheDocument();
    });

    // Check pagination exists
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeInTheDocument();
    
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Destination 16')).toBeInTheDocument();
    });
  });

  test('shows auth modal when not authenticated', async () => {
    localStorage.removeItem('access_token');

    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    // Try to create trip without auth
    const createButtons = screen.getAllByText(/Create/i);
    if (createButtons.length > 0) {
      fireEvent.click(createButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/need to be logged in/i)).toBeInTheDocument();
      });
    }
  });

  test('scroll to top button appears on scroll', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    // Simulate scroll
    Object.defineProperty(window, 'pageYOffset', { 
      writable: true, 
      value: 600 
    });
    
    fireEvent.scroll(window);

    await waitFor(() => {
      const scrollButton = document.querySelector('.scroll-to-top-btn');
      expect(scrollButton).toHaveClass('visible');
    });
  });

  test('handles API error gracefully', async () => {
    const { toast } = require('react-toastify');
    
    API.get.mockRejectedValueOnce(new Error('Network error'));

    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to fetch destinations');
    });
  });

  test('keyboard navigation in autocomplete', async () => {
    render(
      <BrowserRouter>
        <ExplorePage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by place name/i);
    
    fireEvent.change(searchInput, { target: { value: 'Vịnh' } });
    fireEvent.focus(searchInput);

    await waitFor(() => {
      const autocomplete = document.querySelector('.search-autocomplete-dropdown');
      expect(autocomplete).toBeInTheDocument();
    });

    // Simulate arrow down
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    
    // Simulate enter
    fireEvent.keyDown(window, { key: 'Enter' });
  });
});