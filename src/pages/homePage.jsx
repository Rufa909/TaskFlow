import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import { getTranslation } from "../i18n/translations";
import "./homePage.css";

import AddTaskForm from "../components/task/AddTaskForm";
import TaskList from "../components/task/TaskList";
import Icon from "../components/common/Icon";
import Sidebar from "../components/sidebar/Sidebar";
import AddProjectModal from "../components/modals/AddProjectModal";
import SettingsModal from "../components/modals/SettingsModal";
import EditTaskModal from "../components/modals/EditTaskModal";

export default function HomePage() {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [selectedTask, setSelectedTask] = useState(null);
  const navigate = useNavigate();

  // Translation helper
  const t = (key) => getTranslation(language, key);

  // Projects state — loaded from DB
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Project UI state
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  // Task UI state (in-memory per session, per project)
  const [tasksByProject, setTasksByProject] = useState({});
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(null);
  const [taskTime, setTaskTime] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTaskProjectMenuOpen, setIsTaskProjectMenuOpen] = useState(false);

  // Profile dropdown state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");

  // Load projects from DB on mount
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

  // Fetch tasks when activeProject changes
  useEffect(() => {
    const fetchTasks = async () => {
      if (!activeProject) return;
      try {
        const res = await api.get(
          `/projects/${activeProject.project_id}/tasks`,
        );
        // The API returns `tasks` array. Ensure the task fields match what React expects:
        // Instead of `task.desc`, we should use `task.description` but let's map it for now
        // or just update JSX later. I'll map it to keep JSX the same for now, or just use description.
        setTasksByProject((prev) => ({
          ...prev,
          [activeProject.project_id]: res.data.tasks || [],
        }));
      } catch (err) {
        console.error("Cannot load tasks:", err);
      }
    };
    fetchTasks();
  }, [activeProject]);

  const handleLogout = () => {
    if (window.confirm(t("confirmLogout"))) {
      logout();
      navigate("/auth", { replace: true });
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!activeProject) return;

    try {
      await api.delete(`/projects/${activeProject.project_id}/tasks/${taskId}`);

      setTasksByProject((prev) => ({
        ...prev,
        [activeProject.project_id]: prev[activeProject.project_id].filter(
          (task) => task.task_id !== taskId,
        ),
      }));
    } catch (err) {
      console.error(err);
      alert("Cannot delete task");
    }
  };
  const handleUpdateTask = async (taskId, updatedData) => {
    if (!activeProject) return;

    try {
      const res = await api.put(
        `/projects/${activeProject.project_id}/tasks/${taskId}`,
        updatedData,
      );

      const updatedTask = res.data.task;

      setTasksByProject((prev) => ({
        ...prev,
        [activeProject.project_id]: prev[activeProject.project_id].map(
          (task) => (task.task_id === taskId ? updatedTask : task),
        ),
      }));
    } catch (err) {
      console.error(err);
      alert("Cannot update task");
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !activeProject) return;
    const projId = activeProject.project_id;

    try {
      const res = await api.post(`/projects/${projId}/tasks`, {
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        deadline: taskDeadline,
        time: taskTime,
      });
      const newTask = res.data.task;

      const existing = tasksByProject[projId] || [];
      setTasksByProject({
        ...tasksByProject,
        [projId]: [...existing, newTask],
      });

      setNewTaskTitle("");
      setNewTaskDesc("");
      setTaskDeadline(null);
      setTaskTime("");
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      alert("Error adding task");
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
    e.stopPropagation(); // prevent triggering project selection
    if (!window.confirm(t("deleteProjectConfirm"))) return;
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.project_id !== projectId));
      if (activeProject?.project_id === projectId) {
        setActiveProject(null);
      }
    } catch (err) {
      alert(t("cannotDeleteProject"));
    }
  };

  const currentTasks = activeProject
    ? tasksByProject[activeProject.project_id] || []
    : [];

  return (
    <div className="layout">
      <Sidebar
        user={user}
        projects={projects}
        activeProject={activeProject}
        setActiveProject={setActiveProject}
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
      <main className="main-content">
        <header className="main-header">
          <div className="breadcrumb">My Projects / </div>
          <div className="main-actions">
            <button className="action-btn">
              <Icon name="more" size={14} />
            </button>
          </div>
        </header>

        <div className="task-list-container">
          <h1 className="page-title">
            {activeProject?.name || "Select a project"}
          </h1>

          {/* Task list */}
          <div className="task-section">
            <TaskList
              tasks={currentTasks}
              handleDeleteTask={handleDeleteTask}
              handleUpdateTask={handleUpdateTask}
              setSelectedTask={setSelectedTask}
            />

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
