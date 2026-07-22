import { useEffect, useState } from "react";
import Icon from "../common/Icon";
import DatePicker from "react-datepicker";
import { format, addDays, nextMonday } from "date-fns";
import DatePickerPopover from "./DatePickerPopover";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosInstance";

const TASK_ASSIGNABLE_ROLES = ["member", "ba", "developer", "qa", "devops"];
const TASK_CREATOR_ROLES = ["owner", "leader", "ba", "developer", "qa", "devops"];

export default function AddTaskForm({
  newTaskTitle,
  setNewTaskTitle,

  newTaskDesc,
  setNewTaskDesc,

  handleAddTask,

  taskDeadline,
  setTaskDeadline,

  taskTime,
  setTaskTime,

  taskAttachment,
  setTaskAttachment,
  stageDocuments = [],
  taskDocumentIds = [],
  setTaskDocumentIds = () => {},

  taskPriority,
  setTaskPriority,

  taskLabels = [],
  setTaskLabels = () => {},
  availableLabels = [],
  taskAssignee = [],
  setTaskAssignee = () => {},

  isDatePickerOpen,
  setIsDatePickerOpen,

  activeProject,

  projects,
  setActiveProject,

  isTaskProjectMenuOpen,
  setIsTaskProjectMenuOpen,

  setIsAddingTask,
}) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isLabelsDropdownOpen, setIsLabelsDropdownOpen] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isAttachmentPopupOpen, setIsAttachmentPopupOpen] = useState(false);
  const priorities = [
    { value: "urgent", label: "Urgent", color: "#dc2626" },
    { value: "high", label: "High", color: "#f97316" },
    { value: "medium", label: "Medium", color: "#d97706" },
    { value: "low", label: "Low", color: "#6b7280" },
  ];

const selectedPriority =
    priorities.find((item) => item.value === taskPriority) || priorities[2];

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      if (!activeProject?.project_id) {
        setProjectMembers([]);
        setTaskAssignee([]);
        return;
      }

      try {
        const res = await api.get(
          `/teams/projects/${activeProject.project_id}/members`,
        );
        if (!active) return;
        setProjectMembers(res.data.members || []);
        setTaskAssignee([]);
      } catch (err) {
        if (!active) return;
        setProjectMembers([]);
      }
    }

    loadMembers();
    return () => {
      active = false;
    };
  }, [activeProject?.project_id, setTaskAssignee]);

  const currentMember = projectMembers.find(
    (member) => Number(member.user_id) === Number(user?.id),
  );
  const isOwner = Number(activeProject?.owner_id) === Number(user?.id);
  const userRole = isOwner ? "owner" : (currentMember?.role || "member");
  const canAssignTask = ["owner", "leader"].includes(userRole);
  const canCreateTask = TASK_CREATOR_ROLES.includes(userRole);
  const assignableMembers = projectMembers.filter((member) =>
    TASK_ASSIGNABLE_ROLES.includes(member.role),
  );
  const selectedAssigneeIds = Array.isArray(taskAssignee)
    ? taskAssignee.map(Number)
    : taskAssignee
      ? [Number(taskAssignee)]
      : [];
  const selectedAssignees = assignableMembers.filter((member) =>
    selectedAssigneeIds.includes(Number(member.user_id)),
  );

  const closeOptionPopups = () => {
    setIsDatePickerOpen(false);
    setIsPriorityOpen(false);
    setIsLabelsDropdownOpen(false);
    setIsAssigneeOpen(false);
    setIsAttachmentPopupOpen(false);
    setIsTaskProjectMenuOpen(false);
  };

  const selectedFiles = Array.isArray(taskAttachment)
    ? taskAttachment
    : taskAttachment
      ? [taskAttachment]
      : [];
  const availableStageDocuments = Array.isArray(stageDocuments)
    ? stageDocuments.filter((doc) => doc?.file_url || doc?.url)
    : [];
  const selectedDocumentIds = Array.isArray(taskDocumentIds)
    ? taskDocumentIds.map(Number)
    : [];
  const selectedDocuments = availableStageDocuments.filter((doc) =>
    selectedDocumentIds.includes(Number(doc.document_id)),
  );
  const selectedAttachmentCount =
    availableStageDocuments.length > 0 ? selectedDocuments.length : selectedFiles.length;

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);
    const oversized = files.find((file) => file.size > 20 * 1024 * 1024);

    if (oversized) {
      e.target.value = "";
      setTaskAttachment([]);
      setIsAttachmentPopupOpen(false);
      showToast("File vượt quá dung lượng tối đa 20MB", "error");
      return;
    }

    setTaskAttachment(files);
    setIsAttachmentPopupOpen(files.length > 0);
    e.target.value = "";
  };

  const removeSelectedFile = (indexToRemove) => {
    const nextFiles = selectedFiles.filter((_, index) => index !== indexToRemove);
    setTaskAttachment(nextFiles);
    setIsAttachmentPopupOpen(nextFiles.length > 0);
  };

  const clearSelectedFiles = () => {
    setTaskAttachment([]);
    setIsAttachmentPopupOpen(false);
  };

  const toggleStageDocument = (documentId) => {
    const normalizedId = Number(documentId);
    setTaskDocumentIds((prev) => {
      const values = Array.isArray(prev) ? prev.map(Number) : [];
      return values.includes(normalizedId)
        ? values.filter((id) => id !== normalizedId)
        : [...values, normalizedId];
    });
  };

  const clearSelectedDocuments = () => {
    setTaskDocumentIds([]);
    setIsAttachmentPopupOpen(false);
  };

  const formatFileSize = (size) => {
    if (!Number.isFinite(size)) return "";
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  };

  const toggleTaskLabel = (label) => {
    setTaskLabels((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  };

  return (
    <div className="add-task-form">
      <input
        className="input-title"
        placeholder="Task name"
        value={newTaskTitle}
        onChange={(e) => setNewTaskTitle(e.target.value)}
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
      />
      <input
        className="input-desc"
        placeholder="Description"
        value={newTaskDesc}
        onChange={(e) => setNewTaskDesc(e.target.value)}
      />
      <div className="form-actions-row" style={{ position: "relative" }}>
        <button
          onClick={() => {
            const nextOpen = !isDatePickerOpen;
            closeOptionPopups();
            setIsDatePickerOpen(nextOpen);
          }}
          className={taskDeadline ? "has-date" : ""}
        >
          <Icon
            name="calendar"
            size={14}
            color={taskDeadline ? "#058527" : "currentColor"}
          />
          <span style={{ color: taskDeadline ? "#058527" : "inherit" }}>
            {taskDeadline ? format(taskDeadline, "d MMM") : "Deadline"}{" "}
            {taskTime && `at ${taskTime}`}
          </span>
          {taskDeadline && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setTaskDeadline(null);
                setTaskTime("");
              }}
              className="clear-date-btn"
            >
              ×
            </span>
          )}
        </button>
        <div className="attachment-picker">
          {availableStageDocuments.length > 0 ? (
            <button
              type="button"
              className={`attachment-btn ${selectedAttachmentCount > 0 ? "has-files" : ""}`}
              onClick={() => {
                const nextOpen = !isAttachmentPopupOpen;
                closeOptionPopups();
                setIsAttachmentPopupOpen(nextOpen);
              }}
            >
              <Icon name="paperclip" size={14} />
              {selectedAttachmentCount > 0
                ? `${selectedAttachmentCount} document${selectedAttachmentCount > 1 ? "s" : ""}`
                : "Attachment"}
            </button>
          ) : (
            <label className={`attachment-btn ${selectedFiles.length > 0 ? "has-files" : ""}`}>
              <Icon name="paperclip" size={14} />
              {selectedFiles.length > 1
                ? `${selectedFiles.length} files`
                : selectedFiles[0]?.name || "Attachment"}
              <input
                type="file"
                hidden
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                onChange={handleAttachmentChange}
              />
            </label>
          )}

          {isAttachmentPopupOpen && availableStageDocuments.length > 0 && (
            <div className="attachment-popup document-picker-popup">
              <div className="attachment-popup-header">
                <span>Documents stage trước</span>
                {selectedDocuments.length > 0 && (
                  <button type="button" onClick={clearSelectedDocuments}>
                    Clear
                  </button>
                )}
              </div>
              <div className="attachment-popup-list">
                {availableStageDocuments.map((doc) => {
                  const checked = selectedDocumentIds.includes(Number(doc.document_id));
                  return (
                    <button
                      key={doc.document_id}
                      type="button"
                      className={`attachment-popup-item document-option ${checked ? "selected" : ""}`}
                      onClick={() => toggleStageDocument(doc.document_id)}
                    >
                      <span className="document-check">
                        {checked && <Icon name="check" size={13} />}
                      </span>
                      <Icon name="paperclip" size={14} />
                      <span className="attachment-popup-main">
                        <strong>{doc.title || doc.original_name || "Document"}</strong>
                        <small>{doc.document_type || doc.original_name || "Stage document"}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isAttachmentPopupOpen && availableStageDocuments.length === 0 && selectedFiles.length > 0 && (
            <div className="attachment-popup">
              <div className="attachment-popup-header">
                <span>Documents selected</span>
                <button type="button" onClick={clearSelectedFiles}>
                  Clear
                </button>
              </div>
              <div className="attachment-popup-list">
                {selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${file.size}-${index}`} className="attachment-popup-item">
                    <Icon name="paperclip" size={14} />
                    <span className="attachment-popup-main">
                      <strong>{file.name}</strong>
                      <small>{formatFileSize(file.size)}</small>
                    </span>
                    <button
                      type="button"
                      className="attachment-popup-remove"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeSelectedFile(index)}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="priority-picker">
          <button
            type="button"
            className={`priority-trigger priority-${selectedPriority.value}`}
            onClick={() => {
              const nextOpen = !isPriorityOpen;
              closeOptionPopups();
              setIsPriorityOpen(nextOpen);
            }}
          >
            <Icon name="flag" size={14} />
            {selectedPriority.label}
          </button>

          {isPriorityOpen && (
            <div className="priority-menu">
              {priorities.map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  className={`priority-option priority-${priority.value}`}
                  onClick={() => {
                    setTaskPriority(priority.value);
                    setIsPriorityOpen(false);
                  }}
                >
                  <Icon name="flag" size={14} />
                  {priority.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {availableLabels.length > 0 && (
          <div className="task-label-dropdown" style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                const nextOpen = !isLabelsDropdownOpen;
                closeOptionPopups();
                setIsLabelsDropdownOpen(nextOpen);
              }}
              className="task-add-label-btn"
            >
              <Icon name="tag" size={14} />
              Add label
              <Icon name={isLabelsDropdownOpen ? "chevronUp" : "chevronDown"} size={12} />
            </button>
            {isLabelsDropdownOpen && (
              <div className="task-label-dropdown-menu">
                {availableLabels.map((label) => (
                  <button
                    key={label.name}
                    type="button"
                    className={`task-label-option ${taskLabels.includes(label.name) ? "active" : ""}`}
                    onClick={() => {
                      toggleTaskLabel(label.name);
                      setIsLabelsDropdownOpen(false);
                    }}
                    style={{
                      color: label.color,
                      borderColor: label.color,
                    }}
                  >
                    <Icon name="tag" size={12} />
                    <span className="task-label-text">{label.name}</span>
                    {taskLabels.includes(label.name) && <Icon name="check" size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {canAssignTask && assignableMembers.length > 0 && (
          <div className="assignee-picker">
            <button
              type="button"
              className={selectedAssigneeIds.length > 0 ? "has-assignee" : ""}
              onClick={() => {
                const nextOpen = !isAssigneeOpen;
                closeOptionPopups();
                setIsAssigneeOpen(nextOpen);
              }}
            >
              <Icon name="user" size={14} />
              {selectedAssignees.length > 0
                ? `${selectedAssignees.length} member${selectedAssignees.length > 1 ? "s" : ""}`
                : "Assign"}
              <Icon name={isAssigneeOpen ? "chevronUp" : "chevronDown"} size={12} />
            </button>
            {isAssigneeOpen && (
              <div className="assignee-menu">
                <button
                  type="button"
                  className="assignee-option"
                  onClick={() => {
                    setTaskAssignee([]);
                    setIsAssigneeOpen(false);
                  }}
                >
                  No assignee
                </button>
                {assignableMembers.map((member) => (
                  <button
                    type="button"
                    className={`assignee-option ${selectedAssigneeIds.includes(Number(member.user_id)) ? "active" : ""}`}
                    key={member.user_id}
                    onClick={() => {
                      setTaskAssignee((prev) => {
                        const values = Array.isArray(prev)
                          ? prev.map(Number)
                          : prev
                            ? [Number(prev)]
                            : [];
                        const userId = Number(member.user_id);
                        return values.includes(userId)
                          ? values.filter((id) => id !== userId)
                          : [...values, userId];
                      });
                      setIsAssigneeOpen(false);
                    }}
                  >
                    <span>{member.username}</span>
                    <span className="assignee-role">{member.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button>
          <Icon name="clock" size={14} /> Reminders
        </button>
        <button>
          <Icon name="more" size={14} />
        </button>

        {/* Date Picker Popover */}
        {isDatePickerOpen && (
          <DatePickerPopover
            taskDeadline={taskDeadline}
            setTaskDeadline={setTaskDeadline}
            taskTime={taskTime}
            setTaskTime={setTaskTime}
            setIsDatePickerOpen={setIsDatePickerOpen}
          />
        )}
      </div>
      <div className="form-footer">
        <div className="form-footer-left">
          <div className="project-selector" style={{ position: "relative" }}>
            <button
              onClick={() => {
                const nextOpen = !isTaskProjectMenuOpen;
                closeOptionPopups();
                setIsTaskProjectMenuOpen(nextOpen);
              }}
            >
              <Icon name="hash" size={14} />
              {activeProject?.name || "Project"}
              <Icon name="chevronDown" size={14} />
            </button>
            {isTaskProjectMenuOpen && (
              <div
                className="project-dropdown-menu"
                style={{
                  bottom: "100%",
                  top: "auto",
                  marginBottom: "4px",
                  left: 0,
                }}
              >
                {projects.map((proj) => (
                  <div
                    key={proj.project_id}
                    className="project-dropdown-item"
                    onClick={() => {
                      setActiveProject(proj);
                      setIsTaskProjectMenuOpen(false);
                    }}
                  >
                    <Icon name="hash" size={14} /> {proj.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {taskLabels.length > 0 && (
            <div className="form-footer-labels">
              {taskLabels.map((label) => {
                const labelObj = availableLabels.find((l) => l.name === label);
                return (
                  <span
                    key={label}
                    className="form-footer-label"
                    style={{
                      backgroundColor: labelObj?.color || "#e5e7eb",
                      borderColor: labelObj?.color || "#d1d5db",
                    }}
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => toggleTaskLabel(label)}
                      className="form-footer-label-remove"
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="footer-actions">
          <button
            className="cancel-btn"
            onClick={() => {
              setIsAddingTask(false);
              setNewTaskTitle("");
              setNewTaskDesc("");
              setTaskDeadline(null);
              setTaskTime("");
              setTaskAttachment([]);
              setTaskDocumentIds([]);
              setIsAttachmentPopupOpen(false);
              setTaskPriority("medium");
              setTaskLabels([]);
              setTaskAssignee([]);
            }}
          >
            Cancel
          </button>
          <button
            className="submit-btn"
            onClick={handleAddTask}
            disabled={!newTaskTitle.trim() || !canCreateTask}
            title={!canCreateTask ? "Your role cannot create tasks in this project" : ""}
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
