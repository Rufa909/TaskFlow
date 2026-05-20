import React, { createContext, useContext, useState } from 'react';

const TeamsContext = createContext();

export function TeamsProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const openTeamModal = () => setIsOpen(true);
  const closeTeamModal = () => setIsOpen(false);

  return (
    <TeamsContext.Provider value={{ isOpen, openTeamModal, closeTeamModal }}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  return useContext(TeamsContext);
}
