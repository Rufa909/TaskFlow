USE taskflow;

ALTER TABLE project_members
  MODIFY COLUMN role ENUM('owner','leader','member') DEFAULT 'member';

SET @ddl = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE tasks ADD COLUMN assignment_status ENUM(''none'',''pending'',''approved'',''rejected'') DEFAULT ''none''',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'assignment_status'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE tasks ADD COLUMN deadline_notified_at DATETIME NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'deadline_notified_at'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS task_assignment_requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  project_id INT NOT NULL,
  assigned_to INT NOT NULL,
  requested_by INT NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  note TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewed_by INT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_task_assignment_requests_project (project_id),
  INDEX idx_task_assignment_requests_status (status)
);

CREATE TABLE IF NOT EXISTS task_submissions (
  submission_id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  project_id INT NOT NULL,
  submitted_by INT NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  note TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewed_by INT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_task_submissions_project (project_id),
  INDEX idx_task_submissions_status (status)
);
