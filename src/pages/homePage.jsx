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
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Sidebar from "../components/sidebar/Sidebar";
import AddProjectModal from "../components/modals/AddProjectModal";
import EditProjectModal from "../components/modals/EditProjectModal";
import SettingsModal from "../components/modals/SettingsModal";
import EditTaskModal from "../components/modals/EditTaskModal";

const LABELS_STORAGE_KEY = "taskflow.labels";
const DEFAULT_LABEL_COLOR = "#ef4444";
const LABEL_COLOR_OPTIONS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

function normalizeLabelItem(label) {
  if (typeof label === "string") {
    return { name: label.trim(), color: DEFAULT_LABEL_COLOR };
  }

  return {
    name: String(label?.name || "").trim(),
    color: label?.color || DEFAULT_LABEL_COLOR,
  };
}

function getInitialView(search) {
  const view = new URLSearchParams(search).get("view");
  if (
    view === "reporting" ||
    view === "filtersLabels" ||
    view === "filterResults" ||
    view === "labelResults"
  )
    return view;
  return "project";
}

function getSavedLabels() {
  try {
    return JSON.parse(localStorage.getItem(LABELS_STORAGE_KEY) || "[]")
      .map(normalizeLabelItem)
      .filter((label) => label.name);
  } catch {
    return [];
  }
}

function getDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(first, second) {
  return first.getTime() === second.getTime();
}

function isDeadlineMatch(deadline, activeDeadlines) {
  if (activeDeadlines.length === 0) return true;

  const taskDate = getDateOnly(deadline);
  
  if (!taskDate) {
    return activeDeadlines.includes("no_deadline");
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

  return activeDeadlines.some((item) => {
    if (item === "today") return isSameDay(taskDate, today);
    if (item === "tomorrow") return isSameDay(taskDate, tomorrow);
    if (item === "week") return taskDate >= today && taskDate <= endOfWeek;
    return false;
  });
}

function isTaskOverdue(task) {
  if (!task.deadline || task.status === "COMPLETED" || task.completed_at) return false;
  const deadline = new Date(task.deadline);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline < new Date();
}

export default function HomePage() {
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { language, setLanguage } = useLanguage();
  const [selectedTask, setSelectedTask] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const t = (key) => getTranslation(language, key);

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeView, setActiveView] = useState(() =>
    getInitialView(location.search),
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
  const [taskAttachment, setTaskAttachment] = useState([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState(null);
  const [taskTime, setTaskTime] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [newTaskLabels, setNewTaskLabels] = useState([]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTaskProjectMenuOpen, setIsTaskProjectMenuOpen] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [loadingAllTasks, setLoadingAllTasks] = useState(false);
  const [reportingTasks, setReportingTasks] = useState([]);
  const [loadingReporting, setLoadingReporting] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");
  const [savedLabels, setSavedLabels] = useState(getSavedLabels);
  const [newLabelName, setNewLabelName] = useState("");
  const [labelColor, setLabelColor] = useState(DEFAULT_LABEL_COLOR);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelModalMode, setLabelModalMode] = useState("add");
  const [editingLabel, setEditingLabel] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem("taskflow.sidebarCollapsed") === "true",
  );
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  const [isLabelsExpanded, setIsLabelsExpanded] = useState(true);

  // Task section UI state
  const [taskSectionDropdownOpen, setTaskSectionDropdownOpen] = useState(false);
  const [visibleSections, setVisibleSections] = useState({ overdue: false, completed: false });
  const TASKS_PER_PAGE = 5;
  const [activeTaskPage, setActiveTaskPage] = useState(1);
  const [overdueTaskPage, setOverdueTaskPage] = useState(1);
  const [completedTaskPage, setCompletedTaskPage] = useState(1);

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

  // Also fetch completed tasks when project changes
  useEffect(() => {
    if (activeProject) {
      fetchReportingTasks();
    }
  }, [activeProject?.project_id]);

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

  const fetchAllTasks = async () => {
    setLoadingAllTasks(true);
    try {
      const res = await api.get("/tasks");
      setAllTasks(res.data.tasks || []);
    } catch (err) {
      console.error("Cannot load all tasks:", err);
      showToast("Cannot load tasks", "error");
    } finally {
      setLoadingAllTasks(false);
    }
  };

  useEffect(() => {
    if (
      activeView === "filtersLabels" ||
      activeView === "filterResults" ||
      activeView === "labelResults"
    ) {
      fetchAllTasks();
    }
  }, [activeView]);

  useEffect(() => {
    setActiveView(getInitialView(location.search));
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailVerified = params.get("emailVerified");

    if (!emailVerified) return;

    if (emailVerified === "success") {
      api
        .get("/auth/me")
        .then((res) => updateUser(res.data.user))
        .catch((err) => console.error("Cannot refresh user:", err));
      showToast("Email verified successfully.", "success");
    } else {
      showToast("Email verification link is invalid or expired.", "error");
    }

    params.delete("emailVerified");
    const query = params.toString();
    navigate(query ? `/?${query}` : "/", { replace: true });
  }, [location.search, navigate, showToast, updateUser]);

  const handleLogout = async () => {
    if (await confirm(t("confirmLogout"), { confirmLabel: "Logout", danger: true })) {
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
      showToast("Cannot delete task", "error");
    }
  };
  const handleUpdateTask = async (taskId, updatedData) => {
    if (!activeProject) return;

    try {
      const projectId =
        updatedData instanceof FormData
          ? updatedData.get("project_id") || activeProject.project_id
          : updatedData.project_id || activeProject.project_id;
      const res = await api.put(
        `/projects/${projectId}/tasks/${taskId}`,
        updatedData,
      );

      const updatedTask = {
        ...res.data.task,
      };

      setTasksByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] || []).map(
          (task) => (task.task_id === taskId ? updatedTask : task),
        ),
      }));
    } catch (err) {
      console.error(err);
      showToast("Cannot update task", "error");
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
      formData.append("labels", JSON.stringify(newTaskLabels));
      if (taskAssignee) {
        formData.append("assigned_to", taskAssignee);
      }

      taskAttachment.forEach((file) => formData.append("attachments", file));

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
      setTaskAssignee("");
      setNewTaskLabels([]);
      setTaskAttachment([]);
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Error adding task", "error");
    }
  };
  const handleCompleteTask = async (task) => {
    if (!activeProject || !task?.task_id) return;

    try {
      const res = await api.post(
        `/projects/${activeProject.project_id}/tasks/${task.task_id}/complete`,
      );
      const updatedTask = {
        ...task,
        ...res.data.task,
        project_name: activeProject.name,
      };

      if (updatedTask.status === "COMPLETED" || updatedTask.completed_at) {
        setTasksByProject((prev) => ({
          ...prev,
          [activeProject.project_id]: (
            prev[activeProject.project_id] || []
          ).filter((item) => item.task_id !== task.task_id),
        }));

        setReportingTasks((prev) => {
          const withoutDuplicate = prev.filter(
            (item) => item.task_id !== updatedTask.task_id,
          );
          return [updatedTask, ...withoutDuplicate];
        });
        return;
      }

      setTasksByProject((prev) => ({
        ...prev,
        [activeProject.project_id]: (prev[activeProject.project_id] || []).map(
          (item) => (item.task_id === task.task_id ? updatedTask : item),
        ),
      }));
    } catch (err) {
      console.error(err);
      showToast("Cannot complete task", "error");
    }
  };

  const handleReviewTaskSubmission = async (task, action) => {
    if (!activeProject || !task?.task_id) return;

    try {
      const res = await api.post(
        `/projects/${activeProject.project_id}/tasks/${task.task_id}/review-submission`,
        { action },
      );
      const updatedTask = {
        ...task,
        ...res.data.task,
        project_name: activeProject.name,
      };

      if (updatedTask.status === "COMPLETED" || updatedTask.completed_at) {
        setTasksByProject((prev) => ({
          ...prev,
          [activeProject.project_id]: (
            prev[activeProject.project_id] || []
          ).filter((item) => item.task_id !== task.task_id),
        }));

        setReportingTasks((prev) => {
          const withoutDuplicate = prev.filter(
            (item) => item.task_id !== updatedTask.task_id,
          );
          return [updatedTask, ...withoutDuplicate];
        });
        return;
      }

      setTasksByProject((prev) => ({
        ...prev,
        [activeProject.project_id]: (prev[activeProject.project_id] || []).map(
          (item) => (item.task_id === task.task_id ? updatedTask : item),
        ),
      }));
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Cannot review task", "error");
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
      showToast(t("cannotCreateProject"), "error");
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation(); // prevent triggering project selection
    const confirmed = await confirm(t("deleteProjectConfirm"), {
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/projects/${projectId}`);
      const nextProjects = projects.filter((p) => p.project_id !== projectId);
      setProjects(nextProjects);
      setTasksByProject((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      if (activeProject?.project_id === projectId) {
        setActiveProject(nextProjects[0] || null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || t("cannotDeleteProject"), "error");
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
      showToast(t("cannotEditProject"), "error");
    } finally {
      setEditingProjectSaving(false);
    }
  };

  const currentTasks = activeProject
    ? tasksByProject[activeProject.project_id] || []
    : [];
  const currentProjectRole =
    activeProject?.user_role ||
    (Number(activeProject?.owner_id) === Number(user?.id) ? "owner" : "");

  const {
    filters,
    setFilters,
    setAvailableLabels,
    savedFilters,
    activeSavedFilterId,
    openFilterModal,
    applySavedFilter,
    deleteSavedFilter,
    renameLabelInSavedFilters,
    removeLabelFromSavedFilters,
  } = useFilters();

  const taskSourceForFilters = allTasks.length > 0 ? allTasks : currentTasks;
  const taskLabels = taskSourceForFilters.flatMap((task) =>
    Array.isArray(task.labels) ? task.labels : [],
  );
  const labelMap = new Map();
  savedLabels.forEach((label) => {
    labelMap.set(label.name.toLowerCase(), label);
  });
  [...filters.labels, ...taskLabels].forEach((label) => {
    const name = String(label).trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!labelMap.has(key)) {
      labelMap.set(key, { name, color: DEFAULT_LABEL_COLOR });
    }
  });
  const allLabels = Array.from(labelMap.values());
  const allLabelNames = allLabels.map((label) => label.name);
  const deadlineFilterLabels = {
    today: "Deadline Today",
    tomorrow: "Deadline Tomorrow",
    week: "Deadline This week",
    no_deadline: "No Deadline",
  };
  const myFilterItems = savedFilters;
  const selectedFilterId =
    activeSavedFilterId || new URLSearchParams(location.search).get("filterId");
  const activeSavedFilter =
    savedFilters.find((filter) => filter.id === selectedFilterId) || null;
  const allLabelsSignature = JSON.stringify(allLabels);

  useEffect(() => {
    setAvailableLabels(allLabels);
  }, [setAvailableLabels, allLabelsSignature]);

  const selectedLabelName = new URLSearchParams(location.search).get("label");
  const selectedLabel = selectedLabelName
    ? labelMap.get(selectedLabelName.toLowerCase()) || {
        name: selectedLabelName,
        color: DEFAULT_LABEL_COLOR,
      }
    : null;

  const filterTasksByCriteria = (criteria) => taskSourceForFilters.filter((task) => {
    if (
      criteria.priorities.length > 0 &&
      (!task.priority || !criteria.priorities.includes(task.priority))
    ) {
      return false;
    }

    if (
      criteria.labels.length > 0 &&
      (!Array.isArray(task.labels) ||
        !criteria.labels.some((label) => task.labels.includes(label)))
    ) {
      return false;
    }

    if (!isDeadlineMatch(task.deadline, criteria.deadlines)) {
      return false;
    }

    if (criteria.dateRange?.start && criteria.dateRange?.end) {
      if (!task.deadline) return false;
      const taskDate = getDateOnly(task.deadline);
      if (!taskDate) return false;
      
      const start = getDateOnly(criteria.dateRange.start);
      const end = getDateOnly(criteria.dateRange.end);
      
      if (taskDate < start || taskDate > end) {
        return false;
      }
    }

    return true;
  });

  const filteredTasks = filterTasksByCriteria(filters);
  const projectOpenTasks = filteredTasks.filter((t) => !isTaskOverdue(t));
  const projectOverdueTasks = filteredTasks.filter(isTaskOverdue);
  const projectCompletedTasks = reportingTasks.filter(
    (t) => Number(t.project_id) === Number(activeProject?.project_id),
  );
  const filterResultTasks = activeSavedFilter
    ? filterTasksByCriteria(activeSavedFilter.criteria)
    : [];
  const labelResultTasks = selectedLabel
    ? taskSourceForFilters.filter(
        (task) =>
          Array.isArray(task.labels) && task.labels.includes(selectedLabel.name),
      )
    : [];
  const getSavedFilterCount = (filter) =>
    filterTasksByCriteria(filter.criteria).length;

  const getLabelCount = (label) =>
    taskSourceForFilters.filter(
      (task) => Array.isArray(task.labels) && task.labels.includes(label),
    ).length;

  const persistSavedLabels = (labels) => {
    setSavedLabels(labels);
    localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(labels));
  };

  const isSavedLabel = (label) =>
    savedLabels.some((item) => item.name.toLowerCase() === label.toLowerCase());

  const getLabelColor = (label) =>
    labelMap.get(label.toLowerCase())?.color || DEFAULT_LABEL_COLOR;

  const closeLabelModal = () => {
    setIsLabelModalOpen(false);
    setLabelModalMode("add");
    setEditingLabel(null);
    setNewLabelName("");
    setLabelColor(DEFAULT_LABEL_COLOR);
  };

  const openAddLabelModal = () => {
    setLabelModalMode("add");
    setEditingLabel(null);
    setNewLabelName("");
    setLabelColor(DEFAULT_LABEL_COLOR);
    setIsLabelModalOpen(true);
  };

  const startEditingLabel = (label) => {
    setEditingLabel(label);
    setLabelModalMode("edit");
    setNewLabelName(label);
    setLabelColor(getLabelColor(label));
    setIsLabelModalOpen(true);
  };

  const handleAddLabel = (event) => {
    event.preventDefault();
    const label = newLabelName.trim();
    const editingKey = editingLabel?.toLowerCase();

    if (!label) {
      return;
    }

    if (
      label.toLowerCase() !== editingKey &&
      allLabelNames.some((item) => item.toLowerCase() === label.toLowerCase())
    ) {
      return;
    }

    const nextLabel = { name: label, color: labelColor };
    const nextLabels =
      labelModalMode === "edit"
        ? savedLabels.map((item) =>
            item.name.toLowerCase() === editingKey ? nextLabel : item,
          )
        : [...savedLabels, nextLabel];

    persistSavedLabels(nextLabels);
    if (labelModalMode === "edit") {
      setFilters((prev) => ({
        ...prev,
        labels: prev.labels.map((item) =>
          item.toLowerCase() === editingKey ? label : item,
        ),
      }));
      renameLabelInSavedFilters(editingLabel, label);
    }
    closeLabelModal();
  };

  const handleDeleteLabel = async (label) => {
    if (
      !(await confirm(`Delete label "${label}"?`, {
        confirmLabel: "Delete",
        danger: true,
      }))
    ) {
      return;
    }

    const nextLabels = savedLabels.filter(
      (item) => item.name.toLowerCase() !== label.toLowerCase(),
    );
    persistSavedLabels(nextLabels);
    setFilters((prev) => ({
      ...prev,
      labels: prev.labels.filter(
        (item) => item.toLowerCase() !== label.toLowerCase(),
      ),
    }));
    removeLabelFromSavedFilters(label);
    if (editingLabel?.toLowerCase() === label.toLowerCase()) {
      closeLabelModal();
    }
  };

  const handleDeleteFilter = async (filterId, filterName) => {
    if (
      !(await confirm(`Delete filter "${filterName}"?`, {
        confirmLabel: "Delete",
        danger: true,
      }))
    ) {
      return;
    }
    deleteSavedFilter(filterId);
  };

  const getSavedFilterSummary = (filter) => {
    const parts = [
      ...filter.criteria.deadlines.map((deadline) => deadlineFilterLabels[deadline] || deadline),
      ...filter.criteria.labels,
      ...filter.criteria.priorities.map(
        (priority) => `Priority ${priority.charAt(0).toUpperCase()}${priority.slice(1)}`,
      ),
    ];

    if (filter.criteria.dateRange?.start && filter.criteria.dateRange?.end) {
      parts.push(`Date Range: ${new Date(filter.criteria.dateRange.start).toLocaleDateString()} - ${new Date(filter.criteria.dateRange.end).toLocaleDateString()}`);
    }

    return parts.join(", ");
  };

  const getSavedFilterParts = (filter) => {
    const parts = [
    ...filter.criteria.deadlines.map((deadline) => ({
      key: `deadline-${deadline}`,
      label: deadlineFilterLabels[deadline] || deadline,
      color: "#14b8a6",
    })),
    ...filter.criteria.labels.map((label) => ({
      key: `label-${label}`,
      label,
      color: getLabelColor(label),
    })),
    ...filter.criteria.priorities.map((priority) => ({
      key: `priority-${priority}`,
      label: `Priority ${priority.charAt(0).toUpperCase()}${priority.slice(1)}`,
      color:
        priority === "urgent"
          ? "#dc2626"
          : priority === "high"
            ? "#f97316"
            : priority === "medium"
              ? "#d97706"
              : "#6b7280",
    })),
  ];

  if (filter.criteria.dateRange?.start && filter.criteria.dateRange?.end) {
    parts.push({
      key: `daterange`,
      label: `${new Date(filter.criteria.dateRange.start).toLocaleDateString()} - ${new Date(filter.criteria.dateRange.end).toLocaleDateString()}`,
      color: "#14b8a6",
    });
  }
  
  return parts;
};

  const openSavedFilterResults = (filter) => {
    applySavedFilter(filter);
    setActiveView("filterResults");
    navigate(`/?view=filterResults&filterId=${encodeURIComponent(filter.id)}`);
  };

  const returnToFiltersLabels = () => {
    setActiveView("filtersLabels");
    navigate("/?view=filtersLabels");
  };

  const openLabelResults = (label) => {
    setActiveView("labelResults");
    navigate(`/?view=labelResults&label=${encodeURIComponent(label)}`);
  };

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

      {isLabelModalOpen && (
        <div className="modal-overlay" onClick={closeLabelModal}>
          <form
            className="label-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleAddLabel}
          >
            <div className="label-modal-header">
              <h2>{labelModalMode === "edit" ? "Edit label" : "Add label"}</h2>
              <button
                className="label-modal-close"
                type="button"
                onClick={closeLabelModal}
                aria-label="Close label modal"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="label-modal-body">
              <label className="label-modal-field">
                <span>Name</span>
                <input
                  className="filters-labels-input"
                  value={newLabelName}
                  onChange={(event) => setNewLabelName(event.target.value)}
                  placeholder="Label name"
                  autoFocus
                />
              </label>

              <div className="label-modal-field">
                <span>Color</span>
                <div className="label-color-grid">
                  {LABEL_COLOR_OPTIONS.map((color) => (
                    <button
                      className={`label-color-option ${labelColor === color ? "active" : ""}`}
                      key={color}
                      type="button"
                      onClick={() => setLabelColor(color)}
                      style={{ backgroundColor: color }}
                      aria-label={`Choose color ${color}`}
                    >
                      {labelColor === color && <Icon name="check" size={16} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="label-modal-footer">
              <button
                className="label-modal-secondary"
                type="button"
                onClick={closeLabelModal}
              >
                Cancel
              </button>
              <button className="filters-labels-save" type="submit">
                {labelModalMode === "edit" ? "Save" : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

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
          ) : activeView === "labelResults" ? (
            <div className="filters-labels-page filter-results-page">
              <button
                className="filter-results-back"
                type="button"
                onClick={returnToFiltersLabels}
              >
                <Icon name="chevronDown" size={16} />
                Filters & Labels
              </button>

              {selectedLabel ? (
                <>
                  <div className="filter-results-header standalone">
                    <div className="filter-results-title-wrap">
                      <div>
                        <h1 className="page-title filter-results-page-title">
                          {selectedLabel.name}
                        </h1>
                        <div className="filter-results-meta">
                          {loadingAllTasks
                            ? "Loading tasks..."
                            : `${labelResultTasks.length} task${labelResultTasks.length !== 1 ? "s" : ""} matched`}
                        </div>
                      </div>
                    </div>
                    {isSavedLabel(selectedLabel.name) && (
                      <button
                        className="filters-labels-icon-btn"
                        type="button"
                        onClick={() => startEditingLabel(selectedLabel.name)}
                        title="Edit label"
                        aria-label={`Edit ${selectedLabel.name}`}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                    )}
                  </div>

                  <div className="filter-results-chips standalone">
                    <span
                      className="filter-results-chip"
                      style={{
                        borderColor: selectedLabel.color,
                        color: selectedLabel.color,
                      }}
                    >
                      Label
                    </span>
                  </div>

                  <div className="filter-results-list standalone">
                    {loadingAllTasks ? (
                      <div className="filters-labels-empty">Loading...</div>
                    ) : labelResultTasks.length > 0 ? (
                      <TaskList
                        tasks={labelResultTasks}
                        handleDeleteTask={handleDeleteTask}
                        handleUpdateTask={handleUpdateTask}
                        handleCompleteTask={handleCompleteTask}
                        handleReviewTaskSubmission={handleReviewTaskSubmission}
                        currentUserRole={currentProjectRole}
                        currentUserId={user?.id}
                        setSelectedTask={setSelectedTask}
                      />
                    ) : (
                      <div className="filters-labels-empty">
                        No tasks use this label.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="filters-labels-empty">
                  Select a label to view tasks.
                </div>
              )}
            </div>
          ) : activeView === "filterResults" ? (
            <div className="filters-labels-page filter-results-page">
              <button
                className="filter-results-back"
                type="button"
                onClick={returnToFiltersLabels}
              >
                <Icon name="chevronDown" size={16} />
                Filters & Labels
              </button>

              {activeSavedFilter ? (
                <>
                  <div className="filter-results-header standalone">
                    <div className="filter-results-title-wrap">
                      <div>
                        <h1 className="page-title filter-results-page-title">
                          {activeSavedFilter.name}
                        </h1>
                        <div className="filter-results-meta">
                          {filterResultTasks.length} task{filterResultTasks.length !== 1 ? "s" : ""} matched
                        </div>
                      </div>
                    </div>
                    <button
                      className="filters-labels-icon-btn"
                      type="button"
                      onClick={() => openFilterModal(activeSavedFilter)}
                      title="Edit filter"
                      aria-label={`Edit ${activeSavedFilter.name}`}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                  </div>

                  <div className="filter-results-chips standalone">
                    {getSavedFilterParts(activeSavedFilter).map((part) => (
                      <span
                        className="filter-results-chip"
                        key={part.key}
                        style={{ borderColor: part.color, color: part.color }}
                      >
                        {part.label}
                      </span>
                    ))}
                  </div>

                  <div className="filter-results-list standalone">
                    {filterResultTasks.length > 0 ? (
                      <TaskList
                        tasks={filterResultTasks}
                        handleDeleteTask={handleDeleteTask}
                        handleUpdateTask={handleUpdateTask}
                        handleCompleteTask={handleCompleteTask}
                        handleReviewTaskSubmission={handleReviewTaskSubmission}
                        currentUserRole={currentProjectRole}
                        currentUserId={user?.id}
                        setSelectedTask={setSelectedTask}
                      />
                    ) : (
                      <div className="filters-labels-empty">
                        No tasks match this filter.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="filters-labels-empty">
                  Select a filter from My Filters to view results.
                </div>
              )}
            </div>
          ) : activeView === "filtersLabels" ? (
            <div className="filters-labels-page">
              <h1 className="page-title">Filters & Labels</h1>

              <section className="filters-labels-group">
                <div className="filters-labels-page-header">
                  <div className="filters-labels-heading">
                    <span 
                      className="filters-labels-toggle"
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsFiltersExpanded(!isFiltersExpanded);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <Icon name={isFiltersExpanded ? "chevronDown" : "chevronRight"} size={16} />
                    </span>
                    <span className="filters-labels-heading-text">My Filters</span>
                  </div>
                  <button
                    className="filters-labels-icon-btn filters-labels-filter-add"
                    type="button"
                    onClick={() => openFilterModal()}
                    title="Add filter"
                    aria-label="Add filter"
                  >
                    <Icon name="plus" size={18} />
                  </button>
                </div>

                {isFiltersExpanded && myFilterItems.length > 0 ? (
                  myFilterItems.map((item) => (
                    <div
                      className={`filters-labels-list-row ${selectedFilterId === item.id ? "active" : ""}`}
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openSavedFilterResults(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openSavedFilterResults(item);
                        }
                      }}
                      title={getSavedFilterSummary(item)}
                    >
                      <span
                        className="filters-labels-drop"
                        style={{ borderColor: item.color }}
                      />
                      <span className="filters-labels-item-name">{item.name}</span>
                      <span className="filters-labels-item-count">{getSavedFilterCount(item)}</span>
                      <span className="filters-labels-row-actions">
                        <button
                          className="filters-labels-row-action"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openFilterModal(item);
                          }}
                          title="Edit filter"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          className="filters-labels-row-action danger"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteFilter(item.id, item.name);
                          }}
                          title="Delete filter"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </span>
                    </div>
                  ))
                ) : isFiltersExpanded ? (
                  <div className="filters-labels-empty">No filters yet.</div>
                ) : null}
              </section>

              <section className="filters-labels-group labels-group">
                <div className="filters-labels-page-header">
                  <div className="filters-labels-heading">
                    <span 
                      className="filters-labels-toggle"
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsLabelsExpanded(!isLabelsExpanded)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsLabelsExpanded(!isLabelsExpanded);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <Icon name={isLabelsExpanded ? "chevronDown" : "chevronRight"} size={16} />
                    </span>
                    <span className="filters-labels-heading-text">Labels</span>
                  </div>
                  <button
                    className="filters-labels-icon-btn"
                    type="button"
                    onClick={openAddLabelModal}
                    title="Add label"
                    aria-label="Add label"
                  >
                    <Icon name="plus" size={18} />
                  </button>
                </div>

                {isLabelsExpanded && allLabels.length > 0 ? (
                  allLabels.map((labelItem) => {
                    const label = labelItem.name;

                    return (
                      <div
                        className="filters-labels-list-row"
                        key={label}
                        role="button"
                        tabIndex={0}
                        onClick={() => openLabelResults(label)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openLabelResults(label);
                          }
                        }}
                      >
                        <span
                          className="filters-labels-tag"
                          style={{ color: labelItem.color }}
                        >
                          <Icon name="tag" size={18} />
                        </span>
                        <span className="filters-labels-item-name">{label}</span>
                        <span className="filters-labels-item-count">{getLabelCount(label)}</span>
                        {isSavedLabel(label) && (
                          <span className="filters-labels-row-actions">
                            <button
                              className="filters-labels-row-action"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                startEditingLabel(label);
                              }}
                              title="Edit label"
                              aria-label={`Edit ${label}`}
                            >
                              <Icon name="edit" size={14} />
                            </button>
                            <button
                              className="filters-labels-row-action danger"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteLabel(label);
                              }}
                              title="Delete label"
                              aria-label={`Delete ${label}`}
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : isLabelsExpanded ? (
                  <div className="filters-labels-empty">No labels yet.</div>
                ) : null}
              </section>
            </div>
          ) : (
            <>
              <h1 className="page-title">
                {activeProject?.name || "Select a project"}
              </h1>

              <div className="task-section">

                {/* Add Task - on top */}
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
                    taskLabels={newTaskLabels}
                    setTaskLabels={setNewTaskLabels}
                    availableLabels={allLabels}
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
                    className="add-task-btn add-task-btn--top"
                    onClick={() => setIsAddingTask(true)}
                  >
                    <span className="icon"><Icon name="plus" size={18} /></span>
                    Add task
                  </button>
                )}

                {/* Active tasks with dropdown */}
                <div className="project-task-group">
                  <div
                    className="project-task-group-header clickable"
                    onClick={() => setTaskSectionDropdownOpen(v => !v)}
                  >
                    <span className="task-group-header-title">
                      <span style={{
                        display: 'inline-flex',
                        transform: taskSectionDropdownOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.2s'
                      }}>
                        <Icon name="chevronDown" size={14} />
                      </span>
                      Active tasks
                    </span>
                    <span className="task-count-badge">{projectOpenTasks.length}</span>
                  </div>

                  {taskSectionDropdownOpen && (
                    <div className="task-section-dropdown">
                      <button
                        className={`task-section-dropdown-item ${visibleSections.overdue ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisibleSections(v => ({ ...v, overdue: !v.overdue }));
                          setOverdueTaskPage(1);
                          setTaskSectionDropdownOpen(false);
                        }}
                      >
                        <span className="task-section-dot overdue-dot" />
                        Overdue tasks
                        <span className="task-section-count">{projectOverdueTasks.length}</span>
                        {visibleSections.overdue && <Icon name="check" size={14} />}
                      </button>
                      <button
                        className={`task-section-dropdown-item ${visibleSections.completed ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisibleSections(v => ({ ...v, completed: !v.completed }));
                          setCompletedTaskPage(1);
                          setTaskSectionDropdownOpen(false);
                        }}
                      >
                        <span className="task-section-dot completed-dot" />
                        Completed tasks
                        <span className="task-section-count">{projectCompletedTasks.length}</span>
                        {visibleSections.completed && <Icon name="check" size={14} />}
                      </button>
                    </div>
                  )}

                  {projectOpenTasks.length === 0 ? (
                    <div className="project-task-empty">No active tasks.</div>
                  ) : (
                    <>
                      <TaskList
                        tasks={projectOpenTasks.slice((activeTaskPage-1)*TASKS_PER_PAGE, activeTaskPage*TASKS_PER_PAGE)}
                        handleDeleteTask={handleDeleteTask}
                        handleUpdateTask={handleUpdateTask}
                        handleCompleteTask={handleCompleteTask}
                        handleReviewTaskSubmission={handleReviewTaskSubmission}
                        currentUserRole={currentProjectRole}
                        currentUserId={user?.id}
                        setSelectedTask={setSelectedTask}
                      />
                      {Math.ceil(projectOpenTasks.length / TASKS_PER_PAGE) > 1 && (
                        <div className="task-pagination">
                          {Array.from({ length: Math.ceil(projectOpenTasks.length / TASKS_PER_PAGE) }, (_, i) => i+1).map(p => (
                            <button key={p} className={`task-page-btn ${activeTaskPage===p?'active':''}`} onClick={() => setActiveTaskPage(p)}>{p}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Overdue tasks */}
                {visibleSections.overdue && (
                  <div className="project-task-group overdue">
                    <div className="project-task-group-header">
                      <span className="task-group-header-title overdue-title">
                        <span className="task-section-dot overdue-dot" />
                        Overdue tasks
                      </span>
                      <span className="task-count-badge overdue-badge">{projectOverdueTasks.length}</span>
                    </div>
                    {projectOverdueTasks.length === 0 ? (
                      <div className="project-task-empty">No overdue tasks.</div>
                    ) : (
                      <>
                        <TaskList
                          tasks={projectOverdueTasks.slice((overdueTaskPage-1)*TASKS_PER_PAGE, overdueTaskPage*TASKS_PER_PAGE)}
                          handleDeleteTask={handleDeleteTask}
                          handleUpdateTask={handleUpdateTask}
                          handleCompleteTask={handleCompleteTask}
                          handleReviewTaskSubmission={handleReviewTaskSubmission}
                          currentUserRole={currentProjectRole}
                          currentUserId={user?.id}
                          setSelectedTask={setSelectedTask}
                        />
                        {Math.ceil(projectOverdueTasks.length / TASKS_PER_PAGE) > 1 && (
                          <div className="task-pagination">
                            {Array.from({ length: Math.ceil(projectOverdueTasks.length / TASKS_PER_PAGE) }, (_, i) => i+1).map(p => (
                              <button key={p} className={`task-page-btn ${overdueTaskPage===p?'active':''}`} onClick={() => setOverdueTaskPage(p)}>{p}</button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Completed tasks */}
                {visibleSections.completed && (
                  <div className="project-task-group completed">
                    <div className="project-task-group-header">
                      <span className="task-group-header-title">
                        <span className="task-section-dot completed-dot" />
                        Completed tasks
                      </span>
                      <span className="task-count-badge completed-badge">{projectCompletedTasks.length}</span>
                    </div>
                    {projectCompletedTasks.length === 0 ? (
                      <div className="project-task-empty">No completed tasks.</div>
                    ) : (
                      <>
                        <TaskList
                          tasks={projectCompletedTasks.slice((completedTaskPage-1)*TASKS_PER_PAGE, completedTaskPage*TASKS_PER_PAGE)}
                          handleDeleteTask={handleDeleteTask}
                          handleUpdateTask={handleUpdateTask}
                          handleCompleteTask={handleCompleteTask}
                          handleReviewTaskSubmission={handleReviewTaskSubmission}
                          currentUserRole={currentProjectRole}
                          currentUserId={user?.id}
                          setSelectedTask={setSelectedTask}
                        />
                        {Math.ceil(projectCompletedTasks.length / TASKS_PER_PAGE) > 1 && (
                          <div className="task-pagination">
                            {Array.from({ length: Math.ceil(projectCompletedTasks.length / TASKS_PER_PAGE) }, (_, i) => i+1).map(p => (
                              <button key={p} className={`task-page-btn ${completedTaskPage===p?'active':''}`} onClick={() => setCompletedTaskPage(p)}>{p}</button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
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
        handleCompleteTask={handleCompleteTask}
        availableLabels={allLabels}
      />
    </div>
  );
}
