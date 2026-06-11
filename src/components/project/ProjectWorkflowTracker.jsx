import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, ChevronRight, ChevronLeft, User, Calendar } from 'lucide-react';
import axios from 'axios';
import './ProjectWorkflowTracker.css';

const ProjectWorkflowTracker = ({ projectId, isOwner = false, stages: initialStages = [], onStagesChange }) => {
  const [stages, setStages] = useState(initialStages);
  const [loading, setLoading] = useState(!initialStages || initialStages.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isOwnerState, setIsOwnerState] = useState(isOwner);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Đồng bộ prop isOwner vào state khi prop thay đổi
  useEffect(() => {
    setIsOwnerState(isOwner);
  }, [isOwner]);

  // Lấy dữ liệu workflow nếu không có initialStages
  useEffect(() => {
    if (initialStages && initialStages.length > 0) {
      setStages(initialStages);
      setLoading(false);
      return;
    }

    const fetchWorkflow = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/projects/${projectId}/workflow`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setStages(res.data.data);
        if (res.data.isOwner !== undefined) {
          setIsOwnerState(res.data.isOwner);
        }
      } catch (err) {
        console.error("Lỗi khi lấy workflow:", err);
        setError('Không thể tải workflow');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) fetchWorkflow();
  }, [projectId, initialStages, API_URL]);

  const handleMoveNext = async (stageId) => {
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/projects/${projectId}/stages/next`, 
        { stageId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}
      );
      
      // Refetch workflow
      const res = await axios.get(`${API_URL}/api/projects/${projectId}/workflow`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStages(res.data.data);
      if (onStagesChange) {
        onStagesChange(res.data.data);
      }
      if (res.data.isOwner !== undefined) {
        setIsOwnerState(res.data.isOwner);
      }
      setError(null);
    } catch (err) {
      setError('Lỗi khi chuyển sang giai đoạn tiếp theo: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMovePrevious = async (stageId) => {
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/projects/${projectId}/stages/previous`, 
        { stageId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}
      );
      
      // Refetch workflow
      const res = await axios.get(`${API_URL}/api/projects/${projectId}/workflow`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStages(res.data.data);
      if (onStagesChange) {
        onStagesChange(res.data.data);
      }
      if (res.data.isOwner !== undefined) {
        setIsOwnerState(res.data.isOwner);
      }
      setError(null);
    } catch (err) {
      setError('Lỗi khi quay lại giai đoạn trước: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <CheckCircle className="stage-icon completed" size={32} />;
      case 'in_progress': return <Clock className="stage-icon active" size={32} />;
      default: return <div className="stage-icon pending" />;
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'completed': return 'Đã hoàn thành';
      case 'in_progress': return 'Đang thực hiện';
      case 'pending': return 'Chưa bắt đầu';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'completed': return 'badge-completed';
      case 'in_progress': return 'badge-in-progress';
      default: return 'badge-pending';
    }
  };

  if (loading) return <div className="workflow-loading">Đang tải workflow...</div>;
  if (error && stages.length === 0) return <div className="workflow-error">{error}</div>;

  return (
    <div className="workflow-tracker-container">
      <div className="workflow-tracker-header">
        <h2 className="workflow-tracker-title">Progressing</h2>
        <p className="workflow-tracker-subtitle">Keep track of the progress of each project stage</p>
      </div>

      <div className="workflow-timeline-container">
        {stages.map((stage, index) => (
          <div key={stage.id} className={`workflow-item ${stage.status}`}>
            {/* Connector line to next stage */}
            {index < stages.length - 1 && <div className="workflow-connector" />}
            
            {/* Stage card */}
            <div className="stage-card">
              {/* Status indicator */}
              <div className="stage-status-indicator">
                {getStatusIcon(stage.status)}
              </div>

              {/* Stage content */}
              <div className="stage-content">
                <div className="stage-header">
                  <div>
                    <h3 className="stage-name">{stage.stage_order}. {stage.stage_name}</h3>
                    {stage.description && (
                      <p className="stage-description">{stage.description}</p>
                    )}
                  </div>
                  <span className={`stage-badge ${getStatusBadgeClass(stage.status)}`}>
                    {getStatusLabel(stage.status)}
                  </span>
                </div>

                {/* Stage metadata */}
                <div className="stage-metadata">
                  {stage.assignee_name && (
                    <div className="metadata-item">
                      <User size={16} />
                      <span>{stage.assignee_name}</span>
                    </div>
                  )}
                  {stage.deadline && (
                    <div className="metadata-item">
                      <Calendar size={16} />
                      <span>{new Date(stage.deadline).toLocaleDateString('vi-VN')}</span>
                    </div>
                  )}
                </div>

                {/* Action section for owner on in_progress stage */}
                {isOwnerState && stage.status === 'in_progress' && (
                  <div className="stage-actions">
                    {error && <div className="action-error">{error}</div>}
                    
                    <div className="action-buttons">
                      <button
                        className="btn-next"
                        onClick={() => handleMoveNext(stage.id)}
                        disabled={isSubmitting}
                      >
                        <ChevronRight size={18} />
                        <span>Tiếp tục</span>
                      </button>
                      <button
                        className="btn-previous"
                        onClick={() => handleMovePrevious(stage.id)}
                        disabled={isSubmitting || stage.stage_order === 1}
                      >
                        <ChevronLeft size={18} />
                        <span>Quay lại</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectWorkflowTracker;