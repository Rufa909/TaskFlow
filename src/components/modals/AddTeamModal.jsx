import React, { useEffect, useState } from 'react';
import { useTeams } from '../../context/TeamsContext';

const STORAGE_KEY = 'taskflow.teams';

export default function AddTeamModal() {
  const { isOpen, closeTeamModal } = useTeams();
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setTeams(JSON.parse(raw));
  }, []);

  const saveTeams = (next) => {
    setTeams(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const next = [...teams, { id: Date.now(), name: name.trim(), members: [] }];
    saveTeams(next);
    setName('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => closeTeamModal()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Teams</h2>
          <button className="icon-btn" onClick={() => closeTeamModal()}>✕</button>
        </div>
        <div className="modal-body">
          <label>Team name</label>
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Team name" />
          <div style={{ marginTop: 8 }}>
            <button onClick={handleAdd} className="submit-btn">Add</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <h3>Your teams</h3>
            {teams.length === 0 ? <div className="empty-state">No teams yet.</div> : (
              <ul>
                {teams.map(t => <li key={t.id}>{t.name}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
