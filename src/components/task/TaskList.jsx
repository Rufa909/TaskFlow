import { useEffect, useRef, useState } from "react";
import Icon from "../common/Icon";

export default function TaskList({
  tasks,
  handleDeleteTask,
  handleUpdateTask,
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
          <div className="checkbox"></div>
          <button
            className="task-more-btn"
            onClick={(e) => {
              e.stopPropagation();

              setOpenMenuId(openMenuId === task.task_id ? null : task.task_id);
            }}
          >
            <Icon name="more" size={16} />
          </button>
          {openMenuId === task.task_id && (
            <div className="task-dropdown-menu" ref={menuRef}>
              <button
                className="task-dropdown-item"
                onClick={() => {
                  setSelectedTask(task);

                  setOpenMenuId(null);
                }}
              >
                <Icon name="edit" size={14} />
                Edit task
              </button>

              <button className="task-dropdown-item">
                <Icon name="clock" size={14} />
                Reminders
              </button>

              <button
                className="task-dropdown-item delete"
                onClick={() => {
                  handleDeleteTask(task.task_id);
                  setOpenMenuId(null);
                }}
              >
                <Icon name="trash" size={14} />
                Delete task
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
          </div>
        </div>
      ))}
    </>
  );
}
