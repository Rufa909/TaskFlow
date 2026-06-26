import { useEffect, useState } from "react";
import Icon from "../common/Icon";
import DatePicker from "react-datepicker";
import { format, addDays, nextMonday } from "date-fns";
import DatePickerPopover from "./DatePickerPopover";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosInstance";

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
  const isMember = userRole === "member";
  const assignableMembers = projectMembers.filter(
    (member) => member.role === "member",
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
    setIsTaskProjectMenuOpen(false);
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);
    const oversized = files.find((file) => file.size > 5 * 1024 * 1024);

    if (oversized) {
      e.target.value = "";
      setTaskAttachment([]);
      showToast("File vượt quá dung lượng tối đa 5MB", "error");
      return;
    }

    setTaskAttachment(files);
  };

  const selectedFiles = Array.isArray(taskAttachment)
    ? taskAttachment
    : taskAttachment
      ? [taskAttachment]
      : [];

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
        <label className="attachment-btn">
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
            disabled={!newTaskTitle.trim() || isMember}
            title={isMember ? "Members cannot create tasks in this project" : ""}
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
