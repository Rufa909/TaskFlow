import { useEffect, useState } from "react";
import Icon from "../common/Icon";

export default function EditTaskModal({
  selectedTask,
  setSelectedTask,
  handleUpdateTask,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title || "");
      setDescription(selectedTask.description || "");
      setTime(selectedTask.time || "");
    }
  }, [selectedTask]);

  if (!selectedTask) return null;

  const handleSave = async () => {
    await handleUpdateTask(selectedTask.task_id, {
      title,
      description,
      deadline: selectedTask.deadline,
      time,
    });

    setSelectedTask(null);
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
        <input
          className="edit-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task name"
        />

        <textarea
          className="edit-task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
        />

        <div className="edit-task-time">
          <Icon name="clock" size={14} />
          
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div className="edit-task-footer">
          <button
            className="cancel-btn"
            onClick={() => setSelectedTask(null)}
          >
            Cancel
          </button>

          <button
            className="submit-btn"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}