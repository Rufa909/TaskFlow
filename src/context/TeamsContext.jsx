import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axiosInstance';
import { useAuth } from './AuthContext';

const TeamsContext = createContext();

export function TeamsProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [invitationCount, setInvitationCount] = useState(0);
  const { user, loading } = useAuth();

  const openTeamModal = (project) => {
    if (project) {
      setActiveProject(project);
    }
    setIsOpen(true);
  };

  const closeTeamModal = () => {
    setIsOpen(false);
  };

  const refreshInvitationCount = useCallback(async () => {
    if (!user) {
      setInvitationCount(0);
      return;
    }

    try {
      const res = await api.get('/teams/invitations');
      const invitations = res.data.invitations || [];
      setInvitationCount(invitations.length);
    } catch (err) {
      console.error('Cannot load invitation count', err);
    }
  }, [user]);

  // Refresh count on mount
  useEffect(() => {
    if (loading) return;
    refreshInvitationCount();
  }, [loading, refreshInvitationCount]);

  return (
    <TeamsContext.Provider
      value={{
        isOpen,
        openTeamModal,
        closeTeamModal,
        activeProject,
        setActiveProject,
        invitationCount,
        setInvitationCount,
        refreshInvitationCount,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  return useContext(TeamsContext);
}
