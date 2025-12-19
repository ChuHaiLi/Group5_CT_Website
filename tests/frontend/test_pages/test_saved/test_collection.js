/**
 * Unit tests for CollectionsTab component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CollectionsTab from '@/pages/Saved/CollectionsTab';

describe('CollectionsTab', () => {
  const mockDestinations = [
    {
      id: 1,
      name: 'Vịnh Hạ Long',
      province_name: 'Quảng Ninh',
      image_url: 'https://example.com/halong.jpg'
    },
    {
      id: 2,
      name: 'Phố Cổ Hội An',
      province_name: 'Quảng Nam',
      image_url: 'https://example.com/hoian.jpg'
    },
    {
      id: 3,
      name: 'Chợ Bến Thành',
      province_name: 'TP. Hồ Chí Minh',
      image_url: 'https://example.com/benthanh.jpg'
    }
  ];

  const mockFolders = [
    { id: 1, name: 'Summer Trip', items: [1, 2] },
    { id: 2, name: 'Winter Trip', items: [3] }
  ];

  const mockOnCreateFolder = jest.fn();
  const mockOnDeleteFolder = jest.fn();
  const mockOnAddToFolder = jest.fn();
  const mockOnRemoveFromFolder = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders folder grid view', () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    expect(screen.getByText('New Folder')).toBeInTheDocument();
    expect(screen.getByText('Summer Trip')).toBeInTheDocument();
    expect(screen.getByText('Winter Trip')).toBeInTheDocument();
  });

  test('shows folder item counts', () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('1 items')).toBeInTheDocument();
  });

  test('calls onCreateFolder when new folder clicked', () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const newFolderCard = screen.getByText('New Folder').closest('.folder-card');
    fireEvent.click(newFolderCard);

    expect(mockOnCreateFolder).toHaveBeenCalled();
  });

  test('opens folder detail view on folder click', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Summer Trip')).toBeInTheDocument();
    });
  });

  test('shows folder destinations in detail view', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      expect(screen.getByText('Vịnh Hạ Long')).toBeInTheDocument();
      expect(screen.getByText('Phố Cổ Hội An')).toBeInTheDocument();
    });
  });

  test('shows empty state in empty folder', async () => {
    const emptyFolders = [
      { id: 1, name: 'Empty Folder', items: [] }
    ];

    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={emptyFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const emptyFolder = screen.getByText('Empty Folder').closest('.folder-card');
    fireEvent.click(emptyFolder);

    await waitFor(() => {
      expect(screen.getByText('This folder is empty.')).toBeInTheDocument();
    });
  });

  test('opens add items modal', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    // Open folder
    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const addButton = screen.getByText('Add Place');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Add to "Summer Trip"')).toBeInTheDocument();
      expect(screen.getByText('Select places from your Saved list')).toBeInTheDocument();
    });
  });

  test('shows available destinations in add modal', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const addButton = screen.getByText('Add Place');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      // Summer Trip already has items 1 & 2, so only item 3 should be available
      expect(screen.getByText('Chợ Bến Thành')).toBeInTheDocument();
      expect(screen.queryByText('Vịnh Hạ Long')).not.toBeInTheDocument();
    });
  });

  test('selects items in add modal', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const addButton = screen.getByText('Add Place');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      const itemRow = screen.getByText('Chợ Bến Thành').closest('.select-item-row');
      fireEvent.click(itemRow);
    });

    await waitFor(() => {
      const itemRow = screen.getByText('Chợ Bến Thành').closest('.select-item-row');
      expect(itemRow).toHaveClass('selected');
    });
  });

  test('adds items to folder', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const addButton = screen.getByText('Add Place');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      const itemRow = screen.getByText('Chợ Bến Thành').closest('.select-item-row');
      fireEvent.click(itemRow);
    });

    const applyButton = screen.getByText(/Add \(1\)/);
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(mockOnAddToFolder).toHaveBeenCalledWith(1, [3]);
    });
  });

  test('opens remove items modal', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const removeButton = screen.getByText('Remove Place');
      fireEvent.click(removeButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Remove from "Summer Trip"')).toBeInTheDocument();
      expect(screen.getByText('Select places to remove')).toBeInTheDocument();
    });
  });

  test('removes items from folder', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const removeButton = screen.getByText('Remove Place');
      fireEvent.click(removeButton);
    });

    await waitFor(() => {
      const itemRow = screen.getByText('Vịnh Hạ Long').closest('.select-item-row');
      fireEvent.click(itemRow);
    });

    const applyButton = screen.getByText(/Remove \(1\)/);
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(mockOnRemoveFromFolder).toHaveBeenCalledWith(1, [1]);
    });
  });

  test('disables remove button in empty folder', async () => {
    const emptyFolders = [
      { id: 1, name: 'Empty Folder', items: [] }
    ];

    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={emptyFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const emptyFolder = screen.getByText('Empty Folder').closest('.folder-card');
    fireEvent.click(emptyFolder);

    await waitFor(() => {
      const removeButton = screen.getByText('Remove Place');
      expect(removeButton).toBeDisabled();
    });
  });

  test('cancels add modal', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const addButton = screen.getByText('Add Place');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Add to "Summer Trip"')).not.toBeInTheDocument();
    });
  });

  test('goes back to folder list', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);
    });

    await waitFor(() => {
      expect(screen.getByText('New Folder')).toBeInTheDocument();
      expect(screen.queryByText('Add Place')).not.toBeInTheDocument();
    });
  });

  test('deletes folder', () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const deleteButtons = screen.getAllByTitle('Delete Folder');
    fireEvent.click(deleteButtons[0]);

    expect(mockOnDeleteFolder).toHaveBeenCalledWith(1);
  });

  test('shows no items message in add modal when all saved', async () => {
    const fullFolders = [
      { id: 1, name: 'Full Folder', items: [1, 2, 3] }
    ];

    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={fullFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const fullFolder = screen.getByText('Full Folder').closest('.folder-card');
    fireEvent.click(fullFolder);

    await waitFor(() => {
      const addButton = screen.getByText('Add Place');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(screen.getByText('No other saved items available.')).toBeInTheDocument();
    });
  });

  test('disables apply button when no items selected', async () => {
    render(
      <CollectionsTab
        allDestinations={mockDestinations}
        folders={mockFolders}
        onCreateFolder={mockOnCreateFolder}
        onDeleteFolder={mockOnDeleteFolder}
        onAddToFolder={mockOnAddToFolder}
        onRemoveFromFolder={mockOnRemoveFromFolder}
      />
    );

    const summerTripFolder = screen.getByText('Summer Trip').closest('.folder-card');
    fireEvent.click(summerTripFolder);

    await waitFor(() => {
      const addButton = screen.getByText('Add Place');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      const applyButton = screen.getByText(/Add \(0\)/);
      expect(applyButton).toBeDisabled();
    });
  });
});