import Icon from "../common/Icon";

export default function AddProjectModal({
  isAddProjectModalOpen,
  setIsAddProjectModalOpen,

  newProjectName,
  setNewProjectName,

  handleAddProject
}) {

  if (!isAddProjectModalOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onClick={() =>
        setIsAddProjectModalOpen(false)
      }
    >

      {isAddProjectModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsAddProjectModalOpen(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add project</h2>
              <button
                className="icon-btn"
                onClick={() => setIsAddProjectModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label>Name</label>
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Work, Personal"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setIsAddProjectModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddProject}
                disabled={!newProjectName.trim() || savingProject}
                className="submit-btn"
              >
                {savingProject ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}