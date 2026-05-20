CREATE TABLE IF NOT EXISTS team_invitations (
  invitation_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id    INT NOT NULL,
  sender_id     INT NOT NULL,
  receiver_id   INT NOT NULL,
  status        ENUM('pending','accepted','declined') DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id)  REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)   REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_invitation (project_id, sender_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS project_members (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id    INT NOT NULL,
  role       ENUM('owner','member') DEFAULT 'member',
  joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_member (project_id, user_id)
);
