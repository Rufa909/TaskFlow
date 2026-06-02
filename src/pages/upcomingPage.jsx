import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { getTranslation } from "../i18n/translations";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import "./upcomingPage.css";

import AddTaskForm from "../components/task/AddTaskForm";
import TaskList from "../components/task/TaskList";
import Icon from "../components/common/Icon";
import Sidebar from "../components/sidebar/Sidebar";
import AddProjectModal from "../components/modals/AddProjectModal";
import SettingsModal from "../components/modals/SettingsModal";
import EditTaskModal from "../components/modals/EditTaskModal";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function tomorrow() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function isUpcomingTask(task) {
  if (!task.deadline) return false;
  const deadline = new Date(task.deadline);
  deadline.setHours(0, 0, 0, 0);
  return deadline > startOfToday();
}

function formatGroupDate(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function UpcomingPage() {
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const t = (key) => getTranslation(language, key);

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  const [taskAttachment, setTaskAttachment] = useState([]);

  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(tomorrow());
  const [taskTime, setTaskTime] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTaskProjectMenuOpen, setIsTaskProjectMenuOpen] = useState(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");

  useEffect(() => {
    const fetchUpcomingTasks = async () => {
      try {
        const projectRes = await api.get("/projects");
        const projs = projectRes.data.projects || [];
        setProjects(projs);
        if (projs.length > 0) setActiveProject(projs[0]);

        const taskResponses = await Promise.all(
          projs.map((project) =>
            api.get(`/projects/${project.project_id}/tasks`).then((res) =>
              (res.data.tasks || []).map((task) => ({
                ...task,
                project_name: project.name,
              })),
            ),
          ),
        );

        const upcomingTasks = taskResponses
          .flat()
          .filter(isUpcomingTask)
          .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        setTasks(upcomingTasks);
      } catch (err) {
        console.error("Cannot load upcoming tasks:", err);
      } finally {
        setLoadingProjects(false);
        setLoadingTasks(false);
      }
    };

    fetchUpcomingTasks();
  }, []);

  const groupedTasks = useMemo(() => {
    return tasks.reduce((groups, task) => {
      const key = new Date(task.deadline).toDateString();
      if (!groups[key]) {
        groups[key] = {
          label: formatGroupDate(task.deadline),
          tasks: [],
        };
      }
      groups[key].tasks.push(task);
      return groups;
    }, {});
  }, [tasks]);

  const handleLogout = async () => {
    if (await confirm(t("confirmLogout"), { confirmLabel: "Logout", danger: true })) {
      logout();
      navigate("/auth", { replace: true });
    }
  };

  const handleDeleteTask = async (taskId) => {
    const task = tasks.find((item) => item.task_id === taskId);
    if (!task) return;

    try {
      await api.delete(`/projects/${task.project_id}/tasks/${taskId}`);
      setTasks((prev) => prev.filter((item) => item.task_id !== taskId));
    } catch (err) {
      console.error(err);
      showToast("Cannot delete task", "error");
    }
  };

  const handleUpdateTask = async (taskId, updatedData) => {
    const task = tasks.find((item) => item.task_id === taskId);
    if (!task) return;

    try {
      const res = await api.put(
        `/projects/${task.project_id}/tasks/${taskId}`,
        updatedData,
      );
      const updatedTask = {
        ...res.data.task,
        project_name: task.project_name,
      };

      setTasks((prev) =>
        prev
          .map((item) => (item.task_id === taskId ? updatedTask : item))
          .filter(isUpcomingTask)
          .sort((a, b) => new Date(a.deadline) - new Date(b.deadline)),
      );
    } catch (err) {
      console.error(err);
      showToast("Cannot update task", "error");
    }
  };

  const handleCompleteTask = async (task) => {
    if (!task?.task_id || !task?.project_id) return;

    try {
      const res = await api.post(
        `/projects/${task.project_id}/tasks/${task.task_id}/complete`,
      );
      const updatedTask = { ...task, ...res.data.task };
      if (updatedTask.status === "COMPLETED" || updatedTask.completed_at) {
        setTasks((prev) => prev.filter((item) => item.task_id !== task.task_id));
        return;
      }

      setTasks((prev) =>
        prev.map((item) => (item.task_id === task.task_id ? updatedTask : item)),
      );
    } catch (err) {
      console.error(err);
      showToast("Cannot complete task", "error");
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !activeProject) return;

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
      if (taskAssignee) {
        formData.append("assigned_to", taskAssignee);
      }

      taskAttachment.forEach((file) => formData.append("attachments", file));

      const res = await api.post(
        `/projects/${activeProject.project_id}/tasks`,
        formData,
      );
      const newTask = {
        ...res.data.task,
        project_name: activeProject.name,
      };

      if (isUpcomingTask(newTask)) {
        setTasks((prev) =>
          [...prev, newTask].sort(
            (a, b) => new Date(a.deadline) - new Date(b.deadline),
          ),
        );
      }

      setNewTaskTitle("");
      setNewTaskDesc("");
      setTaskDeadline(tomorrow());
      setTaskTime("");
      setTaskPriority("medium");
      setTaskAssignee("");
      setTaskAttachment([]);
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Error adding task", "error");
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
      showToast(t("cannotCreateProject"), "error");
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    const confirmed = await confirm(t("deleteProjectConfirm"), {
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/projects/${projectId}`);
      const nextProjects = projects.filter((project) => project.project_id !== projectId);
      setProjects(nextProjects);
      setTasks((prev) => prev.filter((task) => task.project_id !== projectId));
      if (activeProject?.project_id === projectId) {
        setActiveProject(nextProjects[0] || null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || t("cannotDeleteProject"), "error");
    }
  };

  return (
    <div className="layout">
      <Sidebar
        user={user}
        projects={projects}
        activeProject={null}
        setActiveProject={() => {}}
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

      <main className="main-content upcoming-content">
        <header className="main-header">
          <div className="breadcrumb"></div>
          <div className="main-actions">
            <button className="action-btn">
              <Icon name="more" size={14} />
            </button>
          </div>
        </header>

        <div className="task-list-container">
          <div className="upcoming-header">
            <div>
              <h1 className="page-title upcoming-title">Upcoming</h1>
              <p className="upcoming-subtitle">
                Future tasks across all projects
              </p>
            </div>
            <div className="upcoming-task-count">
              <Icon name="upcoming" size={14} />
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="task-section">
            {loadingTasks ? (
              <div className="upcoming-empty">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="upcoming-empty">No upcoming tasks.</div>
            ) : (
              Object.entries(groupedTasks).map(([dateKey, group]) => (
                <section className="upcoming-day-group" key={dateKey}>
                  <h2 className="upcoming-day-title">{group.label}</h2>
                  <TaskList
                    tasks={group.tasks}
                    handleDeleteTask={handleDeleteTask}
                    handleUpdateTask={handleUpdateTask}
                    handleCompleteTask={handleCompleteTask}
                    setSelectedTask={setSelectedTask}
                  />
                </section>
              ))
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
                taskAssignee={taskAssignee}
                setTaskAssignee={setTaskAssignee}
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
                </span>
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
