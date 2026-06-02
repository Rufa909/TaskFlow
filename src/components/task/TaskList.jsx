import { useEffect, useRef, useState } from "react";
import Icon from "../common/Icon";
import "./TaskList.css";

const API_ORIGIN = "http://localhost:5000";

const STATUS_LABELS = {
  DRAFT: "Draft",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  LEADER_APPROVED: "Leader approved",
  OWNER_APPROVED: "Owner approved",
  COMPLETED: "Completed",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
};

function getTaskAction(task) {
  switch (task.status) {
    case "DRAFT":
      return { label: "Draft", title: "Assign a member to start", disabled: true };
    case "ASSIGNED":
      return { label: "Accept", title: "Accept task", disabled: false };
    case "ACCEPTED":
      return { label: "Start", title: "Start task", disabled: false };
    case "IN_PROGRESS":
    case "CHANGES_REQUESTED":
      return { label: "Submit", title: "Submit for review", disabled: false };
    case "SUBMITTED":
      return { label: "Waiting", title: "Waiting for leader approval", disabled: true };
    case "LEADER_APPROVED":
      return { label: "Owner", title: "Waiting for owner approval", disabled: true };
    case "COMPLETED":
    case "OWNER_APPROVED":
      return { label: "Done", title: "Task completed", disabled: true };
    case "REJECTED":
      return { label: "Rejected", title: "Task rejected", disabled: true };
    default:
      return { label: "Done", title: "Complete task", disabled: false };
  }
}

function canReviewTask(task, userRole) {
  return (
    (userRole === "leader" && task.status === "SUBMITTED") ||
    (userRole === "owner" && task.status === "LEADER_APPROVED")
  );
}

function canWorkOnTask(task, userId) {
  return Number(task.assigned_to) === Number(userId);
}

function canManageTask(task, userRole, userId) {
  return (
    userRole === "owner" ||
    userRole === "leader" ||
    Number(task.created_by) === Number(userId)
  );
}

export default function TaskList({
  tasks,
  handleDeleteTask,
  handleCompleteTask = () => {},
  handleReviewTaskSubmission = () => {},
  currentUserRole = "",
  currentUserId = null,
  highlightedTaskId = null,
  setSelectedTask,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [changesTask, setChangesTask] = useState(null);
  const [changesReason, setChangesReason] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {tasks.map((task) => {
        const action = getTaskAction(task);
        const statusLabel = STATUS_LABELS[task.status] || task.status;
        const reviewable = canReviewTask(task, currentUserRole);
        const manageable = canManageTask(task, currentUserRole, currentUserId);
        const actionable = canWorkOnTask(task, currentUserId) && !action.disabled;
        const displayAction = action.disabled
          ? action
          : actionable
            ? action
            : { ...action, disabled: true, title: "Only the assigned member can do this" };

        return (
          <div
            key={task.task_id || task.id}
            data-task-id={task.task_id}
            className={`task-item ${
              Number(highlightedTaskId) === Number(task.task_id) ? "highlighted" : ""
            }`}
            onClick={() => setSelectedTask(task)}
          >
            {reviewable ? (
              <div className="task-review-actions">
                <button
                  className="task-review-btn approve"
                  type="button"
                  title="Approve submission"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReviewTaskSubmission(task, "approve");
                  }}
                >
                  Approve
                </button>
                <button
                  className="task-review-btn changes"
                  type="button"
                  title="Request changes"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChangesTask(task);
                    setChangesReason("");
                  }}
                >
                  Changes
                </button>
              </div>
            ) : (
              <button
                className={`checkbox task-status-action ${displayAction.disabled ? "disabled" : ""}`}
                type="button"
                aria-label={displayAction.title}
                title={displayAction.title}
                disabled={displayAction.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (displayAction.disabled) return;
                  handleCompleteTask(task);
                }}
              >
                <span>{displayAction.label}</span>
              </button>
            )}

            <button
              className={`task-more-btn ${openMenuId === task.task_id ? "active" : ""}`}
              type="button"
              aria-label="Task actions"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === task.task_id ? null : task.task_id);
              }}
            >
              <Icon name="more" size={16} />
            </button>

            {openMenuId === task.task_id && (
              <div
                className="task-dropdown-menu"
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="task-dropdown-section">
                  {manageable && (
                    <button
                      className="task-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                        setOpenMenuId(null);
                      }}
                    >
                      <span className="task-dropdown-icon">
                        <Icon name="edit" size={15} />
                      </span>
                      <span>Edit task</span>
                    </button>
                  )}

                  <button
                    className="task-dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                    }}
                  >
                    <span className="task-dropdown-icon">
                      <Icon name="clock" size={15} />
                    </span>
                    <span>Reminders</span>
                  </button>
                </div>

                {manageable && (
                  <>
                    <div className="task-dropdown-divider"></div>
                    <button
                      className="task-dropdown-item delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(task.task_id);
                        setOpenMenuId(null);
                      }}
                    >
                      <span className="task-dropdown-icon">
                        <Icon name="trash" size={15} />
                      </span>
                      <span>Delete task</span>
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="task-content">
              <div className="task-title-row">
                <div className="task-title">{task.title}</div>
                {statusLabel && (
                  <span className={`task-status-badge status-${task.status?.toLowerCase()}`}>
                    {statusLabel}
                  </span>
                )}
              </div>

              {task.description && <div className="task-meta">{task.description}</div>}

              {task.attachment_url && (
                <a
                  href={`${API_ORIGIN}${task.attachment_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="task-attachment-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon name="paperclip" size={14} />
                  <span>{task.attachment_name || "Attachment"}</span>
                </a>
              )}

              {task.deadline && (
                <div
                  className="task-meta"
                  style={{
                    color: "rgb(5, 133, 39)",
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Icon name="calendar" size={12} />
                  {new Date(task.deadline).toLocaleDateString()}
                  {task.time && <span className="task-time">{task.time.slice(0, 5)}</span>}
                </div>
              )}

              {task.priority && (
                <div className={`task-priority priority-${task.priority}`}>
                  <Icon name="flag" size={12} /> {task.priority}
                </div>
              )}

              {task.labels && task.labels.length > 0 && (
                <div className="task-labels">
                  {task.labels.map((label, idx) => (
                    <span key={idx} className="task-label-badge">
                      <Icon name="hash" size={10} />
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {task.project_name && (
                <div className="task-project-label">
                  {task.project_name} <Icon name="hash" size={10} />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {changesTask && (
        <div className="task-changes-overlay" onClick={() => setChangesTask(null)}>
          <div className="task-changes-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="task-changes-header">
              <h3>Request changes</h3>
              <button
                type="button"
                className="task-changes-close"
                aria-label="Close"
                onClick={() => setChangesTask(null)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="task-changes-body">
              <div className="task-changes-task">{changesTask.title}</div>
              <textarea
                value={changesReason}
                onChange={(e) => setChangesReason(e.target.value)}
                placeholder="Nhap ly do can sua..."
                autoFocus
              />
            </div>
            <div className="task-changes-footer">
              <button
                type="button"
                className="task-changes-secondary"
                onClick={() => setChangesTask(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="task-changes-submit"
                disabled={!changesReason.trim()}
                onClick={() => {
                  handleReviewTaskSubmission(changesTask, "reject", changesReason.trim());
                  setChangesTask(null);
                  setChangesReason("");
                }}
              >
                Send changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
