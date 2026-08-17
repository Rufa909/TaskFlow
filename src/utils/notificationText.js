function taskName(notification, language) {
  return notification?.task_title || (language === "vi" ? "Công việc" : "Task");
}

function projectName(notification, language) {
  return (
    notification?.task_project_name ||
    notification?.invitation_project_name ||
    notification?.chat_project_name ||
    notification?.project_chat_project_name ||
    notification?.project_name ||
    (language === "vi" ? "dự án" : "project")
  );
}

function actorName(notification) {
  return (
    notification?.invitation_receiver_name ||
    notification?.invitation_receiver_email ||
    notification?.chat_sender_name ||
    notification?.project_chat_sender_name ||
    "User"
  );
}

export function notificationTitle(notification, language = "en") {
  if (language !== "vi") return notification?.title || "New notification";

  const task = taskName(notification, language);
  const project = projectName(notification, language);
  const actor = actorName(notification);

  switch (notification?.type) {
    case "role_updated":
      return `Vai trò đã được cập nhật trong ${project}`;
    case "task_assigned":
      return `Công việc mới được giao: ${task}`;
    case "deadline_due_24h":
      return `Còn 24 giờ đến hạn: ${task}`;
    case "deadline_due_1h":
      return `Còn 1 giờ đến hạn: ${task}`;
    case "deadline_overdue":
      return `Quá hạn: ${task}`;
    case "assignment_request":
      return `Yêu cầu giao việc đang chờ duyệt: ${task}`;
    case "assignment_pending":
      return `Công việc đang chờ owner duyệt: ${task}`;
    case "assignment_rejected":
      return `Yêu cầu giao việc bị từ chối: ${task}`;
    case "task_submitted":
      if (notification?.task_status === "COMPLETED" || notification?.completed_at) {
        return `Công việc đã được duyệt: ${task}`;
      }
      return `Công việc đã nộp chờ duyệt: ${task}`;
    case "leader_approved_task":
      return `Công việc đang chờ owner duyệt: ${task}`;
    case "task_changes_requested":
      return `Yêu cầu chỉnh sửa: ${task}`;
    case "team_invitation_declined":
      return `${actor} đã từ chối lời mời vào ${project}`;
    case "team_invitation_accepted":
      return `${actor} đã chấp nhận lời mời vào ${project}`;
    case "workflow_handover_ready":
      return "Gói bàn giao workflow đã sẵn sàng";
    case "chat_message":
      return `Tin nhắn mới từ ${actor}`;
    case "project_chat_message":
      return `Tin nhắn project mới từ ${actor}`;
    case "group_invited":
      return `Đã được thêm vào nhóm: ${notification?.chat_conversation_name || "Group chat"}`;
    default:
      return notification?.title || "Thông báo mới";
  }
}

export function notificationProjectLabel(notification) {
  return (
    notification?.task_project_name ||
    notification?.chat_project_name ||
    notification?.project_chat_project_name ||
    notification?.invitation_project_name ||
    notification?.project_name ||
    "TaskFlow"
  );
}
