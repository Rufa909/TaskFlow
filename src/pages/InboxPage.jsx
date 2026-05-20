import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';
import TaskList from '../components/task/TaskList';
import Icon from '../components/common/Icon';
import { useFilters } from '../context/FiltersContext';
import { useTeams } from '../context/TeamsContext';
import './InboxPage.css';

const API_URL = 'http://localhost:5000';

function avatarUrl(photo) {
  if (!photo) return '';
  return photo.startsWith('http') || photo.startsWith('data:')
    ? photo
    : `${API_URL}${photo}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function InboxPage({ t }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invitation states
  const [invitations, setInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [fadingIds, setFadingIds] = useState(new Set());

  const { refreshInvitationCount } = useTeams();

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await api.get('/tasks');
        setTasks(res.data.tasks || []);
      } catch (err) {
        console.error('Cannot load inbox tasks', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // Fetch invitations
  useEffect(() => {
    const fetchInvitations = async () => {
      setLoadingInvitations(true);
      try {
        const res = await api.get('/teams/invitations');
        setInvitations(res.data.invitations || []);
      } catch (err) {
        console.error('Cannot load invitations', err);
      } finally {
        setLoadingInvitations(false);
      }
    };
    fetchInvitations();
  }, []);

  const handleDeleteTask = async (taskId) => {
    const task = tasks.find((t) => t.task_id === taskId);
    if (!task) return;
    try {
      await api.delete(`/projects/${task.project_id}/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch (err) {
      console.error(err);
      alert('Cannot delete task');
    }
  };

  // Respond to invitation (accept / decline)
  const handleRespond = async (invitationId, action) => {
    setRespondingId(invitationId);

    try {
      await api.put(`/teams/invitations/${invitationId}`, { action });

      // Trigger fade-out animation
      setFadingIds((prev) => new Set(prev).add(invitationId));

      // Remove from list after animation
      setTimeout(() => {
        setInvitations((prev) => prev.filter((inv) => inv.invitation_id !== invitationId));
        setFadingIds((prev) => {
          const next = new Set(prev);
          next.delete(invitationId);
          return next;
        });
        refreshInvitationCount();
      }, 450);
    } catch (err) {
      console.error('Cannot respond to invitation', err);
    } finally {
      setRespondingId(null);
    }
  };

  const { filters } = useFilters();

  const filtered = tasks.filter((task) => {
    if (filters.priorities.length > 0 && (!task.priority || !filters.priorities.includes(task.priority))) return false;
    if (filters.labels.length > 0) {
      // tasks don't have labels in DB; skip label filtering for now
    }
    return true;
  });

  return (
    <div className="page inbox-page">
      <h1 className="page-title">Inbox</h1>

      {/* ---- Invitations Section ---- */}
      <div className="inbox-invitations-section">
        <div className="inbox-invitations-title">
            <span className="title-icon">
              <Icon name="mail" size={16} />
            </span>
            Team Invitations
            {invitations.length > 0 && (
              <span className="invitation-count-badge">{invitations.length}</span>
            )}
          </div>

          {loadingInvitations ? (
            <div className="inv-loading">
              <div className="inv-spinner" />
              <span>Loading invitations...</span>
            </div>
          ) : invitations.length === 0 ? (
            <div className="inv-empty-state">
              <div className="inv-empty-icon">📭</div>
              <div className="inv-empty-text">No pending invitations</div>
            </div>
          ) : (
            invitations.map((inv) => (
              <div
                key={inv.invitation_id}
                className={`inbox-invitation-card ${fadingIds.has(inv.invitation_id) ? 'fading-out' : ''}`}
              >
                {/* Sender avatar */}
                <div className="inv-sender-avatar">
                  {inv.sender_photo ? (
                    <img
                      src={avatarUrl(inv.sender_photo)}
                      alt=""
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    (inv.sender_username || 'U').charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="inv-info">
                  <div className="inv-sender-row">
                    <span className="inv-sender-name">{inv.sender_username || 'Unknown'}</span>
                    {inv.sender_email && (
                      <span className="inv-sender-email">{inv.sender_email}</span>
                    )}
                  </div>
                  <div className="inv-details-row">
                    <span className="inv-project-badge">
                      <Icon name="hash" size={11} />
                      {inv.project_name || 'Project'}
                    </span>
                    {inv.created_at && (
                      <span className="inv-timestamp">{timeAgo(inv.created_at)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="inv-actions">
                  <button
                    className="inv-accept-btn"
                    onClick={() => handleRespond(inv.invitation_id, 'accept')}
                    disabled={respondingId === inv.invitation_id}
                  >
                    <Icon name="check" size={14} />
                    Accept
                  </button>
                  <button
                    className="inv-decline-btn"
                    onClick={() => handleRespond(inv.invitation_id, 'decline')}
                    disabled={respondingId === inv.invitation_id}
                  >
                    <Icon name="x" size={14} />
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}

          <div className="inbox-section-divider" />
        </div>

      {/* ---- Tasks Section ---- */}
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">No tasks in inbox.</div>
      ) : (
        <TaskList tasks={filtered} handleDeleteTask={(id) => handleDeleteTask(id)} setSelectedTask={() => {}} />
      )}
    </div>
  );
}
