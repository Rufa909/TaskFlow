import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import { getTranslation } from "../i18n/translations";
import "./homePage.css";

import AddTaskForm from "../components/task/AddTaskForm";
import TaskList from "../components/task/TaskList";
import Icon from "../components/common/Icon";
import { useFilters } from "../context/FiltersContext";
import Sidebar from "../components/sidebar/Sidebar";
import AddProjectModal from "../components/modals/AddProjectModal";
import EditProjectModal from "../components/modals/EditProjectModal";
import SettingsModal from "../components/modals/SettingsModal";
import EditTaskModal from "../components/modals/EditTaskModal";

export default function HomePage() {
  const { user, logout, updateUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [selectedTask, setSelectedTask] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const t = (key) => getTranslation(language, key);

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeView, setActiveView] = useState(
    new URLSearchParams(location.search).get("view") === "reporting"
      ? "reporting"
      : "project",
  );

  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editingProjectSaving, setEditingProjectSaving] = useState(false);
  const [tasksByProject, setTasksByProject] = useState({});
  const [taskAttachment, setTaskAttachment] = useState(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(null);
  const [taskTime, setTaskTime] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTaskProjectMenuOpen, setIsTaskProjectMenuOpen] = useState(false);
  const [reportingTasks, setReportingTasks] = useState([]);
  const [loadingReporting, setLoadingReporting] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem("taskflow.sidebarCollapsed") === "true",
  );

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
    const fetchTasks = async () => {
      if (!activeProject) return;
      try {
        const res = await api.get(
          `/projects/${activeProject.project_id}/tasks`,
        );
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

  const fetchReportingTasks = async () => {
    setLoadingReporting(true);
    try {
      const res = await api.get("/tasks/completed");
      setReportingTasks(res.data.tasks || []);
    } catch (err) {
      console.error("Cannot load reporting:", err);
    } finally {
      setLoadingReporting(false);
    }
  };

  useEffect(() => {
    if (activeView === "reporting") {
      fetchReportingTasks();
    }
  }, [activeView]);

  useEffect(() => {
    const view = new URLSearchParams(location.search).get("view");
    setActiveView(view === "reporting" ? "reporting" : "project");
  }, [location.search]);

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

      const updatedTask = {
        ...res.data.task,
        ...updatedData,
      };

      setTasksByProject((prev) => ({
        ...prev,
        [activeProject.project_id]: (prev[activeProject.project_id] || []).map(
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
      setTaskPriority("medium");
      setTaskAttachment(null);
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error adding task");
    }
  };
  const handleCompleteTask = async (task) => {
    if (!activeProject || !task?.task_id) return;

    try {
      const res = await api.post(
        `/projects/${activeProject.project_id}/tasks/${task.task_id}/complete`,
      );
      const completedTask = res.data.task || {
        ...task,
        completed_at: new Date().toISOString(),
        project_name: activeProject.name,
      };

      setTasksByProject((prev) => ({
        ...prev,
        [activeProject.project_id]: (
          prev[activeProject.project_id] || []
        ).filter((item) => item.task_id !== task.task_id),
      }));

      setReportingTasks((prev) => {
        const withoutDuplicate = prev.filter(
          (item) => item.task_id !== completedTask.task_id,
        );
        return [completedTask, ...withoutDuplicate];
      });
    } catch (err) {
      console.error(err);
      alert("Cannot complete task");
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
      setActiveView("project");
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

  const openEditProjectModal = (project) => {
    setProjectToEdit(project);
    setEditProjectName(project?.name || "");
    setIsEditProjectModalOpen(true);
  };

  const handleEditProjectSave = async () => {
    if (!projectToEdit || !editProjectName.trim()) return;
    setEditingProjectSaving(true);
    try {
      const res = await api.put(`/projects/${projectToEdit.project_id}`, {
        name: editProjectName.trim(),
      });
      const updated = res.data.project;
      setProjects((prev) =>
        prev.map((p) =>
          p.project_id === projectToEdit.project_id ? updated : p,
        ),
      );
      if (activeProject?.project_id === projectToEdit.project_id)
        setActiveProject(updated);
      setIsEditProjectModalOpen(false);
      setProjectToEdit(null);
    } catch (err) {
      console.error(err);
      alert(t("cannotEditProject"));
    } finally {
      setEditingProjectSaving(false);
    }
  };

  const currentTasks = activeProject
    ? tasksByProject[activeProject.project_id] || []
    : [];

  const { filters } = useFilters();

  const filteredTasks = currentTasks.filter((task) => {
    if (
      filters.priorities.length > 0 &&
      (!task.priority || !filters.priorities.includes(task.priority))
    )
      return false;
    // labels not implemented on tasks
    return true;
  });

  return (
    <div className="layout">
      <Sidebar
        user={user}
        projects={projects}
        activeProject={activeProject}
        setActiveProject={setActiveProject}
        activeView={activeView}
        setActiveView={setActiveView}
        setIsAddingTask={setIsAddingTask}
        loadingProjects={loadingProjects}
        handleDeleteProject={handleDeleteProject}
        onRequestEditProject={openEditProjectModal}
        t={t}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        handleLogout={handleLogout}
        isProjectMenuOpen={isProjectMenuOpen}
        setIsProjectMenuOpen={setIsProjectMenuOpen}
        setIsAddProjectModalOpen={setIsAddProjectModalOpen}
      />

      <EditProjectModal
        isOpen={isEditProjectModalOpen}
        setIsOpen={setIsEditProjectModalOpen}
        project={projectToEdit}
        name={editProjectName}
        setName={setEditProjectName}
        onSave={handleEditProjectSave}
        saving={editingProjectSaving}
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
          {activeView === "reporting" ? (
            <>
              <h1 className="page-title">{t("reporting")}</h1>
              <div className="reporting-summary">
                <span className="reporting-number">
                  {reportingTasks.length}
                </span>
                <span className="reporting-label">completed tasks</span>
              </div>

              <div className="reporting-list">
                {loadingReporting ? (
                  <div className="empty-state">Loading...</div>
                ) : reportingTasks.length === 0 ? (
                  <div className="empty-state">
                    Completed tasks will appear here.
                  </div>
                ) : (
                  reportingTasks.map((task) => (
                    <div key={task.task_id} className="reporting-item">
                      <span className="reporting-check">
                        <Icon name="check" size={13} />
                      </span>
                      <div className="reporting-content">
                        <div className="reporting-title">{task.title}</div>
                        <div className="reporting-meta">
                          {task.project_name || "Project"} - Completed{" "}
                          {new Date(task.completed_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <h1 className="page-title">
                {activeProject?.name || "Select a project"}
              </h1>

              {/* Task list */}
              <div className="task-section">
                <TaskList
                  tasks={filteredTasks}
                  handleDeleteTask={handleDeleteTask}
                  handleUpdateTask={handleUpdateTask}
                  handleCompleteTask={handleCompleteTask}
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
            </>
          )}
        </div>
      </main>

      <AddProjectModal
        isAddProjectModalOpen={isAddProjectModalOpen}
        setIsAddProjectModalOpen={setIsAddProjectModalOpen}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        handleAddProject={handleAddProject}
        savingProject={savingProject}
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
