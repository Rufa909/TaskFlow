ALTER TABLE project_members
  MODIFY COLUMN role ENUM(
    'owner',
    'leader',
    'member',
    'ba',
    'developer',
    'qa',
    'devops',
    'viewer'
  ) DEFAULT 'member';
