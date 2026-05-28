import { useEffect, useState } from "react";
import { format } from "date-fns";
import Icon from "../common/Icon";
import DatePickerPopover from "../task/DatePickerPopover";
import { useToast } from "../../context/ToastContext";
import api from "../../api/axiosInstance";

const API_ORIGIN = "http://localhost:5000";

export default function EditTaskModal({
  selectedTask,
  setSelectedTask,
  handleUpdateTask,
  userRole,
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);

  const priorities = [
    { value: "urgent", label: "Urgent" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const selectedPriority =
    priorities.find((item) => item.value === priority) || priorities[2];

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title || "");
      setDescription(selectedTask.description || "");
      setDeadline(selectedTask.deadline ? new Date(selectedTask.deadline) : null);
      setTime(selectedTask.time ? selectedTask.time.slice(0, 5) : "");
      setPriority(selectedTask.priority || "medium");
      setAssignedTo(selectedTask.assigned_to || "");
      setSaving(false);
      setIsDatePickerOpen(false);
      setIsPriorityOpen(false);
      setAttachment(null);
    }
  }, [selectedTask]);

  useEffect(() => {
    if (selectedTask?.project_id) {
      api.get(`/teams/projects/${selectedTask.project_id}/members`)
        .then((res) => {
          setMembers(res.data.members || []);
        })
        .catch((err) => console.error("Error loading project members in EditTaskModal:", err));
    } else {
      setMembers([]);
    }
  }, [selectedTask?.project_id]);

  useEffect(() => {
    if (!selectedTask) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedTask(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedTask, setSelectedTask]);

  if (!selectedTask) return null;

  const handleSave = async () => {
    if (!title.trim() || saving) return;

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("deadline", deadline ? deadline.toISOString() : "");
      formData.append("time", time || "");
      formData.append("priority", priority);
      formData.append("project_id", selectedTask.project_id || "");
      formData.append("assigned_to", assignedTo || "");

      if (attachment) {
        formData.append("attachment", attachment);
      }

      await handleUpdateTask(selectedTask.task_id, formData);

      setSelectedTask(null);
    } finally {
      setSaving(false);
    }
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files[0] || null;

    if (file && file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      setAttachment(null);
      showToast("File vượt quá dung lượng tối đa 5MB", "error");
      return;
    }

    setAttachment(file);
  };

  return (
    <div
      className="edit-task-overlay"
      onClick={() => setSelectedTask(null)}
    >
      <div
        className="edit-task-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-task-header">
          <div className="edit-task-context">
            <Icon name="hash" size={14} />
            <span>{selectedTask.project_name || "Task"}</span>
          </div>
          <button
            type="button"
            className="edit-task-close-btn"
            onClick={() => setSelectedTask(null)}
            aria-label="Close edit task"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="edit-task-form">
          <textarea
            className="input-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task name"
            autoFocus
          />

          <textarea
            className="input-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />

          <div className="edit-task-actions" style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              className={`edit-task-chip ${deadline ? "has-date" : ""}`}
            >
              <Icon
                name="calendar"
                size={14}
                color={deadline ? "#058527" : "currentColor"}
              />
              <span style={{ color: deadline ? "#058527" : "inherit" }}>
                {deadline ? format(deadline, "d MMM") : "Date"}{" "}
                {time && `at ${time}`}
              </span>
              {deadline && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeadline(null);
                    setTime("");
                  }}
                  className="clear-date-btn"
                >
                  x
                </span>
              )}
            </button>

            <label
              className={`edit-task-chip attachment-btn ${
                attachment || selectedTask.attachment_url ? "has-attachment" : ""
              }`}
            >
              <Icon name="paperclip" size={14} />
              <span>
                {attachment?.name || selectedTask.attachment_name || "Attachment"}
              </span>
              <input
                type="file"
                hidden
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                onChange={handleAttachmentChange}
              />
            </label>

            {(userRole === 'owner' || userRole === 'leader') && (
              <div className="assignee-picker" style={{ display: "inline-block" }}>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="edit-task-chip assignee-select"
                  style={{
                    background: "var(--bg-secondary, rgba(255, 255, 255, 0.05))",
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                    color: "var(--text-primary, #fff)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    outline: "none",
                    cursor: "pointer",
                    height: "28px",
                    fontSize: "13px",
                  }}
                >
                  <option value="">Giao cho...</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id} style={{ background: "#222" }}>
                      {m.username} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="priority-picker">
              <button
                type="button"
                className={`edit-task-chip priority-trigger priority-${selectedPriority.value}`}
                onClick={() => setIsPriorityOpen((prev) => !prev)}
              >
                <Icon name="flag" size={14} />
                {selectedPriority.label}
              </button>

              {isPriorityOpen && (
                <div className="priority-menu">
                  {priorities.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`priority-option priority-${item.value}`}
                      onClick={() => {
                        setPriority(item.value);
                        setIsPriorityOpen(false);
                      }}
                    >
                      <Icon name="flag" size={14} />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isDatePickerOpen && (
              <DatePickerPopover
                taskDeadline={deadline}
                setTaskDeadline={setDeadline}
                taskTime={time}
                setTaskTime={setTime}
                setIsDatePickerOpen={setIsDatePickerOpen}
              />
            )}
          </div>

          {(attachment || selectedTask.attachment_url) && (
            <div className="edit-task-attachment-row">
              <Icon name="paperclip" size={14} />
              {selectedTask.attachment_url && !attachment ? (
                <a
                  href={`${API_ORIGIN}${selectedTask.attachment_url}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selectedTask.attachment_name || "Attachment"}
                </a>
              ) : (
                <span>{attachment.name}</span>
              )}
              {attachment && (
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                >
                  Remove
                </button>
              )}
            </div>
          )}

          <div className="edit-task-footer">
            <div className="footer-actions">
              <button
                className="cancel-btn"
                type="button"
                onClick={() => setSelectedTask(null)}
              >
                Cancel
              </button>

              <button
                className="submit-btn"
                type="button"
                onClick={handleSave}
                disabled={!title.trim() || saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
