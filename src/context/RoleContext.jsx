import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/axiosInstance';

const RoleContext = createContext();

export function RoleProvider({ children }) {
  // { [project_id]: 'owner' | 'leader' | 'member' }
  const [projectRoles, setProjectRoles] = useState({});
  // { [project_id]: { count, assignCount, subCount } }
  const [pendingCounts, setPendingCounts] = useState({});

  // Lấy role của user trong một project
  const fetchMyRole = useCallback(async (projectId) => {
    if (!projectId) return null;
    // Trả về cache nếu đã có
    if (projectRoles[projectId]) return projectRoles[projectId];
    try {
      const res = await api.get(`/roles/projects/${projectId}/my-role`);
      const role = res.data.role;
      setProjectRoles(prev => ({ ...prev, [projectId]: role }));
      return role;
    } catch (err) {
      console.error('Cannot fetch role:', err);
      return null;
    }
  }, [projectRoles]);

  // Lấy role, luôn fresh (không dùng cache)
  const refreshMyRole = useCallback(async (projectId) => {
    if (!projectId) return null;
    try {
      const res = await api.get(`/roles/projects/${projectId}/my-role`);
      const role = res.data.role;
      setProjectRoles(prev => ({ ...prev, [projectId]: role }));
      return role;
    } catch (err) {
      console.error('Cannot refresh role:', err);
      return null;
    }
  }, []);

  // Lấy pending count (dành cho owner)
  const fetchPendingCount = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await api.get(`/roles/pending-count/${projectId}`);
      if (res.data.success) {
        setPendingCounts(prev => ({
          ...prev,
          [projectId]: {
            count: res.data.count,
            assignCount: res.data.assignCount,
            subCount: res.data.subCount,
          }
        }));
      }
    } catch (err) {
      console.error('Cannot fetch pending count:', err);
    }
  }, []);

  // Xóa cache role cho project (dùng sau khi đổi role)
  const invalidateRole = useCallback((projectId) => {
    setProjectRoles(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  }, []);

  return (
    <RoleContext.Provider value={{
      projectRoles,
      pendingCounts,
      fetchMyRole,
      refreshMyRole,
      fetchPendingCount,
      invalidateRole,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
