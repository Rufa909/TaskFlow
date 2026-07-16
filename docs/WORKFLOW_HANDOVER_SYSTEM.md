# Workflow Handover System

## Folder Structure

```text
server/
  migrations/20260716_workflow_handover.sql
  src/controllers/workflowController.js
  src/routes/workflowRoutes.js
src/
  components/project/StageTaskPanel.jsx
  components/project/StageTaskPanel.css
  components/project/ProjectWorkflowTracker.jsx
```

## Database Migration

Run this SQL against the TaskFlow MySQL database when you want to apply the schema manually:

```bash
mysql -u <user> -p <database> < server/migrations/20260716_workflow_handover.sql
```

The backend also creates these tables automatically on workflow API usage:

- `stage_documents`
- `stage_discussions`
- `stage_decisions`
- `stage_handover_notes`
- `stage_deliverables`
- `stage_members`

## API Examples

### Get workflow

```http
GET /api/projects/12/workflow
Authorization: Bearer <token>
```

### Get stage overview

```http
GET /api/projects/12/stages/3/overview
Authorization: Bearer <token>
```

Returns incoming handover data from the previous stage, current stage package data, checklist, and completion permission.

### Upload document

```http
POST /api/projects/12/stages/3/documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

title=Requirement.pdf
document_type=requirement_document
document=<file>
```

### Add discussion

```http
POST /api/projects/12/stages/3/discussions
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Khach hang chi ho tro tieng Viet."
}
```

### Add decision

```http
POST /api/projects/12/stages/3/decisions
Authorization: Bearer <token>
Content-Type: application/json

{
  "decision": "Su dung JWT Authentication",
  "reason": "De mo rong va ho tro stateless authentication."
}
```

### Save handover notes

```http
POST /api/projects/12/stages/3/handover
Authorization: Bearer <token>
Content-Type: application/json

{
  "summary": "Hoan thanh phan tich yeu cau.",
  "open_issues": "Chua xac dinh cong thanh toan.",
  "technical_limits": "Can xac nhan webhook payment.",
  "recommendations": "Nen tich hop VNPay."
}
```

### Add deliverable

```http
POST /api/projects/12/stages/3/deliverables
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Analysis handover package",
  "description": "Requirement, user story, ERD, wireframe, and notes are ready."
}
```

### Complete stage

```http
POST /api/projects/12/stages/3/complete
Authorization: Bearer <token>
```

The API checks required documents, requires handover notes, creates the package snapshot, updates workflow progress, notifies the next stage members, and emits `workflowChanged`.

## Required Checklist

The Analysis stage currently requires:

- Requirement Document
- User Story
- ERD
- Wireframe
- Handover Notes

Other stages require Handover Notes by default.
