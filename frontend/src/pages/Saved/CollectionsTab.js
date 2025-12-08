import React, { useState } from "react";
import RecommendCard from "../Home/Recommendations/RecommendCard";
import { FaFolder, FaPlus, FaArrowLeft, FaTrash, FaMinusCircle, FaCheck } from "react-icons/fa";
import CreateTripForm from "../../components/CreateTripForm";

export default function CollectionsTab({ 
  allDestinations, 
  folders, 
  onCreateFolder, 
  onDeleteFolder, 
  onAddToFolder, 
  onRemoveFromFolder
}) {
  // --- STATE ---
  const [activeFolderId, setActiveFolderId] = useState(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  
  const [selectedItems, setSelectedItems] = useState([]);

    const [showForm, setShowForm] = useState(false);
    const [selectedDestination, setSelectedDestination] = useState(null);

  // Tìm folder hiện tại
  const activeFolder = folders.find(f => f.id === activeFolderId);

  // --- LOGIC ---
  const openFolder = (folderId) => setActiveFolderId(folderId);
  const backToFolders = () => setActiveFolderId(null);

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  // --- API HANDLERS ---
  const handleCreateTrip = (destinationObj) => {
    setSelectedDestination(destinationObj);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setSelectedDestination(null);
    setShowForm(false);
  };

  // Logic Add
  const handleApplyAdd = () => {
    if (activeFolderId && selectedItems.length > 0) {
      onAddToFolder(activeFolderId, selectedItems);
      setShowAddModal(false);
      setSelectedItems([]); // Reset danh sách chọn
    }
  };

  // Logic Remove
  const handleApplyRemove = () => {
    if (activeFolderId && selectedItems.length > 0) {
      selectedItems.forEach(id => onRemoveFromFolder(activeFolderId, id));
      
      setShowRemoveModal(false);
      setSelectedItems([]); // Reset danh sách chọn
    }
  };

  const handleCancelModal = () => {
    setShowAddModal(false);
    setShowRemoveModal(false);
    setSelectedItems([]); // Reset danh sách chọn khi bấm Cancel
  };

  // --- VIEW 1: DANH SÁCH FOLDER (ROOT) ---
  if (!activeFolderId || !activeFolder) {
    return (
      <div className="collections-root">
        <div className="folders-grid">
          <div className="folder-card create-new" onClick={onCreateFolder}>
            <div className="folder-icon-circle"><FaPlus /></div>
            <span>New Folder</span>
          </div>
          {folders.map(folder => (
            <div key={folder.id} className="folder-card" onClick={() => openFolder(folder.id)}>
              <FaFolder className="folder-icon" />
              <div className="folder-info">
                <h4>{folder.name}</h4>
                <p>{folder.items.length} items</p>
              </div>
              <button 
                className="delete-folder-btn" 
                onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                title="Delete Folder"
              >
                <FaTrash />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- VIEW 2: CHI TIẾT FOLDER (INSIDE) ---
  const folderDestinations = allDestinations.filter(dest => 
    activeFolder.items.includes(dest.id)
  );

  const availableDestinations = allDestinations.filter(dest => 
    !activeFolder.items.includes(dest.id)
  );

  return (
    <div className="folder-detail-view">
      <div className="folder-detail-header">
        <button className="back-btn" onClick={backToFolders}>
          <FaArrowLeft /> Back
        </button>

        <div className="folder-header-row"> 
            {/*Folder bên trái*/}
            <h2>{activeFolder.name}</h2>
            
            {/* Cụm nút bên phải */}
            <div className="folder-actions">
                <button 
                    className="action-btn remove-btn" 
                    onClick={() => setShowRemoveModal(true)}
                    disabled={folderDestinations.length === 0}
                    style={{opacity: folderDestinations.length === 0 ? 0.5 : 1}}
                >
                    <FaMinusCircle /> Remove Place
                </button>
                
                <button className="action-btn add-btn" onClick={() => setShowAddModal(true)}>
                    <FaPlus /> Add Place
                </button>
            </div>
            
        </div>
      </div>

      <div className="saved-grid">
        {folderDestinations.length === 0 ? (
           <p style={{color: '#9ca3af', width: '100%', textAlign: 'center', marginTop: '2rem'}}>This folder is empty.</p>
        ) : (
            folderDestinations.map(dest => (
            <RecommendCard 
                key={dest.id} 
                destination={dest} 
                isSaved={true} 
                // Bấm tim để xóa nhanh 1 item
                onToggleSave={() => onRemoveFromFolder(activeFolder.id, dest.id)} 
                onCreateTrip={() => handleCreateTrip(dest)} 
            />
            ))
        )}
      </div>

      {/* --- MODAL 1: ADD ITEMS --- */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="add-to-folder-modal">
            <div className="modal-header">
              <h3>Add to "{activeFolder.name}"</h3>
              <p>Select places from your Saved list</p>
            </div>
            
            <div className="modal-body-list">
              {availableDestinations.length === 0 ? (
                <p className="no-items-text">No other saved items available.</p>
              ) : (
                availableDestinations.map(dest => (
                  <div 
                    key={dest.id} 
                    className={`select-item-row ${selectedItems.includes(dest.id) ? 'selected' : ''}`}
                    onClick={() => toggleSelectItem(dest.id)}
                  >
                    <img src={Array.isArray(dest.image_url) ? dest.image_url[0] : dest.image_url} alt="" />
                    <div className="select-item-info">
                      <strong>{dest.name}</strong>
                      <span>{dest.province_name}</span>
                    </div>
                    <div className="checkbox-circle">
                      {selectedItems.includes(dest.id) && <div className="inner-check"><FaCheck size={10} color="white"/></div>}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelModal}>Cancel</button>
              <button 
                className="btn-apply" 
                onClick={handleApplyAdd}
                disabled={selectedItems.length === 0}
              >
                Apply ({selectedItems.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: REMOVE ITEMS --- */}
      {showRemoveModal && (
        <div className="modal-overlay">
          <div className="add-to-folder-modal">
            <div className="modal-header">
              <h3>Remove from "{activeFolder.name}"</h3>
              <p>Select places to remove</p>
            </div>
            
            <div className="modal-body-list">
              {folderDestinations.map(dest => (
                <div 
                  key={dest.id} 
                  className={`select-item-row ${selectedItems.includes(dest.id) ? 'selected-remove' : ''}`} // Class khác màu cho remove
                  onClick={() => toggleSelectItem(dest.id)}
                >
                  <img 
                    src={Array.isArray(dest.image_url) ? dest.image_url[0] : dest.image_url} 
                    alt="" 
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  <div className="select-item-info">
                    <strong>{dest.name}</strong>
                    <span>{dest.province_name}</span>
                  </div>
                  <div className="checkbox-circle remove-style">
                    {selectedItems.includes(dest.id) && <div className="inner-check"><FaCheck size={10} color="white"/></div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelModal}>Cancel</button>
              <button 
                className="btn-apply btn-danger" 
                onClick={handleApplyRemove}
                disabled={selectedItems.length === 0}
              >
                Remove ({selectedItems.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && selectedDestination && (
        <CreateTripForm
          initialDestination={selectedDestination}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}