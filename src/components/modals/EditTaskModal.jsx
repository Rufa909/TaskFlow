import { useEffect, useState } from "react";
import { format } from "date-fns";
import Icon from "../common/Icon";
import DatePickerPopover from "../task/DatePickerPopover";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axiosInstance";
import { isPastLocalDate, parseLocalDate, toLocalDateTime } from "../../utils/dateTime";
import "./EditTaskModal.css";

const API_ORIGIN = "http://localhost:5000";
const TASK_BLUE = "#1e88e5";

const priorities = [
  { value: "urgent", label: "P1", name: "Urgent", color: TASK_BLUE },
  { value: "high", label: "P2", name: "High", color: TASK_BLUE },
  { value: "medium", label: "P3", name: "Medium", color: TASK_BLUE },
  { value: "low", label: "P4", name: "Low", color: TASK_BLUE },
];

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
  const [isAssigneesOpen, setIsAssigneesOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectMembers, setProjectMembers] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [taskAttachments, setTaskAttachments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const canEditTask = ["owner", "leader"].includes(userRole);
  const isMember = !canEditTask;
  const [commentAttachments, setCommentAttachments] = useState([]);

  const selectedPriority =
    priorities.find((item) => item.value === priority) || priorities[2];

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title || "");
      setDescription(selectedTask.description || "");
      setDeadline(selectedTask.deadline ? parseLocalDate(selectedTask.deadline) : null);
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
      setIsAssigneesOpen(false);
      setProjectName(selectedTask.project_name || "");
      setAssigneeIds(
        Array.isArray(selectedTask.assignee_ids)
          ? selectedTask.assignee_ids.map(Number)
          : selectedTask.assigned_to
            ? [Number(selectedTask.assigned_to)]
            : [],
      );
      setAttachments([]);
      setTaskAttachments([]);
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
        setUserRole(res.data.role || "member");
        setProjectName(res.data.project_name || selectedTask.project_name || "");
        setTaskAttachments(res.data.attachments || []);
        setProjectMembers(res.data.members || []);
        setAssigneeIds((res.data.assignees || []).map((member) => Number(member.user_id)));
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
    if (!canEditTask || !title.trim() || saving) return;
    if (isPastLocalDate(deadline)) {
      showToast("Ngày đã qua, vui lòng chọn hôm nay hoặc ngày sau.", "error");
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("deadline", deadline ? toLocalDateTime(deadline, time || "00:00:00") : "");
      formData.append("time", time || "");
      formData.append("priority", priority);
      formData.append("labels", JSON.stringify(labels));
      formData.append("project_id", selectedTask.project_id || "");
      formData.append("assigned_to", JSON.stringify(assigneeIds));

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

    setAttachments((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const handleCommentAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    const oversized = files.find((file) => file.size > 5 * 1024 * 1024);

    if (oversized) {
      event.target.value = "";
      showToast("File vượt quá dung lượng tối đa 5MB", "error");
      return;
    }

    setCommentAttachments((prev) => [...prev, ...files]);
  };

  const selectedAttachmentFiles = Array.isArray(attachments) ? attachments : [];

  const removeSelectedAttachmentFile = (index) => {
    setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const closePropertyPopups = () => {
    setIsDatePickerOpen(false);
    setIsPriorityOpen(false);
    setIsLabelsOpen(false);
    setIsAssigneesOpen(false);
  };

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
    if (!body && commentAttachments.length === 0) return;

    try {
      const formData = new FormData();
      if (body) formData.append("body", body);
      commentAttachments.forEach((file) => formData.append("attachments", file));

      const res = await api.post(
        `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/comments`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setComments((prev) => [...prev, res.data.comment]);
      setCommentDraft("");
      setCommentAttachments([]);
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

  const deleteTaskAttachment = async (attachmentId) => {
    try {
      await api.delete(
        `/projects/${selectedTask.project_id}/tasks/${selectedTask.task_id}/attachments/${attachmentId}`,
      );
      setTaskAttachments((prev) =>
        prev.filter((item) => item.attachment_id !== attachmentId),
      );
      showToast("Đã xóa file đính kèm", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể xóa file đính kèm", "error");
    }
  };

  return (
    <div className="edit-task-overlay" onClick={() => setSelectedTask(null)}>
      <div className="edit-task-modal todoist-detail-modal" onClick={(e) => e.stopPropagation()}>
        <header className="edit-detail-topbar">
          <div className="edit-detail-project">
            <Icon name="edit" size={15} />
            <span>{canEditTask ? "Edit Task" : "Task Details"}</span>
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
            {canEditTask && (
              <button
                type="button"
                className="edit-detail-save-btn"
                onClick={handleSave}
                disabled={!title.trim() || saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
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
                  disabled={isMember}
                />
                <textarea
                  className="edit-detail-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  disabled={isMember}
                />
              </div>
            </div>
            {(taskAttachments.length > 0 || selectedAttachmentFiles.length > 0) && (
              <div className="edit-detail-attachments">
                {taskAttachments.map((attachment) => (
                  <div className="edit-detail-attachment-row" key={attachment.attachment_id}>
                    <Icon name="paperclip" size={14} />
                    <a
                      href={`${API_ORIGIN}${attachment.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {attachment.originalName || "Attachment"}
                    </a>
                    {!isMember && (
                      <button
                        type="button"
                        className="edit-detail-attachment-delete"
                        onClick={() => deleteTaskAttachment(attachment.attachment_id)}
                        aria-label="Delete attachment"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {selectedAttachmentFiles.map((file, index) => (
                  <div className="edit-detail-attachment-row pending" key={`${file.name}-${index}`}>
                    <Icon name="paperclip" size={14} />
                    <span>{file.name}</span>
                    {!isMember && (
                      <button
                        type="button"
                        className="edit-detail-attachment-delete"
                        onClick={() => removeSelectedAttachmentFile(index)}
                        aria-label="Remove selected file"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!isMember && (
              <label className="edit-detail-task-attach-btn">
                <Icon name="paperclip" size={14} /> <span>Thêm file đính kèm cho Task</span>
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                  onChange={handleAttachmentChange}
                />
              </label>
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
                    onClick={() => !isMember && toggleSubtask(subtask)}
                    aria-label="Toggle sub-task"
                    disabled={isMember}
                  >
                    {subtask.completed_at && <Icon name="check" size={12} />}
                  </button>
                  <span className={subtask.completed_at ? "done" : ""}>{subtask.title}</span>
                  {!isMember && (
                    <button
                      type="button"
                      className="edit-detail-subtask-delete"
                      onClick={() => deleteSubtask(subtask.subtask_id)}
                      aria-label="Delete sub-task"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>
              ))}

              {!isMember && (isAddingSubtask ? (
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
              ))}
            </div>

            <div className="edit-detail-comment-row">
              <div className="edit-detail-avatar">
                {user?.user_photo ? (
                  <img src={`${API_ORIGIN}${user.user_photo}`} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  user?.username ? user.username[0].toUpperCase() : "U"
                )}
              </div>
              <div className="edit-detail-comment-input-wrap">
                <div className="edit-detail-comment-box">
                  <input
                    className="edit-detail-comment-field"
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
                      onChange={handleCommentAttachmentChange}
                    />
                  </label>
                  <button
                    type="button"
                    className="edit-detail-comment-send"
                    onClick={createComment}
                    disabled={!commentDraft.trim() && commentAttachments.length === 0}
                  >
                    Send
                  </button>
                </div>
                {commentAttachments.length > 0 && (
                  <div className="edit-detail-comment-attachments-preview">
                    <Icon name="paperclip" size={14} />
                    {commentAttachments.map((f) => f.name).join(", ")}
                    <button type="button" onClick={() => setCommentAttachments([])}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {comments.length > 0 && (
              <div className="edit-detail-comments">
                {comments.map((comment) => (
                  <div className="edit-detail-comment-item" key={comment.comment_id}>
                    <div className="edit-detail-comment-avatar">
                      {comment.user_photo ? (
                        <img src={`${API_ORIGIN}${comment.user_photo}`} alt={comment.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        comment.username ? comment.username[0].toUpperCase() : "U"
                      )}
                    </div>
                    <div className="edit-detail-comment-content">
                      <div className="edit-detail-comment-author">
                        {comment.username || "User"}
                        <span className="edit-detail-comment-time">
                          {new Date(comment.created_at).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      {comment.body && <div className="edit-detail-comment-text">{comment.body}</div>}
                      
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="edit-detail-comment-attachments">
                          {comment.attachments.map((att) => (
                            <a
                              key={att.attachment_id}
                              href={`${API_ORIGIN}${att.file_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="edit-detail-attachment-link"
                            >
                              <Icon name="paperclip" size={14} />
                              {att.originalName}
                            </a>
                          ))}
                        </div>
                      )}

                      {Number(comment.user_id) === Number(user?.id) && (
                        <button
                          type="button"
                          className="edit-detail-comment-delete"
                          onClick={() => deleteComment(comment.comment_id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>

          <aside className="edit-detail-sidebar">
            <section className="edit-detail-property">
              <div className="edit-detail-property-label">Project</div>
              <div className="edit-detail-property-value">
                
                <Icon name="hash" size={15} />
                <span>{projectName || `Project #${selectedTask.project_id}`}</span>
              </div>
            </section>

            <section className="edit-detail-property">
              <div className="edit-detail-property-label">Deadline</div>
              <div className="edit-detail-property-control">
                <button
                  type="button"
                  className={`edit-detail-property-button ${deadline ? "has-value" : ""}`}
                  onClick={() => {
                    if (isMember) return;
                    const nextOpen = !isDatePickerOpen;
                    closePropertyPopups();
                    setIsDatePickerOpen(nextOpen);
                  }}
                  disabled={isMember}
                >
                  <Icon name="calendar" size={15} color={deadline ? TASK_BLUE : "currentColor"} />
                  <span>
                    {formatTaskDate(deadline, time)}
                  </span>
                </button>

                {isDatePickerOpen && !isMember && (
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

            <section className="edit-detail-property">
              <div className="edit-detail-property-label">Assignees</div>
              <div className="edit-detail-property-control">
                <button
                  type="button"
                  className="edit-detail-property-button labels"
                  onClick={() => {
                    if (isMember) return;
                    const nextOpen = !isAssigneesOpen;
                    closePropertyPopups();
                    setIsAssigneesOpen(nextOpen);
                  }}
                  disabled={isMember}
                >
                  <span>
                    {assigneeIds.length > 0
                      ? `${assigneeIds.length} member${assigneeIds.length > 1 ? "s" : ""}`
                      : "Add members"}
                  </span>
                  {!isMember && <Icon name="plus" size={16} />}
                </button>

                {isAssigneesOpen && !isMember && (
                  <div className="edit-detail-menu labels">
                    {projectMembers.length === 0 && (
                      <div className="edit-detail-empty-menu">No members</div>
                    )}
                    {projectMembers.map((member) => {
                      const selected = assigneeIds.includes(Number(member.user_id));
                      return (
                        <button
                          key={member.user_id}
                          type="button"
                          className={selected ? "active" : ""}
                          onClick={() => {
                            setAssigneeIds((prev) =>
                              selected
                                ? prev.filter((id) => id !== Number(member.user_id))
                                : [...prev, Number(member.user_id)],
                            );
                            setIsAssigneesOpen(false);
                          }}
                        >
                          <Icon name="user" size={14} />
                          <span>{member.username}</span>
                          {selected && <Icon name="check" size={14} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="edit-detail-property">
              <div className="edit-detail-property-label">Priority</div>
              <div className="edit-detail-property-control">
                <button
                  type="button"
                  className="edit-detail-property-button"
                  onClick={() => {
                    if (isMember) return;
                    const nextOpen = !isPriorityOpen;
                    closePropertyPopups();
                    setIsPriorityOpen(nextOpen);
                  }}
                  disabled={isMember}
                >
                  <Icon name="flag" size={16} color={selectedPriority.color} />
                  <span>{selectedPriority.label}</span>
                </button>

                {isPriorityOpen && !isMember && (
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
                  onClick={() => {
                    if (isMember) return;
                    const nextOpen = !isLabelsOpen;
                    closePropertyPopups();
                    setIsLabelsOpen(nextOpen);
                  }}
                  disabled={isMember}
                >
                  {labels.length > 0 ? (
                    <span>{labels.join(", ")}</span>
                  ) : (
                    <span>Add labels</span>
                  )}
                  {!isMember && <Icon name="plus" size={16} />}
                </button>

                {isLabelsOpen && !isMember && (
                  <div className="edit-detail-menu labels">
                    {availableLabels.length === 0 && (
                      <div className="edit-detail-empty-menu">No labels</div>
                    )}
                    {availableLabels.map((label) => (
                      <button
                        key={label.name}
                        type="button"
                        className={labels.includes(label.name) ? "active" : ""}
                        onClick={() => {
                          toggleTaskLabel(label.name);
                          setIsLabelsOpen(false);
                        }}
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
