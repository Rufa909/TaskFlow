import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';
import TaskList from '../components/task/TaskList';
import Icon from '../components/common/Icon';
import { useFilters } from '../context/FiltersContext';

export default function InboxPage({ t }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
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
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">No tasks in inbox.</div>
      ) : (
        <TaskList tasks={filtered} handleDeleteTask={(id)=>handleDeleteTask(id)} setSelectedTask={()=>{}} />
      )}
    </div>
  );
}
