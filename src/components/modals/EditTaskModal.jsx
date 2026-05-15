import { useEffect, useState } from "react";
import { format } from "date-fns";
import Icon from "../common/Icon";
import DatePickerPopover from "../task/DatePickerPopover";

export default function EditTaskModal({
  selectedTask,
  setSelectedTask,
  handleUpdateTask,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);

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
      setSaving(false);
      setIsDatePickerOpen(false);
      setIsPriorityOpen(false);
    }
  }, [selectedTask]);

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
      await handleUpdateTask(selectedTask.task_id, {
        title: title.trim(),
        description: description.trim(),
        deadline: deadline || null,
        time,
        priority,
      });

      setSelectedTask(null);
    } finally {
      setSaving(false);
    }
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
          <div>
            <p className="edit-task-eyebrow">Task</p>
            <h2>Edit task</h2>
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

        <div className="add-task-form edit-task-form">
          <input
            className="input-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task name"
            autoFocus
          />

          <input
            className="input-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />

          <div className="form-actions-row" style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              className={deadline ? "has-date" : ""}
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

            <button type="button">
              <Icon name="paperclip" size={14} /> Attachment
            </button>

            <div className="priority-picker">
              <button
                type="button"
                className={`priority-trigger priority-${selectedPriority.value}`}
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

            <button type="button">
              <Icon name="clock" size={14} /> Reminders
            </button>
            <button type="button">
              <Icon name="more" size={14} />
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

          <div className="form-footer">
            <div className="edit-task-footer-label">
              <Icon name="edit" size={14} />
              Editing task
            </div>

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
