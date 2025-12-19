/**
 * Unit Tests for ItemCard Component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import axios from '../../../../frontend/src/untils/axios';
import ItemCard from '../../../../frontend/src/pages/MyTrips/ItemCard';

// Mock axios
jest.mock('../../../../frontend/src/untils/axios');

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'test-token'),
};
global.localStorage = mockLocalStorage;

// Wrapper for DnD context
const DndWrapper = ({ children }) => (
  <DragDropContext onDragEnd={() => {}}>
    <Droppable droppableId="test-droppable">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {children}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  </DragDropContext>
);

const mockItem = {
  uniqueId: 'test-unique-1',
  id: 1,
  name: 'Test Place',
  category: 'Địa điểm',
  time_slot: '08:00-10:00',
  duration: 120,
  entry_fee: 50000,
};

const mockFoodItem = {
  uniqueId: 'lunch-1',
  id: 'LUNCH',
  name: 'Ăn trưa',
  category: 'Ăn uống',
  time_slot: '12:00-13:00',
  duration: 60,
};

const mockTravelItem = {
  uniqueId: 'travel-1',
  id: 'TRAVEL',
  name: 'Di chuyển',
  category: 'Di chuyển',
  time_slot: '10:00-10:30',
  duration: 30,
};

describe('ItemCard Component', () => {
  const mockOnRemove = jest.fn();
  const mockOnUpdate = jest.fn();
  const dayId = 'day-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render item card with basic info', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      expect(screen.getByDisplayValue('Test Place')).toBeInTheDocument();
      expect(screen.getByText(/địa điểm/i)).toBeInTheDocument();
    });

    test('should render food item with correct icon', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockFoodItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      expect(screen.getByDisplayValue('Ăn trưa')).toBeInTheDocument();
      expect(screen.getByText('🍽️')).toBeInTheDocument();
    });

    test('should render travel item with correct icon', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockTravelItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      expect(screen.getByDisplayValue('Di chuyển')).toBeInTheDocument();
      expect(screen.getByText('✈️')).toBeInTheDocument();
    });

    test('should display time slot correctly', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const timeInput = screen.getByDisplayValue('08:00');
      expect(timeInput).toBeInTheDocument();
    });

    test('should display duration dropdown', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const durationSelect = screen.getByDisplayValue(/2 hours/i);
      expect(durationSelect).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('should allow editing item name', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const nameInput = screen.getByDisplayValue('Test Place');
      fireEvent.change(nameInput, { target: { value: 'Updated Place' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        dayId,
        mockItem.uniqueId,
        { name: 'Updated Place' }
      );
    });

    test('should allow changing time slot', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const timeInput = screen.getByDisplayValue('08:00');
      fireEvent.change(timeInput, { target: { value: '09:00' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        dayId,
        mockItem.uniqueId,
        { time_slot: '09:00:00' }
      );
    });

    test('should allow changing duration', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const durationSelect = screen.getByDisplayValue(/2 hours/i);
      fireEvent.change(durationSelect, { target: { value: '60' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        dayId,
        mockItem.uniqueId,
        { duration: 60 }
      );
    });
  });

  describe('Delete Functionality', () => {
    test('should show delete button', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      expect(screen.getByText(/delete location/i)).toBeInTheDocument();
    });

    test('should open confirmation modal when clicking delete', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const deleteButton = screen.getByText(/delete location/i);
      fireEvent.click(deleteButton);

      expect(screen.getByText(/xác nhận xóa địa điểm/i)).toBeInTheDocument();
      expect(screen.getByText(/test place/i)).toBeInTheDocument();
    });

    test('should call onRemove when confirming delete', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      // Open modal
      const deleteButton = screen.getByText(/delete location/i);
      fireEvent.click(deleteButton);

      // Confirm delete
      const confirmButton = screen.getByText(/xóa địa điểm/i);
      fireEvent.click(confirmButton);

      expect(mockOnRemove).toHaveBeenCalledWith(mockItem.uniqueId);
    });

    test('should close modal when clicking cancel', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      // Open modal
      const deleteButton = screen.getByText(/delete location/i);
      fireEvent.click(deleteButton);

      // Cancel
      const cancelButton = screen.getByText(/hủy/i);
      fireEvent.click(cancelButton);

      expect(screen.queryByText(/xác nhận xóa/i)).not.toBeInTheDocument();
    });
  });

  describe('View Details Functionality', () => {
    test('should show view details button for regular destinations', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      expect(screen.getByText(/view details/i)).toBeInTheDocument();
    });

    test('should not show view details for LUNCH item', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockFoodItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      expect(screen.queryByText(/view details/i)).not.toBeInTheDocument();
    });

    test('should not show view details for TRAVEL item', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockTravelItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      expect(screen.queryByText(/view details/i)).not.toBeInTheDocument();
    });

    test('should fetch and display destination details', async () => {
      const mockDestination = {
        id: 1,
        name: 'Test Place',
        description: 'Test description',
        images: ['test-image.jpg'],
      };

      axios.get.mockResolvedValueOnce({ data: mockDestination });

      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const viewButton = screen.getByText(/view details/i);
      fireEvent.click(viewButton);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          '/api/destinations/1',
          expect.any(Object)
        );
      });
    });

    test('should handle fetch error gracefully', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const viewButton = screen.getByText(/view details/i);
      fireEvent.click(viewButton);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });
    });
  });

  describe('Drag and Drop', () => {
    test('should render drag handle', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      // Check for drag icon
      const dragHandle = screen.getByRole('img', { hidden: true });
      expect(dragHandle).toBeInTheDocument();
    });

    test('should apply dragging class when dragging', () => {
      const { container } = render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const itemCard = container.querySelector('.item-card');
      expect(itemCard).toBeInTheDocument();
    });
  });

  describe('Theme Classes', () => {
    test('should apply default theme for regular destinations', () => {
      const { container } = render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const itemCard = container.querySelector('.theme-default');
      expect(itemCard).toBeInTheDocument();
    });

    test('should apply lunch theme for food items', () => {
      const { container } = render(
        <DndWrapper>
          <ItemCard
            item={mockFoodItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const itemCard = container.querySelector('.theme-lunch');
      expect(itemCard).toBeInTheDocument();
    });

    test('should apply travel theme for travel items', () => {
      const { container } = render(
        <DndWrapper>
          <ItemCard
            item={mockTravelItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const itemCard = container.querySelector('.theme-travel');
      expect(itemCard).toBeInTheDocument();
    });
  });

  describe('Duration Options', () => {
    test('should render all duration options', () => {
      render(
        <DndWrapper>
          <ItemCard
            item={mockItem}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const durationSelect = screen.getByDisplayValue(/2 hours/i);
      fireEvent.mouseDown(durationSelect);

      // Check for common duration options
      expect(screen.getByText(/15 minutes/i)).toBeInTheDocument();
      expect(screen.getByText(/30 minutes/i)).toBeInTheDocument();
      expect(screen.getByText(/1 hour/i)).toBeInTheDocument();
    });

    test('should format duration correctly', () => {
      const itemWith90Min = { ...mockItem, duration: 90 };

      render(
        <DndWrapper>
          <ItemCard
            item={itemWith90Min}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      expect(screen.getByDisplayValue(/1\.5/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('should handle item without time slot', () => {
      const itemNoTime = { ...mockItem, time_slot: null };

      render(
        <DndWrapper>
          <ItemCard
            item={itemNoTime}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      const timeInput = screen.getByRole('textbox', { type: 'time' });
      expect(timeInput.value).toBe('');
    });

    test('should handle item without duration', () => {
      const itemNoDuration = { ...mockItem, duration: null };

      render(
        <DndWrapper>
          <ItemCard
            item={itemNoDuration}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      // Should default to 60 minutes
      expect(screen.getByDisplayValue(/1 hour/i)).toBeInTheDocument();
    });

    test('should handle item with uniqueId same as id', () => {
      const itemSameIds = {
        ...mockItem,
        id: 'same-id',
        uniqueId: 'same-id',
      };

      render(
        <DndWrapper>
          <ItemCard
            item={itemSameIds}
            index={0}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            dayId={dayId}
          />
        </DndWrapper>
      );

      // Should not show view details button
      expect(screen.queryByText(/view details/i)).not.toBeInTheDocument();
    });
  });
});