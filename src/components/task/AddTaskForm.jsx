import { useState } from "react";
import Icon from "../common/Icon";
import DatePicker from "react-datepicker";
import { format, addDays, nextMonday } from "date-fns";
import DatePickerPopover from "./DatePickerPopover";

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

  taskPriority,
  setTaskPriority,

  isDatePickerOpen,
  setIsDatePickerOpen,

  activeProject,

  projects,
  setActiveProject,

  isTaskProjectMenuOpen,
  setIsTaskProjectMenuOpen,

  setIsAddingTask,
}) {
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const priorities = [
    { value: "urgent", label: "Urgent", color: "#dc2626" },
    { value: "high", label: "High", color: "#f97316" },
    { value: "medium", label: "Medium", color: "#d97706" },
    { value: "low", label: "Low", color: "#6b7280" },
  ];

  const selectedPriority =
    priorities.find((item) => item.value === taskPriority) || priorities[2];
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
          onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
          className={taskDeadline ? "has-date" : ""}
        >
          <Icon
            name="calendar"
            size={14}
            color={taskDeadline ? "#058527" : "currentColor"}
          />
          <span style={{ color: taskDeadline ? "#058527" : "inherit" }}>
            {taskDeadline ? format(taskDeadline, "d MMM") : "Date"}{" "}
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
        <button>
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
        <div className="project-selector" style={{ position: "relative" }}>
          <button
            onClick={() => setIsTaskProjectMenuOpen(!isTaskProjectMenuOpen)}
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
        <div className="footer-actions">
          <button
            className="cancel-btn"
            onClick={() => {
              setIsAddingTask(false);
              setNewTaskTitle("");
              setNewTaskDesc("");
              setTaskDeadline(null);
              setTaskTime("");
              setTaskPriority("medium");
            }}
          >
            Cancel
          </button>
          <button
            className="submit-btn"
            onClick={handleAddTask}
            disabled={!newTaskTitle.trim()}
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
