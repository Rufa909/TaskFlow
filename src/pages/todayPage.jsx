import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import { getTranslation } from "../i18n/translations";
import "./todayPage.css";

import AddTaskForm from "../components/task/AddTaskForm";
import TaskList from "../components/task/TaskList";
import Icon from "../components/common/Icon";
import Sidebar from "../components/sidebar/Sidebar";
import AddProjectModal from "../components/modals/AddProjectModal";
import SettingsModal from "../components/modals/SettingsModal";
import EditTaskModal from "../components/modals/EditTaskModal";

export default function TodayPage() {
  const { user, logout, updateUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [selectedTask, setSelectedTask] = useState(null);
  const navigate = useNavigate();

  const t = (key) => getTranslation(language, key);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Project UI state
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  // Task UI state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(new Date()); // Default to today
  const [taskTime, setTaskTime] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTaskProjectMenuOpen, setIsTaskProjectMenuOpen] = useState(false);
  const [taskAttachment, setTaskAttachment] = useState(null);

  // To allow selecting project in AddTaskForm if needed
  const [activeProject, setActiveProject] = useState(null);

  // Profile dropdown state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get("/projects");
        const projs = res.data.projects || [];
        setProjects(projs);
        if (projs.length > 0) setActiveProject(projs[0]);
      } catch (err) {
        console.error("Cannot load projects:", err);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchTodayTasks = async () => {
      try {
        const res = await api.get("/tasks/today");
        setTasks(res.data.tasks || []);
      } catch (err) {
        console.error("Cannot load today's tasks:", err);
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchTodayTasks();
  }, []);

  const handleLogout = () => {
    if (window.confirm(t("confirmLogout"))) {
      logout();
      navigate("/auth", { replace: true });
    }
  };

  const handleDeleteTask = async (taskId) => {
    // We need project_id to delete. task object from /tasks/today has project_id
    const task = tasks.find((t) => t.task_id === taskId);
    if (!task) return;
    try {
      await api.delete(`/projects/${task.project_id}/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch (err) {
      console.error(err);
      alert("Cannot delete task");
    }
  };

  const handleUpdateTask = async (taskId, updatedData) => {
    const task = tasks.find((t) => t.task_id === taskId);
    if (!task) return;
    try {
      const res = await api.put(
        `/projects/${task.project_id}/tasks/${taskId}`,
        updatedData,
      );
      const updatedTask = {
        ...res.data.task,
        ...updatedData,
        project_name: task.project_name,
      };
      setTasks((prev) =>
        prev.map((t) => (t.task_id === taskId ? updatedTask : t)),
      );
    } catch (err) {
      console.error(err);
      alert("Cannot update task");
    }
  };

  const handleCompleteTask = async (task) => {
    if (!task?.task_id || !task?.project_id) return;

    try {
      await api.post(
        `/projects/${task.project_id}/tasks/${task.task_id}/complete`,
      );
      setTasks((prev) => prev.filter((item) => item.task_id !== task.task_id));
    } catch (err) {
      console.error(err);
      alert("Cannot complete task");
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !activeProject) return;
    const projId = activeProject.project_id;

    try {
      const formData = new FormData();
      formData.append("title", newTaskTitle.trim());
      formData.append("description", newTaskDesc.trim());
      formData.append(
        "deadline",
        taskDeadline ? taskDeadline.toISOString() : "",
      );
      formData.append("time", taskTime || "");
      formData.append("priority", taskPriority);

      if (taskAttachment) {
        formData.append("attachment", taskAttachment);
      }

      const res = await api.post(`/projects/${projId}/tasks`, formData);
      const newTask = {
        ...res.data.task,
        project_name: activeProject.name,
      };

      setTasks([...tasks, newTask]);

      setNewTaskTitle("");
      setNewTaskDesc("");
      setTaskDeadline(new Date());
      setTaskTime("");
      setTaskPriority("medium");
      setTaskAttachment(null);
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error adding task");
    }
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    setSavingProject(true);
    try {
      const res = await api.post("/projects", { name: newProjectName.trim() });
      const created = res.data.project;
      setProjects((prev) => [...prev, created]);
      setActiveProject(created);
      setNewProjectName("");
      setIsAddProjectModalOpen(false);
      setIsProjectMenuOpen(false);
    } catch (err) {
      alert(t("cannotCreateProject"));
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    if (!window.confirm(t("deleteProjectConfirm"))) return;
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.project_id !== projectId));
      if (activeProject?.project_id === projectId) {
        setActiveProject(
          projects.length > 1
            ? projects.find((p) => p.project_id !== projectId)
            : null,
        );
      }
    } catch (err) {
      alert(t("cannotDeleteProject"));
    }
  };

  return (
    <div className="layout">
      <Sidebar
        user={user}
        projects={projects}
        activeProject={null} // Null because we are on "Today" view, not a specific project
        setActiveProject={() => {}} // Handle navigation in Sidebar directly
        setIsAddingTask={setIsAddingTask}
        loadingProjects={loadingProjects}
        handleDeleteProject={handleDeleteProject}
        t={t}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        handleLogout={handleLogout}
        isProjectMenuOpen={isProjectMenuOpen}
        setIsProjectMenuOpen={setIsProjectMenuOpen}
        setIsAddProjectModalOpen={setIsAddProjectModalOpen}
      />

      {/* Main Content */}
      <main className="main-content today-content">
        <header className="main-header">
          <div className="breadcrumb"></div>
          <div className="main-actions">
            <button className="action-btn">
              <Icon name="more" size={14} />
            </button>
          </div>
        </header>

        <div className="task-list-container">
          <div className="today-header">
            <h1 className="page-title today-title">Today</h1>
            <div className="today-task-count">
              <Icon name="checkCircle" size={14} /> {tasks.length} task
              {tasks.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="task-section">
            {loadingTasks ? (
              <div style={{ color: "#666" }}>Loading tasks...</div>
            ) : (
              <TaskList
                tasks={tasks}
                handleDeleteTask={handleDeleteTask}
                handleUpdateTask={handleUpdateTask}
                handleCompleteTask={handleCompleteTask}
                setSelectedTask={setSelectedTask}
              />
            )}

            {isAddingTask ? (
              <AddTaskForm
                newTaskTitle={newTaskTitle}
                setNewTaskTitle={setNewTaskTitle}
                newTaskDesc={newTaskDesc}
                setNewTaskDesc={setNewTaskDesc}
                handleAddTask={handleAddTask}
                taskDeadline={taskDeadline}
                setTaskDeadline={setTaskDeadline}
                taskTime={taskTime}
                setTaskTime={setTaskTime}
                taskAttachment={taskAttachment}
                setTaskAttachment={setTaskAttachment}
                taskPriority={taskPriority}
                setTaskPriority={setTaskPriority}
                isDatePickerOpen={isDatePickerOpen}
                setIsDatePickerOpen={setIsDatePickerOpen}
                activeProject={activeProject}
                projects={projects}
                setActiveProject={setActiveProject}
                isTaskProjectMenuOpen={isTaskProjectMenuOpen}
                setIsTaskProjectMenuOpen={setIsTaskProjectMenuOpen}
                setIsAddingTask={setIsAddingTask}
              />
            ) : (
              <button
                className="add-task-btn"
                onClick={() => setIsAddingTask(true)}
              >
                <span className="icon">
                  <Icon name="plus" size={18} />
                </span>{" "}
                Add task
              </button>
            )}
          </div>
        </div>
      </main>

      <AddProjectModal
        isAddProjectModalOpen={isAddProjectModalOpen}
        setIsAddProjectModalOpen={setIsAddProjectModalOpen}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        handleAddProject={handleAddProject}
      />

      <SettingsModal
        isSettingsModalOpen={isSettingsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        settingsTab={activeSettingsTab}
        setSettingsTab={setActiveSettingsTab}
        user={user}
        updateUser={updateUser}
        handleLogout={handleLogout}
        t={t}
        language={language}
        setLanguage={setLanguage}
      />

      <EditTaskModal
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
        handleUpdateTask={handleUpdateTask}
      />
    </div>
  );
}
