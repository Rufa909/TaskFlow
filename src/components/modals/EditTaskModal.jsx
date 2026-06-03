import { useEffect, useState } from "react";
import { format } from "date-fns";
import Icon from "../common/Icon";
import DatePickerPopover from "../task/DatePickerPopover";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosInstance";

const API_ORIGIN = "http://localhost:5000";
const TASK_BLUE = "#1e88e5";

const priorities = [
  { value: "urgent", label: "P1", name: "Urgent", color: TASK_BLUE },
  { value: "high", label: "P1", name: "High", color: TASK_BLUE },
  { value: "medium", label: "P2", name: "Medium", color: TASK_BLUE },
  { value: "low", label: "P3", name: "Low", color: TASK_BLUE },
];

function toLocalDateTimeInput(value) {
  if (!value) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}T00:00:00`;
}

function formatTaskDate(value, taskTime) {
  if (!value) return "Add date";
  return format(value, taskTime ? "d MMM HH:mm" : "d MMM");
}

export default function EditTaskModal({
  selectedTask,
  setSelectedTask,
  handleUpdateTask,
  handleCompleteTask,
  availableLabels = [],
}) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [labels, setLabels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isLabelsOpen, setIsLabelsOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const selectedPriority =
    priorities.find((item) => item.value === priority) || priorities[2];

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title || "");
      setDescription(selectedTask.description || "");
      setDeadline(selectedTask.deadline ? new Date(selectedTask.deadline) : null);
      setTime(
        selectedTask.time && selectedTask.time.slice(0, 5) !== "00:00"
          ? selectedTask.time.slice(0, 5)
          : "",
      );
      setPriority(selectedTask.priority || "medium");
      setLabels(Array.isArray(selectedTask.labels) ? selectedTask.labels : []);
      setSaving(false);
      setIsDatePickerOpen(false);
      setIsPriorityOpen(false);
      setIsLabelsOpen(false);
      setAttachments([]);
      setSubtasks([]);
      setComments([]);
      setSubtaskDraft("");
      setCommentDraft("");
      setIsAddingSubtask(false);
    }
  }, [selectedTask]);

  useEffect(() => {
    if (!selectedTask?.project_id || !selectedTask?.task_id) return;

    let active = true;

    const loadDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const res = await api.get(
          `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/details`,
        );
        if (!active) return;
        setSubtasks(res.data.subtasks || []);
        setComments(res.data.comments || []);
      } catch (err) {
        if (!active) return;
        showToast("Không thể tải chi tiết task", "error");
      } finally {
        if (active) setIsLoadingDetails(false);
      }
    };

    loadDetails();
    return () => {
      active = false;
    };
  }, [selectedTask?.project_id, selectedTask?.task_id, showToast]);

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
      formData.append("deadline", deadline ? toLocalDateTimeInput(deadline) : "");
      formData.append("time", time || "");
      formData.append("priority", priority);
      formData.append("labels", JSON.stringify(labels));
      formData.append("project_id", selectedTask.project_id || "");

      attachments.forEach((file) => formData.append("attachments", file));

      await handleUpdateTask(selectedTask.task_id, formData);
      setSelectedTask(null);
    } finally {
      setSaving(false);
    }
  };

  const completeCurrentTask = async () => {
    if (!selectedTask) return;

    try {
      if (handleCompleteTask) {
        await handleCompleteTask(selectedTask);
      } else {
        await api.post(
          `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/complete`,
        );
      }
      setSelectedTask(null);
    } catch (err) {
      showToast("Không thể hoàn thành task", "error");
    }
  };

  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    const oversized = files.find((file) => file.size > 5 * 1024 * 1024);

    if (oversized) {
      event.target.value = "";
      setAttachments([]);
      showToast("File vượt quá dung lượng tối đa 5MB", "error");
      return;
    }

    setAttachments(files);
  };

  const selectedAttachmentFiles = Array.isArray(attachments) ? attachments : [];

  const toggleTaskLabel = (label) => {
    setLabels((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  };

  const createSubtask = async () => {
    const title = subtaskDraft.trim();
    if (!title) return;

    try {
      const res = await api.post(
        `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/subtasks`,
        { title },
      );
      setSubtasks((prev) => [...prev, res.data.subtask]);
      setSubtaskDraft("");
      setIsAddingSubtask(false);
    } catch (err) {
      showToast("Không thể thêm sub-task", "error");
    }
  };

  const toggleSubtask = async (subtask) => {
    const nextCompleted = !subtask.completed_at;
    try {
      const res = await api.put(
        `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/subtasks/${subtask.subtask_id}`,
        { completed: nextCompleted },
      );
      setSubtasks((prev) =>
        prev.map((item) =>
          item.subtask_id === subtask.subtask_id ? res.data.subtask : item,
        ),
      );
    } catch (err) {
      showToast("Không thể cập nhật sub-task", "error");
    }
  };

  const deleteSubtask = async (subtaskId) => {
    try {
      await api.delete(
        `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/subtasks/${subtaskId}`,
      );
      setSubtasks((prev) => prev.filter((item) => item.subtask_id !== subtaskId));
    } catch (err) {
      showToast("Không thể xóa sub-task", "error");
    }
  };

  const createComment = async () => {
    const body = commentDraft.trim();
    if (!body) return;

    try {
      const res = await api.post(
        `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/comments`,
        { body },
      );
      setComments((prev) => [...prev, res.data.comment]);
      setCommentDraft("");
    } catch (err) {
      showToast("Không thể gửi comment", "error");
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await api.delete(
        `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/comments/${commentId}`,
      );
      setComments((prev) => prev.filter((item) => item.comment_id !== commentId));
    } catch (err) {
      showToast("Không thể xóa comment", "error");
    }
  };

  return (
    <div className="edit-task-overlay" onClick={() => setSelectedTask(null)}>
      <div className="edit-task-modal todoist-detail-modal" onClick={(e) => e.stopPropagation()}>
        <header className="edit-detail-topbar">
          <div className="edit-detail-project">
            <Icon name="edit" size={15} />
            <span>Edit Task</span>
          </div>

          <div className="edit-detail-top-actions">
            {/* <button type="button" className="edit-detail-icon-btn" aria-label="Previous task">
              <Icon name="chevronUp" size={18} />
            </button>
            <button type="button" className="edit-detail-icon-btn" aria-label="Next task">
              <Icon name="chevronDown" size={18} />
            </button>
            <button type="button" className="edit-detail-icon-btn" aria-label="More actions">
              <Icon name="more" size={18} />
            </button> */}
            <button
              type="button"
              className="edit-detail-save-btn"
              onClick={handleSave}
              disabled={!title.trim() || saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="edit-detail-close-btn"
              onClick={() => setSelectedTask(null)}
              aria-label="Close edit task"
            >
              <Icon name="x" size={22} />
            </button>
          </div>
        </header>

        <div className="edit-detail-body">
          <main className="edit-detail-main">
            <div className="edit-detail-task-head">
              <div className="edit-detail-title-wrap">
                <textarea
                  className="edit-detail-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task name"
                  autoFocus
                />
                <textarea
                  className="edit-detail-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                />
              </div>
            </div>
            {(selectedAttachmentFiles.length > 0 || selectedTask.attachment_url) && (
              <div className="edit-detail-attachment-row">
                <Icon name="paperclip" size={14} />
                {selectedTask.attachment_url && selectedAttachmentFiles.length === 0 ? (
                  <a
                    href={`${API_ORIGIN}${selectedTask.attachment_url}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selectedTask.attachment_name || "Attachment"}
                  </a>
                ) : (
                  <span>
                    {selectedAttachmentFiles.length > 1
                      ? selectedAttachmentFiles.map((file) => file.name).join(", ")
                      : selectedAttachmentFiles[0]?.name}
                  </span>
                )}
                {selectedAttachmentFiles.length > 0 && (
                  <button type="button" onClick={() => setAttachments([])}>
                    Remove
                  </button>
                )}
              </div>
            )}

            <div className="edit-detail-subtasks">
              {isLoadingDetails && (
                <div className="edit-detail-loading">Đang tải chi tiết...</div>
              )}

              {subtasks.map((subtask) => (
                <div className="edit-detail-subtask" key={subtask.subtask_id}>
                  <button
                    type="button"
                    className={`edit-detail-subtask-check ${subtask.completed_at ? "done" : ""}`}
                    onClick={() => toggleSubtask(subtask)}
                    aria-label="Toggle sub-task"
                  >
                    {subtask.completed_at && <Icon name="check" size={12} />}
                  </button>
                  <span className={subtask.completed_at ? "done" : ""}>{subtask.title}</span>
                  <button
                    type="button"
                    className="edit-detail-subtask-delete"
                    onClick={() => deleteSubtask(subtask.subtask_id)}
                    aria-label="Delete sub-task"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}

              {isAddingSubtask ? (
                <div className="edit-detail-subtask-form">
                  <input
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    placeholder="Sub-task name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createSubtask();
                      if (e.key === "Escape") {
                        setIsAddingSubtask(false);
                        setSubtaskDraft("");
                      }
                    }}
                  />
                  <button type="button" onClick={createSubtask} disabled={!subtaskDraft.trim()}>
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSubtask(false);
                      setSubtaskDraft("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="edit-detail-subtask-btn"
                  onClick={() => setIsAddingSubtask(true)}
                >
                  <Icon name="plus" size={18} />
                  Add sub-task
                </button>
              )}
            </div>

            <div className="edit-detail-comment-row">
              <div className="edit-detail-avatar">Q</div>
              <div className="edit-detail-comment-input">
                <input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Comment"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createComment();
                  }}
                />
                <label className="edit-detail-attach-btn">
                  <Icon name="paperclip" size={18} />
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                    onChange={handleAttachmentChange}
                  />
                </label>
                <button
                  type="button"
                  className="edit-detail-comment-send"
                  onClick={createComment}
                  disabled={!commentDraft.trim()}
                >
                  Send
                </button>
              </div>
            </div>

            {comments.length > 0 && (
              <div className="edit-detail-comments">
                {comments.map((comment) => (
                  <div className="edit-detail-comment" key={comment.comment_id}>
                    <div className="edit-detail-comment-avatar">
                      {(comment.username || comment.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="edit-detail-comment-body">
                      <div className="edit-detail-comment-meta">
                        <strong>{comment.username || comment.email || "User"}</strong>
                        <span>
                          {comment.created_at
                            ? new Date(comment.created_at).toLocaleString("vi-VN")
                            : ""}
                        </span>
                      </div>
                      <p>{comment.body}</p>
                    </div>
                    {Number(comment.user_id) === Number(user?.id) && (
                      <button
                        type="button"
                        className="edit-detail-comment-delete"
                        onClick={() => deleteComment(comment.comment_id)}
                        aria-label="Delete comment"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>

          <aside className="edit-detail-sidebar">
            <section className="edit-detail-property">
              <div className="edit-detail-property-label">Project</div>
              <div className="edit-detail-property-value">
                
                <span>{selectedTask.project_name}</span>
              </div>
            </section>

            <section className="edit-detail-property">
              <div className="edit-detail-property-label">Date</div>
              <div className="edit-detail-property-control">
                <button
                  type="button"
                  className={`edit-detail-property-button ${deadline ? "has-value" : ""}`}
                  onClick={() => setIsDatePickerOpen((prev) => !prev)}
                >
                  <Icon name="calendar" size={15} color={deadline ? TASK_BLUE : "currentColor"} />
                  <span>
                    {formatTaskDate(deadline, time)}
                  </span>
                </button>

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
            </section>

            <section className="edit-detail-property locked">
              <div className="edit-detail-property-label">
                Deadline <span className="edit-detail-pro-dot">*</span>
              </div>
              <div className="edit-detail-property-value muted">
                <span />
                <Icon name="lock" size={16} />
              </div>
            </section>

            <section className="edit-detail-property">
              <div className="edit-detail-property-label">Priority</div>
              <div className="edit-detail-property-control">
                <button
                  type="button"
                  className="edit-detail-property-button"
                  onClick={() => setIsPriorityOpen((prev) => !prev)}
                >
                  <Icon name="flag" size={16} color={selectedPriority.color} />
                  <span>{selectedPriority.label}</span>
                </button>

                {isPriorityOpen && (
                  <div className="edit-detail-menu">
                    {priorities.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={priority === item.value ? "active" : ""}
                        onClick={() => {
                          setPriority(item.value);
                          setIsPriorityOpen(false);
                        }}
                      >
                        <Icon name="flag" size={15} color={item.color} />
                        <span>{item.label}</span>
                        <small>{item.name}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="edit-detail-property">
              <div className="edit-detail-property-label">Labels</div>
              <div className="edit-detail-property-control">
                <button
                  type="button"
                  className="edit-detail-property-button labels"
                  onClick={() => setIsLabelsOpen((prev) => !prev)}
                >
                  {labels.length > 0 ? (
                    <span>{labels.join(", ")}</span>
                  ) : (
                    <span>Add labels</span>
                  )}
                  <Icon name="plus" size={16} />
                </button>

                {isLabelsOpen && (
                  <div className="edit-detail-menu labels">
                    {availableLabels.length === 0 && (
                      <div className="edit-detail-empty-menu">No labels</div>
                    )}
                    {availableLabels.map((label) => (
                      <button
                        key={label.name}
                        type="button"
                        className={labels.includes(label.name) ? "active" : ""}
                        onClick={() => toggleTaskLabel(label.name)}
                      >
                        <Icon name="tag" size={14} color={label.color} />
                        <span>{label.name}</span>
                        {labels.includes(label.name) && <Icon name="check" size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
