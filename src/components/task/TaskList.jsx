import { useEffect, useRef, useState } from "react";
import Icon from "../common/Icon";

export default function TaskList({
  tasks,
  handleDeleteTask,
  handleUpdateTask,
  handleCompleteTask = () => {},
  setSelectedTask,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);

  const menuRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  return (
    <>
      {tasks.map((task) => (
        <div
          key={task.task_id || task.id}
          className="task-item"
          onClick={() => setSelectedTask(task)}
        >
          <button
            className="checkbox"
            type="button"
            aria-label="Complete task"
            title="Complete task"
            onClick={(e) => {
              e.stopPropagation();
              handleCompleteTask(task);
            }}
          ></button>
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
            </div>
          )}
          <div className="task-content">
            <div className="task-title">{task.title}</div>

            {task.description && (
              <div className="task-meta">{task.description}</div>
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
                {task.time && (
                  <span className="task-time">{task.time.slice(0, 5)}</span>
                )}
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
      ))}
    </>
  );
}
