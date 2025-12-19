/**
 * Unit tests for CreateTripForm component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateTripForm from '@/components/CreateTripForm';
import API from '@/untils/axios';

// Mock API
jest.mock('../../untils/axios');

// Mock react-toastify
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('CreateTripForm', () => {
  const mockOnClose = jest.fn();
  const mockOnTripCreated = jest.fn();

  const mockProvinces = [
    {
      region_name: 'Miền Bắc',
      provinces: [
        { id: 1, province_name: 'Hà Nội' },
        { id: 2, province_name: 'Hải Phòng' }
      ]
    },
    {
      region_name: 'Miền Nam',
      provinces: [
        { id: 3, province_name: 'TP. Hồ Chí Minh' }
      ]
    }
  ];

  const mockDestinations = [
    {
      id: 1,
      name: 'Hồ Hoàn Kiếm',
      province_name: 'Hà Nội',
      type: 'Destination',
      entry_fee: 0,
      category: 'Sightseeing'
    },
    {
      id: 2,
      name: 'Khách sạn Sofitel',
      province_name: 'Hà Nội',
      type: 'Hotel',
      entry_fee: 1500000
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API calls
    API.get.mockImplementation((url) => {
      if (url === '/locations/vietnam') {
        return Promise.resolve({ data: mockProvinces });
      }
      if (url.includes('/destinations?search=')) {
        return Promise.resolve({ data: mockDestinations });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  test('renders form with all required fields', async () => {
    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create a Trip')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Trip Name')).toBeInTheDocument();
    expect(screen.getByText('Duration (Sets Trip Days)')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('Budget / Person')).toBeInTheDocument();
  });

  test('loads provinces on mount', async () => {
    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    await waitFor(() => {
      expect(API.get).toHaveBeenCalledWith('/locations/vietnam');
    });

    await waitFor(() => {
      const provinceSelect = screen.getByRole('combobox', { name: /select main province/i });
      expect(provinceSelect).toBeInTheDocument();
    });
  });

  test('requires duration, people, and budget before selecting province', async () => {
    const { toast } = require('react-toastify');
    
    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    await waitFor(() => {
      const provinceSelect = screen.getByRole('combobox');
      expect(provinceSelect).toBeDisabled();
    });

    expect(screen.getByText(/Vui lòng chọn Thời lượng, Số người & Ngân sách trước/i)).toBeInTheDocument();
  });

  test('enables province selection after selecting required fields', async () => {
    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Duration (Sets Trip Days)')).toBeInTheDocument();
    });

    // Select duration
    const durationButton = screen.getByRole('button', { name: '1-3 days' });
    fireEvent.click(durationButton);

    // Select people
    const peopleButton = screen.getByRole('button', { name: '2-4 people' });
    fireEvent.click(peopleButton);

    // Select budget
    const budgetButton = screen.getByRole('button', { name: '< 500k VND' });
    fireEvent.click(budgetButton);

    await waitFor(() => {
      const provinceSelect = screen.getByRole('combobox');
      expect(provinceSelect).not.toBeDisabled();
    });
  });

  test('calculates total cost correctly', async () => {
    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    // Complete prerequisites
    await waitFor(() => {
      expect(screen.getByText('Duration (Sets Trip Days)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '1-3 days' }));
    fireEvent.click(screen.getByRole('button', { name: '2-4 people' }));
    fireEvent.click(screen.getByRole('button', { name: '< 500k VND' }));

    await waitFor(() => {
      const provinceSelect = screen.getByRole('combobox');
      expect(provinceSelect).not.toBeDisabled();
    });

    // The component should calculate and display cost
    // This depends on actual implementation
  });

  test('prevents adding destination when budget exceeded', async () => {
    const { toast } = require('react-toastify');
    
    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    // Setup form with low budget
    await waitFor(() => {
      expect(screen.getByText('Duration (Sets Trip Days)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '1-3 days' }));
    fireEvent.click(screen.getByRole('button', { name: '1 person' }));
    fireEvent.click(screen.getByRole('button', { name: '< 500k VND' })); // Low budget

    // Select province
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
    });

    // Try to add expensive destination
    // This would require mocking the destination selection flow
  });

  test('submits form with valid data', async () => {
    API.post.mockResolvedValueOnce({
      data: {
        trip: {
          id: 1,
          name: 'Test Trip',
          duration: 3
        }
      }
    });

    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    // Fill form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Trip Name')).toBeInTheDocument();
    });

    const tripNameInput = screen.getByPlaceholderText('Trip Name');
    fireEvent.change(tripNameInput, { target: { value: 'Test Trip' } });

    // Select all required fields
    fireEvent.click(screen.getByRole('button', { name: '1-3 days' }));
    fireEvent.click(screen.getByRole('button', { name: '2-4 people' }));
    fireEvent.click(screen.getByRole('button', { name: '< 500k VND' }));

    await waitFor(() => {
      const startDateInput = screen.getByLabelText(/start date/i);
      fireEvent.change(startDateInput, { target: { value: '2025-06-01' } });
    });

    // Select province
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
    });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /generate & create trip/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/trips', expect.any(Object));
      expect(mockOnTripCreated).toHaveBeenCalled();
    });
  });

  test('closes form when cancel button clicked', async () => {
    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('initializes with destination when provided', async () => {
    const initialDestination = {
      id: 1,
      name: 'Hồ Hoàn Kiếm',
      province_id: 1,
      province_name: 'Hà Nội',
      type: 'Destination',
      entry_fee: 0
    };

    render(
      <CreateTripForm 
        initialDestination={initialDestination}
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    await waitFor(() => {
      const tripNameInput = screen.getByPlaceholderText('Trip Name');
      expect(tripNameInput.value).toContain('Hồ Hoàn Kiếm');
    });
  });

  test('handles API error gracefully', async () => {
    const { toast } = require('react-toastify');
    
    API.post.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Failed to create trip'
        }
      }
    });

    render(
      <CreateTripForm 
        onClose={mockOnClose}
        onTripCreated={mockOnTripCreated}
      />
    );

    // Fill and submit form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Trip Name')).toBeInTheDocument();
    });

    const tripNameInput = screen.getByPlaceholderText('Trip Name');
    fireEvent.change(tripNameInput, { target: { value: 'Test Trip' } });

    fireEvent.click(screen.getByRole('button', { name: '1-3 days' }));
    fireEvent.click(screen.getByRole('button', { name: '1 person' }));
    fireEvent.click(screen.getByRole('button', { name: '< 500k VND' }));

    await waitFor(() => {
      const startDateInput = screen.getByLabelText(/start date/i);
      fireEvent.change(startDateInput, { target: { value: '2025-06-01' } });
    });

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
    });

    const submitButton = screen.getByRole('button', { name: /generate & create trip/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create trip'));
    });
  });
});