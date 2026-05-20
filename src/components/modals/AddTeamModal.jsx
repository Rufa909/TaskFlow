import React, { useEffect, useState, useCallback } from 'react';
import { useTeams } from '../../context/TeamsContext';
import api from '../../api/axiosInstance';
import Icon from '../common/Icon';
import './AddTeamModal.css';

const API_URL = 'http://localhost:5000';

function avatarUrl(photo) {
  if (!photo) return '';
  return photo.startsWith('http') || photo.startsWith('data:')
    ? photo
    : `${API_URL}${photo}`;
}

export default function AddTeamModal() {
  const { isOpen, closeTeamModal, activeProject } = useTeams();

  // Search states
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Invite states
  const [inviteSending, setInviteSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type, text }

  // Members
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Load members when modal opens
  const loadMembers = useCallback(async () => {
    if (!activeProject?.project_id) return;
    setLoadingMembers(true);
    try {
      const res = await api.get(`/teams/projects/${activeProject.project_id}/members`);
      setMembers(res.data.members || []);
    } catch (err) {
      console.error('Cannot load members', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [activeProject?.project_id]);

  useEffect(() => {
    if (isOpen && activeProject) {
      loadMembers();
      // Reset states on open
      setSearchEmail('');
      setSearchResult(null);
      setHasSearched(false);
      setStatusMessage(null);
    }
  }, [isOpen, activeProject, loadMembers]);

  // Search handler
  const handleSearch = async () => {
    const email = searchEmail.trim();
    if (!email) return;

    setSearching(true);
    setSearchResult(null);
    setHasSearched(true);
    setStatusMessage(null);

    try {
      const res = await api.get(`/teams/search?email=${encodeURIComponent(email)}`);
      if (res.data.user) {
        setSearchResult(res.data.user);
      } else {
        setStatusMessage({ type: 'error', text: 'No user found with that email address.' });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'User not found.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Invite handler
  const handleInvite = async () => {
    if (!searchResult || !activeProject) return;

    setInviteSending(true);
    setStatusMessage(null);

    try {
      await api.post('/teams/invite', {
        project_id: activeProject.project_id,
        receiver_id: searchResult.user_id,
      });
      setStatusMessage({ type: 'success', text: `Invitation sent to ${searchResult.username}!` });
      alert(`Đã gửi lời mời thành công đến ${searchResult.username}!`);
      setSearchResult(null);
      setSearchEmail('');
      setHasSearched(false);
      // Refresh members
      loadMembers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send invitation.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setInviteSending(false);
    }
  };

  if (!isOpen) return null;

  const statusIcon = statusMessage?.type === 'success' ? '✓' : statusMessage?.type === 'error' ? '✕' : 'ℹ';

  return (
    <div className="modal-overlay" onClick={() => closeTeamModal()}>
      <div className="modal-content add-team-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>
            <span className="header-icon">
              <Icon name="teamAdd" size={16} />
            </span>
            Invite to Project
            {activeProject && (
              <span className="atm-project-badge">
                <Icon name="hash" size={12} />
                {activeProject.name}
              </span>
            )}
          </h2>
          <button className="close-btn" onClick={() => closeTeamModal()}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Search area */}
          <div className="atm-search-wrapper">
            <div className="atm-search-input-group">
              <input
                type="email"
                placeholder="Search by email address..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <span className="search-icon">
                <Icon name="search" size={16} />
              </span>
            </div>
            <button
              className="atm-search-btn"
              onClick={handleSearch}
              disabled={searching || !searchEmail.trim()}
              title="Search"
            >
              {searching ? (
                <div className="atm-spinner white" />
              ) : (
                <Icon name="search" size={18} />
              )}
            </button>
          </div>

          {/* Status message */}
          {statusMessage && (
            <div className={`atm-status ${statusMessage.type}`}>
              <span className="atm-status-icon">{statusIcon}</span>
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Search result card */}
          {searchResult && (
            <div className="atm-result-card">
              <div className="atm-result-avatar">
                {searchResult.user_photo ? (
                  <img
                    src={avatarUrl(searchResult.user_photo)}
                    alt=""
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  (searchResult.username || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="atm-result-info">
                <div className="atm-result-name">{searchResult.username}</div>
                <div className="atm-result-email">{searchResult.email}</div>
              </div>
              <button
                className="atm-invite-btn"
                onClick={handleInvite}
                disabled={inviteSending}
              >
                {inviteSending ? (
                  <>
                    <div className="atm-spinner white" style={{ width: 14, height: 14 }} />
                    Sending...
                  </>
                ) : (
                  <>
                    <Icon name="mail" size={14} />
                    Invite
                  </>
                )}
              </button>
            </div>
          )}

          {/* Empty search state */}
          {hasSearched && !searchResult && !searching && !statusMessage && (
            <div className="atm-empty">
              <div className="atm-empty-icon">🔍</div>
              <div className="atm-empty-text">No user found. Check the email and try again.</div>
            </div>
          )}

          {/* Divider */}
          <div className="atm-divider" />

          {/* Members section */}
          <div className="atm-section-header">
            <span className="section-icon">
              <Icon name="user" size={14} />
            </span>
            Project Members
          </div>

          {loadingMembers ? (
            <div className="atm-loading-center">
              <div className="atm-spinner" />
              <span>Loading members...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="atm-empty">
              <div className="atm-empty-icon">👥</div>
              <div className="atm-empty-text">No members yet. Invite someone to get started!</div>
            </div>
          ) : (
            <div className="atm-members-list">
              {members.map((member) => (
                <div className="atm-member-chip" key={member.user_id}>
                  <div className="atm-member-avatar">
                    {member.user_photo ? (
                      <img
                        src={avatarUrl(member.user_photo)}
                        alt=""
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      (member.username || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="atm-member-name">{member.username}</span>
                  {member.role && (
                    <span className="atm-member-role">{member.role}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
