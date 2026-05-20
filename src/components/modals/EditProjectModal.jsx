import Icon from "../common/Icon";

export default function EditProjectModal({
  isOpen,
  setIsOpen,
  project,
  name,
  setName,
  onSave,
  saving = false,
}) {
  if (!isOpen || !project) return null;

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit project</h2>
          <button className="icon-btn" onClick={() => setIsOpen(false)}>✕</button>
        </div>
        <div className="modal-body">
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && onSave()}
          />
        </div>
        <div className="modal-footer">
          <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
          <button onClick={onSave} disabled={!name.trim() || saving} className="submit-btn">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
