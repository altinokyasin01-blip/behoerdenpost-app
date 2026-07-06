import Modal from "../components/Modal.jsx";
import { CategoryEditor } from "../components/CategoryChip.jsx";

export default function CategoryRenameModal({ value, existingCategories, onSave, onCancel }) {
  return (
    <Modal onClose={onCancel}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">Kategorie umbenennen</div>
          <div className="detail-sender">
            Alle Dokumente unter „{value}" werden auf den neuen Namen verschoben.
          </div>
        </div>
        <CategoryEditor
          value={value}
          existingCategories={existingCategories}
          onChange={onSave}
          onCancel={onCancel}
        />
      </div>
    </Modal>
  );
}
