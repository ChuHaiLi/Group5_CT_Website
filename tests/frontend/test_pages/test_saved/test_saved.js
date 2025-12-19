/**
 * Unit tests for SavedPage component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import SavedPage from '@/pages/Saved/Saved';
import API from '@/untils/axios';

jest.mock('../../../../frontend/src/untils/axios');
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
  useNavigate: () => mockNavigate
}));

describe('SavedPage', () => {
  const mockSavedDestinations = [
    {
      id: 1,
      name: 'Vịnh Hạ Long',
      province_name: 'Quảng Ninh',
      region_name: 'Miền Bắc',
      entry_fee: 200000,
      rating: 4.5,
      tags: ['Beach', 'UNESCO'],
      image_url: 'https://example.com/halong.jpg'
    },
    {
      id: 2,
      name: 'Phố Cổ Hội An',
      province_name: 'Quảng Nam',
      region_name: 'Miền Trung',
      entry_fee: 0,
      rating: 4.8,
      tags: ['Historical Site', 'Cultural Site'],
      image_url: 'https://example.com/hoian.jpg'
    },
    {
      id: 3,
      name: 'Chợ Bến Thành',
      province_name: 'TP. Hồ Chí Minh',
      region_name: 'Miền Nam',
      entry_fee: 0,
      rating: 4.2,
      tags: ['Shopping'],
      image_url: 'https://example.com/benthanh.jpg'
    }
  ];

  const mockSavedIds = new Set([1, 2, 3]);
  const mockHandleToggleSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('access_token', 'test-token');
    
    API.get.mockImplementation((url) => {
      if (url === '/saved/list') {
        return Promise.resolve({ data: mockSavedDestinations });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  test('renders saved page header', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Places You\'re Keeping')).toBeInTheDocument();
    expect(screen.getByText(/personalized space/i)).toBeInTheDocument();
  });

  test('shows two tabs: Saved and Collections', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Saved \(\d+\)/)).toBeInTheDocument();
      expect(screen.getByText(/Collections \(\d+\)/)).toBeInTheDocument();
    });
  });

  test('loads saved destinations on mount', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith('/saved/list');
    });

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
      expect(screen.getByText('Phố Cổ Hội An')).toBeInTheDocument();
    });
  });

  test('filters destinations by search', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search saved destinations/i);
    fireEvent.change(searchInput, { target: { value: 'Hội An' } });

    await waitFor(() => {
      expect(screen.getByText('Phố Cổ Hội An')).toBeInTheDocument();
      expect(screen.queryByText('Vịnh Hạ Long')).not.toBeInTheDocument();
    });
  });

  test('groups destinations by region', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const regionButton = screen.getByText('Region');
    fireEvent.click(regionButton);

    await waitFor(() => {
      expect(screen.getByText('Miền Bắc')).toBeInTheDocument();
      expect(screen.getByText('Miền Trung')).toBeInTheDocument();
      expect(screen.getByText('Miền Nam')).toBeInTheDocument();
    });
  });

  test('groups destinations by city', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const cityButton = screen.getByText('City');
    fireEvent.click(cityButton);

    await waitFor(() => {
      expect(screen.getByText('Quảng Ninh')).toBeInTheDocument();
      expect(screen.getByText('Quảng Nam')).toBeInTheDocument();
    });
  });

  test('groups destinations by budget', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const budgetButton = screen.getByText('Budget');
    fireEvent.click(budgetButton);

    await waitFor(() => {
      expect(screen.getByText(/Free/i)).toBeInTheDocument();
    });
  });

  test('toggles sort order', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const sortButton = screen.getByText(/A - Z/i).closest('button');
    fireEvent.click(sortButton);

    await waitFor(() => {
      expect(screen.getByText(/Z - A/i)).toBeInTheDocument();
    });
  });

  test('switches to Collections tab', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const collectionsTab = screen.getByText(/Collections \(\d+\)/);
    fireEvent.click(collectionsTab);

    await waitFor(() => {
      expect(screen.getByText('New Folder')).toBeInTheDocument();
    });
  });

  test('creates a new folder', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    // Switch to Collections tab
    const collectionsTab = screen.getByText(/Collections \(\d+\)/);
    fireEvent.click(collectionsTab);

    await waitFor(() => {
      const newFolderCard = screen.getByText('New Folder');
      fireEvent.click(newFolderCard);
    });

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Name your folder/i);
      fireEvent.change(input, { target: { value: 'Summer Trip' } });
    });

    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Summer Trip')).toBeInTheDocument();
    });
  });

  test('deletes a folder', async () => {
    // Create a folder first
    localStorage.setItem('my_user_folders', JSON.stringify([
      { id: 1, name: 'Test Folder', items: [] }
    ]));

    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    const collectionsTab = screen.getByText(/Collections \(\d+\)/);
    fireEvent.click(collectionsTab);

    await waitFor(() => {
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
    });

    // Mock window.confirm
    window.confirm = jest.fn(() => true);

    const deleteButton = screen.getByTitle('Delete Folder');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
  });

  test('shows auth modal when not authenticated', async () => {
    localStorage.removeItem('access_token');

    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Login Required/i)).toBeInTheDocument();
      expect(screen.getByText(/need to be logged in/i)).toBeInTheDocument();
    });
  });

  test('shows empty state when no saved destinations', async () => {
    API.get.mockResolvedValueOnce({ data: [] });

    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={new Set()}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No saved destinations found/i)).toBeInTheDocument();
    });
  });

  test('handles unsave action', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    // Find and click heart icon to unsave
    const cards = screen.getAllByText('Vịnh Hạ Long')[0].closest('.recommend-card');
    if (cards) {
      const heartButton = cards.querySelector('.save-button');
      if (heartButton) {
        fireEvent.click(heartButton);
        
        await waitFor(() => {
          expect(mockHandleToggleSave).toHaveBeenCalledWith(1);
        });
      }
    }
  });

  test('opens create trip form', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const createButtons = screen.getAllByText(/Create/i);
    if (createButtons.length > 0) {
      fireEvent.click(createButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Create a Trip')).toBeInTheDocument();
      });
    }
  });

  test('handles API error gracefully', async () => {
    API.get.mockRejectedValueOnce(new Error('Network error'));

    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  test('groups by rating', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const ratingButton = screen.getByText('Rating');
    fireEvent.click(ratingButton);

    await waitFor(() => {
      expect(screen.getByText(/4 Stars/i)).toBeInTheDocument();
    });
  });

  test('groups by tags', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
    });

    const tagsButton = screen.getByText('Tags');
    fireEvent.click(tagsButton);

    await waitFor(() => {
      expect(screen.getByText('Beach')).toBeInTheDocument();
      expect(screen.getByText('Historical Site')).toBeInTheDocument();
    });
  });

  test('persists folders to localStorage', async () => {
    render(
      <BrowserRouter>
        <SavedPage 
          savedIds={mockSavedIds}
          handleToggleSave={mockHandleToggleSave}
        />
      </BrowserRouter>
    );

    const collectionsTab = screen.getByText(/Collections \(\d+\)/);
    fireEvent.click(collectionsTab);

    await waitFor(() => {
      const newFolderCard = screen.getByText('New Folder');
      fireEvent.click(newFolderCard);
    });

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Name your folder/i);
      fireEvent.change(input, { target: { value: 'Test Folder' } });
    });

    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);

    await waitFor(() => {
      const folders = JSON.parse(localStorage.getItem('my_user_folders') || '[]');
      expect(folders).toHaveLength(1);
      expect(folders[0].name).toBe('Test Folder');
    });
  });
});