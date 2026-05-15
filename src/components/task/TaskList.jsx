import Icon from "../common/Icon";

export default function TaskList({ tasks }) {
  return (
    <>
      {tasks.map((task) => (
        <div key={task.task_id || task.id} className="task-item">
          <div className="checkbox"></div>

          <div className="task-content">
            <div className="task-title">{task.title}</div>

            {task.description && (
              <div className="task-meta">{task.description}</div>
            )}

            {task.deadline && task.time && (
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
                <span className="task-time">{task.time.slice(0, 5)}</span>
              </div>
            )}
            
          </div>
        </div>
      ))}
    </>
  );
}
