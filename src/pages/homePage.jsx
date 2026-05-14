import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, addDays, nextMonday } from 'date-fns';
import './homePage.css';

// SVG Monochrome Icons
const Icon = ({ name, size = 20, color = 'currentColor' }) => {
  const icons = {
    bell: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
    sidebar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    inbox: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
    upcoming: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
    grid: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
    activity: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
    hash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>,
    help: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
    more: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>,
    chevronDown: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
    flag: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>,
    clock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    teamAdd: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="23" y1="11" x2="17" y2="11"></line><line x1="20" y1="8" x2="20" y2="14"></line></svg>,
    share: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>,
    mail: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
    paperclip: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
  };
  return icons[name] || null;
};

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Projects state — loaded from DB
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Project UI state
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // Task UI state (in-memory per session, per project)
  const [tasksByProject, setTasksByProject] = useState({});
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [taskDeadline, setTaskDeadline] = useState(null);
  const [taskTime, setTaskTime] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTaskProjectMenuOpen, setIsTaskProjectMenuOpen] = useState(false);

  // Load projects from DB on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects');
        const projs = res.data.projects || [];
        setProjects(projs);
        if (projs.length > 0) setActiveProject(projs[0]);
      } catch (err) {
        console.error('Cannot load projects:', err);
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
        const res = await api.get(`/projects/${activeProject.project_id}/tasks`);
        // The API returns `tasks` array. Ensure the task fields match what React expects:
        // Instead of `task.desc`, we should use `task.description` but let's map it for now
        // or just update JSX later. I'll map it to keep JSX the same for now, or just use description.
        setTasksByProject(prev => ({
          ...prev,
          [activeProject.project_id]: res.data.tasks || []
        }));
      } catch (err) {
        console.error('Cannot load tasks:', err);
      }
    };
    fetchTasks();
  }, [activeProject]);

  const handleLogout = () => {
    if (window.confirm('Do you want to logout?')) {
      logout();
      navigate('/auth', { replace: true });
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
        time: taskTime
      });
      const newTask = res.data.task;

      const existing = tasksByProject[projId] || [];
      setTasksByProject({
        ...tasksByProject,
        [projId]: [...existing, newTask]
      });

      setNewTaskTitle('');
      setNewTaskDesc('');
      setTaskDeadline(null);
      setTaskTime('');
      setIsAddingTask(false);
    } catch(err) {
      console.error(err);
      alert("Error adding task");
    }
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    setSavingProject(true);
    try {
      const res = await api.post('/projects', { name: newProjectName.trim() });
      const created = res.data.project;
      setProjects(prev => [...prev, created]);
      setActiveProject(created);
      setNewProjectName('');
      setIsAddProjectModalOpen(false);
      setIsProjectMenuOpen(false);
    } catch (err) {
      alert('Không thể tạo project. Vui lòng thử lại!');
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation(); // prevent triggering project selection
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects(prev => prev.filter(p => p.project_id !== projectId));
      if (activeProject?.project_id === projectId) {
        setActiveProject(null);
      }
    } catch (err) {
      alert('Không thể xóa project. Vui lòng thử lại!');
    }
  };

  const currentTasks = activeProject ? (tasksByProject[activeProject.project_id] || []) : [];

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="user-profile" onClick={handleLogout} title="Click to logout">
            <div className="avatar">{user?.username ? user.username.charAt(0).toUpperCase() : 'U'}</div>
            <span className="username">{user?.username || 'User'}</span>
            <span className="chevron"><Icon name="chevronDown" size={14} /></span>
          </div>
          <div className="sidebar-actions">
            <button className="icon-btn" title="Notifications"><Icon name="bell" size={18} /></button>
            <button className="icon-btn" title="Toggle Sidebar"><Icon name="sidebar" size={18} /></button>
          </div>
        </div>

        <div className="sidebar-nav">
          <button className="nav-item add-task" onClick={() => { setIsAddingTask(true); }}>
            <span className="icon"><Icon name="plus" size={18} /></span> Add task
          </button>
          <button className="nav-item">
            <span className="icon"><Icon name="search" size={18} /></span> Search
          </button>
          <button className="nav-item">
            <span className="icon"><Icon name="inbox" size={18} /></span> Inbox
          </button>
          <button className="nav-item">
            <span className="icon"><Icon name="calendar" size={18} /></span> Today
            <span className="count">2</span>
          </button>
          <button className="nav-item">
            <span className="icon"><Icon name="upcoming" size={18} /></span> Upcoming
          </button>
          <button className="nav-item">
            <span className="icon"><Icon name="grid" size={18} /></span> Filters & Labels
          </button>
          <button className="nav-item">
            <span className="icon"><Icon name="activity" size={18} /></span> Reporting
          </button>
        </div>

        <div className="sidebar-projects">
          <div className="projects-header">
            <span>My Projects</span>
            <div className="projects-header-actions">
              <button
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                title="Add project"
              >
                <Icon name="plus" size={16} />
              </button>
              <button title="Collapse"><Icon name="chevronDown" size={16} /></button>

              {isProjectMenuOpen && (
                <div className="project-dropdown-menu">
                  <div className="project-dropdown-item" onClick={() => {
                    setIsProjectMenuOpen(false);
                    setIsAddProjectModalOpen(true);
                  }}>
                    <Icon name="hash" size={14} /> Add project
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="project-list">
            {loadingProjects ? (
              <div style={{ padding: '8px', fontSize: '13px', color: '#aaa' }}>Loading...</div>
            ) : (
              projects.map(proj => (
                <button
                  key={proj.project_id}
                  className={`project-item ${activeProject?.project_id === proj.project_id ? 'active' : ''}`}
                  onClick={() => { setActiveProject(proj); setIsAddingTask(false); }}
                >
                  <span className="icon"><Icon name="hash" size={16} /></span>
                  <span className="project-name" style={{ flex: 1, textAlign: 'left' }}>{proj.name}</span>
                  <div 
                    className="delete-project-btn" 
                    onClick={(e) => handleDeleteProject(e, proj.project_id)}
                    title="Delete project"
                  >
                    <Icon name="trash" size={14} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="nav-item">
            <span className="icon"><Icon name="teamAdd" size={18} /></span> Add a team
          </button>
          <button className="nav-item">
            <span className="icon"><Icon name="help" size={18} /></span> Help & resources
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="breadcrumb">My Projects / </div>
          <div className="main-actions">
            <button className="action-btn"><Icon name="more" size={14} /></button>
          </div>
        </header>

        <div className="task-list-container">
          <h1 className="page-title">{activeProject?.name || 'Select a project'}</h1>

          {/* Task list */}
          <div className="task-section">
            {currentTasks.map(task => (
              <div key={task.task_id || task.id} className="task-item">
                <div className="checkbox"></div>
                <div className="task-content">
                  <div className="task-title">{task.title}</div>
                  {task.description && <div className="task-meta">{task.description}</div>}
                  {task.deadline && (
                    <div className="task-meta" style={{ color: '#058527', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="calendar" size={12} />
                      {new Date(task.deadline).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isAddingTask ? (
              <div className="add-task-form">
                <input
                  className="input-title"
                  placeholder="Task name"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                />
                <input
                  className="input-desc"
                  placeholder="Description"
                  value={newTaskDesc}
                  onChange={e => setNewTaskDesc(e.target.value)}
                />
                <div className="form-actions-row" style={{ position: 'relative' }}>
                  <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className={taskDeadline ? 'has-date' : ''}>
                    <Icon name="calendar" size={14} color={taskDeadline ? '#058527' : 'currentColor'} /> 
                    <span style={{ color: taskDeadline ? '#058527' : 'inherit' }}>
                      {taskDeadline ? format(taskDeadline, 'd MMM') : 'Date'}
                    </span>
                    {taskDeadline && (
                      <span 
                        onClick={(e) => { e.stopPropagation(); setTaskDeadline(null); setTaskTime(''); }} 
                        className="clear-date-btn"
                      >
                        ×
                      </span>
                    )}
                  </button>
                  <button><Icon name="paperclip" size={14} /> Attachment</button>
                  <button><Icon name="flag" size={14} /> Priority</button>
                  <button><Icon name="clock" size={14} /> Reminders</button>
                  <button><Icon name="more" size={14} /></button>

                  {/* Date Picker Popover */}
                  {isDatePickerOpen && (
                    <div className="date-picker-popover">
                      <div className="date-picker-header">
                        <input 
                          value={taskDeadline ? format(taskDeadline, 'd MMM') : ''} 
                          placeholder="Type a due date" 
                          readOnly 
                        />
                      </div>
                      <div className="quick-options">
                        <button onClick={() => { setTaskDeadline(new Date()); setIsDatePickerOpen(false); }}>
                          <span className="left"><Icon name="calendar" size={16} color="#db4035" /> Today</span>
                          <span className="day">{format(new Date(), 'E')}</span>
                        </button>
                        <button onClick={() => { setTaskDeadline(addDays(new Date(), 1)); setIsDatePickerOpen(false); }}>
                          <span className="left"><Icon name="calendar" size={16} color="#ff9933" /> Tomorrow</span>
                          <span className="day">{format(addDays(new Date(), 1), 'E')}</span>
                        </button>
                        <button onClick={() => { 
                          let target = new Date();
                          const diff = 6 - target.getDay(); // Next Saturday
                          setTaskDeadline(addDays(target, diff >= 0 ? diff : diff + 7)); 
                          setIsDatePickerOpen(false); 
                        }}>
                          <span className="left"><Icon name="grid" size={16} color="#246fe0" /> This weekend</span>
                          <span className="day">Sat</span>
                        </button>
                        <button onClick={() => { setTaskDeadline(nextMonday(new Date())); setIsDatePickerOpen(false); }}>
                          <span className="left"><Icon name="share" size={16} color="#af38eb" /> Next week</span>
                          <span className="day">{format(nextMonday(new Date()), 'E d MMM')}</span>
                        </button>
                        <button onClick={() => { setTaskDeadline(null); setTaskTime(''); setIsDatePickerOpen(false); }}>
                          <span className="left"><Icon name="help" size={16} color="#808080" /> No Date</span>
                        </button>
                      </div>
                      <div className="calendar-section">
                        <DatePicker
                          selected={taskDeadline}
                          onChange={(date) => setTaskDeadline(date)}
                          inline
                        />
                      </div>
                      <div className="time-section">
                        <div className="time-input">
                          <span className="label">Time</span>
                          <input type="time" value={taskTime} onChange={e => setTaskTime(e.target.value)} />
                        </div>
                      </div>
                      <div className="date-picker-footer">
                        <button className="cancel-btn" onClick={() => setIsDatePickerOpen(false)}>Cancel</button>
                        <button className="submit-btn" onClick={() => setIsDatePickerOpen(false)}>Save</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="form-footer">
                  <div className="project-selector" style={{ position: 'relative' }}>
                    <button onClick={() => setIsTaskProjectMenuOpen(!isTaskProjectMenuOpen)}>
                      <Icon name="hash" size={14} /> 
                      {activeProject?.name || 'Project'} 
                      <Icon name="chevronDown" size={14} />
                    </button>
                    {isTaskProjectMenuOpen && (
                      <div className="project-dropdown-menu" style={{ bottom: '100%', top: 'auto', marginBottom: '4px', left: 0 }}>
                        {projects.map(proj => (
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
                    <button className="cancel-btn" onClick={() => { setIsAddingTask(false); setNewTaskTitle(''); setNewTaskDesc(''); }}>Cancel</button>
                    <button
                      className="submit-btn"
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                    >Add task</button>
                  </div>
                </div>
              </div>
            ) : (
              <button className="add-task-btn" onClick={() => setIsAddingTask(true)}>
                <span className="icon"><Icon name="plus" size={18} /></span> Add task
              </button>
            )}
          </div>

        </div>
      </main>

      {/* Add Project Modal */}
      {isAddProjectModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddProjectModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add project</h2>
              <button className="icon-btn" onClick={() => setIsAddProjectModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label>Name</label>
              <input
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="e.g. Work, Personal"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddProject()}
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setIsAddProjectModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
              >Cancel</button>
              <button
                onClick={handleAddProject}
                disabled={!newProjectName.trim() || savingProject}
                className="submit-btn"
              >{savingProject ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}