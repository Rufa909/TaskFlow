CREATE TABLE IF NOT EXISTS stage_documents (
  document_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  stage_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NULL,
  file_name VARCHAR(255) NULL,
  file_url VARCHAR(500) NULL,
  mime_type VARCHAR(120) NULL,
  file_size INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_stage_documents_stage (stage_id),
  INDEX idx_stage_documents_type (stage_id, document_type)
);

CREATE TABLE IF NOT EXISTS stage_discussions (
  discussion_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  stage_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_stage_discussions_stage (stage_id, created_at)
);

CREATE TABLE IF NOT EXISTS stage_decisions (
  decision_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  stage_id INT NOT NULL,
  created_by INT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_stage_decisions_stage (stage_id, created_at)
);

CREATE TABLE IF NOT EXISTS stage_handover_notes (
  handover_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  stage_id INT NOT NULL,
  created_by INT NOT NULL,
  summary TEXT NOT NULL,
  open_issues TEXT NULL,
  technical_limits TEXT NULL,
  recommendations TEXT NULL,
  package_snapshot JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stage_handover (stage_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_stage_handover_project (project_id)
);

CREATE TABLE IF NOT EXISTS stage_deliverables (
  deliverable_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  stage_id INT NOT NULL,
  created_by INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status ENUM('draft','ready','accepted') DEFAULT 'ready',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_stage_deliverables_stage (stage_id, status)
);

CREATE TABLE IF NOT EXISTS stage_members (
  stage_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner','member') DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stage_id, user_id),
  FOREIGN KEY (stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_stage_members_user (user_id)
);
