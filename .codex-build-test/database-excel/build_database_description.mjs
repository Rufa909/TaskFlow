import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/database-diagram-detail";
const outputPath = `${outputDir}/taskflow_database_description.xlsx`;

const tables = [
  {
    name: "users",
    vietnamese: "NguoiDung",
    purpose: "Luu thong tin tai khoan nguoi dung dang nhap vao he thong TaskFlow.",
    columns: [
      ["user_id", "INT", "PK", "Ma dinh danh duy nhat cua nguoi dung."],
      ["username", "VARCHAR(100)", "", "Ten hien thi cua nguoi dung."],
      ["email", "VARCHAR(150)", "UNIQUE", "Email dang nhap va nhan thong bao."],
      ["password", "VARCHAR(255)", "", "Mat khau da ma hoa."],
      ["user_photo", "VARCHAR(255)", "", "Duong dan anh dai dien."],
      ["bio", "TEXT", "", "Mo ta ngan ve nguoi dung."],
      ["role", "ENUM('admin','owner','member')", "", "Role cap he thong, dung de xac dinh admin."],
      ["email_verified", "TINYINT(1)", "", "Trang thai xac minh email."],
      ["created_at", "DATETIME", "", "Thoi diem tao tai khoan."],
      ["updated_at", "DATETIME", "", "Thoi diem cap nhat tai khoan gan nhat."],
    ],
  },
  {
    name: "accounts",
    vietnamese: "TaiKhoanLienKet",
    purpose: "Luu thong tin dang nhap/ket noi qua nha cung cap ben ngoai nhu Google.",
    columns: [
      ["account_id", "INT", "PK", "Ma tai khoan lien ket."],
      ["user_id", "INT", "FK -> users.user_id", "Nguoi dung so huu tai khoan lien ket."],
      ["provider", "ENUM", "", "Nha cung cap dang nhap, vi du Google."],
      ["google_id", "VARCHAR(150)", "", "Ma dinh danh Google neu dang nhap bang Google."],
      ["verification_token", "VARCHAR(255)", "", "Token xac minh email/tai khoan."],
      ["token_expires", "DATETIME", "", "Thoi diem token het han."],
      ["created_at", "DATETIME", "", "Thoi diem tao ban ghi."],
    ],
  },
  {
    name: "projects",
    vietnamese: "DuAn",
    purpose: "Luu thong tin du an, chu so huu, deadline va trang thai tong quan.",
    columns: [
      ["project_id", "INT", "PK", "Ma dinh danh du an."],
      ["owner_id", "INT", "FK -> users.user_id", "Nguoi tao/chu so huu du an."],
      ["name", "VARCHAR(255)", "", "Ten du an."],
      ["description", "TEXT", "", "Mo ta du an."],
      ["deadline", "DATE", "", "Han chot cua du an."],
      ["status", "ENUM", "", "Trang thai du an."],
      ["deleted_at", "DATETIME", "", "Thoi diem an/xoa mem du an."],
      ["created_at", "DATETIME", "", "Thoi diem tao du an."],
      ["updated_at", "DATETIME", "", "Thoi diem cap nhat gan nhat."],
    ],
  },
  {
    name: "project_members",
    vietnamese: "ThanhVienDuAn",
    purpose: "Lien ket nguoi dung voi du an va luu vai tro trong tung du an.",
    columns: [
      ["project_id", "INT", "PK, FK -> projects.project_id", "Du an ma thanh vien tham gia."],
      ["user_id", "INT", "PK, FK -> users.user_id", "Nguoi dung tham gia du an."],
      ["role", "ENUM", "", "Vai tro trong du an: leader, ba, developer, qa, devops, member."],
      ["joined_at", "DATETIME", "", "Thoi diem tham gia du an."],
      ["updated_at", "DATETIME", "", "Thoi diem cap nhat vai tro."],
    ],
  },
  {
    name: "workflows",
    vietnamese: "QuyTrinh",
    purpose: "Quan ly workflow cua tung du an va tien do tong hop.",
    columns: [
      ["workflow_id", "INT", "PK", "Ma workflow."],
      ["project_id", "INT", "FK -> projects.project_id", "Du an ap dung workflow."],
      ["name", "VARCHAR(150)", "", "Ten workflow."],
      ["progress", "FLOAT", "", "Phan tram tien do workflow."],
      ["created_at", "DATETIME", "", "Thoi diem tao workflow."],
      ["updated_at", "DATETIME", "", "Thoi diem cap nhat workflow."],
    ],
  },
  {
    name: "workflow_stages",
    vietnamese: "GiaiDoanWorkflow",
    purpose: "Luu cac giai doan trong workflow, thu tu, nguoi phu trach va phe duyet.",
    columns: [
      ["stage_id", "INT", "PK", "Ma giai doan workflow."],
      ["workflow_id", "INT", "FK -> workflows.workflow_id", "Workflow chua giai doan."],
      ["stage_name", "VARCHAR(150)", "", "Ten giai doan."],
      ["stage_order", "INT", "", "Thu tu giai doan."],
      ["status", "ENUM", "", "Trang thai giai doan."],
      ["assigned_to", "INT", "FK -> users.user_id", "Nguoi duoc giao phu trach."],
      ["deadline", "DATE", "", "Han cua giai doan."],
      ["approved_by", "INT", "FK -> users.user_id", "Nguoi duyet giai doan."],
      ["approved_at", "DATETIME", "", "Thoi diem duyet."],
      ["created_at", "DATETIME", "", "Thoi diem tao."],
      ["updated_at", "DATETIME", "", "Thoi diem cap nhat."],
    ],
  },
  {
    name: "tasks",
    vietnamese: "CongViec",
    purpose: "Luu cac cong viec thuoc du an va stage.",
    columns: [
      ["task_id", "INT", "PK", "Ma cong viec."],
      ["project_id", "INT", "FK -> projects.project_id", "Du an chua cong viec."],
      ["stage_id", "INT", "FK -> workflow_stages.stage_id", "Giai doan cua cong viec."],
      ["created_by", "INT", "FK -> users.user_id", "Nguoi tao cong viec."],
      ["title", "VARCHAR(255)", "", "Tieu de cong viec."],
      ["description", "TEXT", "", "Mo ta chi tiet cong viec."],
      ["deadline", "DATETIME", "", "Han hoan thanh."],
      ["time", "TIME", "", "Thoi gian du kien/nhac viec."],
      ["priority", "ENUM", "", "Muc uu tien: low, medium, high, urgent."],
      ["status", "ENUM", "", "Trang thai cong viec."],
      ["labels", "JSON", "", "Danh sach nhan/label."],
      ["assignment_status", "ENUM", "", "Trang thai giao viec."],
      ["completed_at", "DATETIME", "", "Thoi diem hoan thanh."],
      ["deleted_at", "DATETIME", "", "Thoi diem xoa mem."],
      ["created_at", "DATETIME", "", "Thoi diem tao."],
      ["updated_at", "DATETIME", "", "Thoi diem cap nhat."],
    ],
  },
  {
    name: "task_assignees",
    vietnamese: "PhanCongCongViec",
    purpose: "Lien ket cong viec voi nguoi duoc giao va trang thai nhan viec.",
    columns: [
      ["task_id", "INT", "PK, FK -> tasks.task_id", "Cong viec duoc giao."],
      ["user_id", "INT", "PK, FK -> users.user_id", "Nguoi duoc giao."],
      ["status", "ENUM", "", "Trang thai phan cong."],
      ["assigned_at", "DATETIME", "", "Thoi diem giao viec."],
    ],
  },
  {
    name: "task_subtasks",
    vietnamese: "CongViecCon",
    purpose: "Luu cac dau viec nho ben trong mot task.",
    columns: [
      ["subtask_id", "INT", "PK", "Ma cong viec con."],
      ["task_id", "INT", "FK -> tasks.task_id", "Task cha."],
      ["title", "VARCHAR(255)", "", "Ten cong viec con."],
      ["completed_at", "DATETIME", "", "Thoi diem hoan thanh cong viec con."],
      ["created_at", "DATETIME", "", "Thoi diem tao."],
    ],
  },
  {
    name: "task_comments",
    vietnamese: "BinhLuanCongViec",
    purpose: "Luu binh luan/thao luan trong tung task.",
    columns: [
      ["comment_id", "INT", "PK", "Ma binh luan."],
      ["task_id", "INT", "FK -> tasks.task_id", "Task duoc binh luan."],
      ["user_id", "INT", "FK -> users.user_id", "Nguoi viet binh luan."],
      ["body", "TEXT", "", "Noi dung binh luan."],
      ["deleted_at", "DATETIME", "", "Thoi diem xoa mem binh luan."],
      ["created_at", "DATETIME", "", "Thoi diem tao binh luan."],
    ],
  },
  {
    name: "attachments",
    vietnamese: "TepDinhKem",
    purpose: "Quan ly tep dinh kem cua task hoac comment.",
    columns: [
      ["attachment_id", "INT", "PK", "Ma tep dinh kem."],
      ["task_id", "INT", "FK -> tasks.task_id", "Task co tep dinh kem."],
      ["comment_id", "INT", "FK -> task_comments.comment_id", "Binh luan co tep dinh kem."],
      ["uploaded_by", "INT", "FK -> users.user_id", "Nguoi tai tep len."],
      ["file_name", "VARCHAR(255)", "", "Ten tep."],
      ["file_url", "VARCHAR(500)", "", "Duong dan tep."],
      ["file_type", "VARCHAR(100)", "", "Loai tep."],
      ["file_size", "INT", "", "Dung luong tep."],
      ["uploaded_at", "DATETIME", "", "Thoi diem tai tep."],
    ],
  },
  {
    name: "chat_conversations",
    vietnamese: "CuocTroChuyen",
    purpose: "Luu phong chat cua project hoac nhom.",
    columns: [
      ["conversation_id", "INT", "PK", "Ma cuoc tro chuyen."],
      ["project_id", "INT", "FK -> projects.project_id", "Du an lien quan."],
      ["type", "ENUM", "", "Loai chat: project/group/private."],
      ["name", "VARCHAR(150)", "", "Ten cuoc tro chuyen."],
      ["created_by", "INT", "FK -> users.user_id", "Nguoi tao chat."],
      ["disbanded_at", "DATETIME", "", "Thoi diem giai tan nhom chat."],
      ["created_at", "DATETIME", "", "Thoi diem tao."],
    ],
  },
  {
    name: "chat_conversation_members",
    vietnamese: "ThanhVienCuocTroChuyen",
    purpose: "Lien ket nguoi dung voi cuoc tro chuyen.",
    columns: [
      ["conversation_id", "INT", "PK, FK -> chat_conversations.conversation_id", "Cuoc tro chuyen."],
      ["user_id", "INT", "PK, FK -> users.user_id", "Thanh vien trong chat."],
      ["role", "ENUM", "", "Vai tro trong chat."],
      ["joined_at", "DATETIME", "", "Thoi diem tham gia."],
      ["removed_at", "DATETIME", "", "Thoi diem roi/khoi nhom."],
    ],
  },
  {
    name: "chat_messages",
    vietnamese: "TinNhan",
    purpose: "Luu tin nhan trong cac cuoc tro chuyen.",
    columns: [
      ["message_id", "INT", "PK", "Ma tin nhan."],
      ["conversation_id", "INT", "FK -> chat_conversations.conversation_id", "Cuoc tro chuyen chua tin nhan."],
      ["sender_id", "INT", "FK -> users.user_id", "Nguoi gui tin nhan."],
      ["content", "TEXT", "", "Noi dung tin nhan."],
      ["attachment_url", "VARCHAR(500)", "", "Tep dinh kem trong tin nhan."],
      ["attachment_name", "VARCHAR(255)", "", "Ten tep dinh kem."],
      ["attachment_type", "VARCHAR(100)", "", "Loai tep dinh kem."],
      ["recalled_at", "DATETIME", "", "Thoi diem thu hoi tin nhan."],
      ["created_at", "DATETIME", "", "Thoi diem gui tin."],
    ],
  },
  {
    name: "notifications",
    vietnamese: "ThongBao",
    purpose: "Luu thong bao gui den nguoi dung.",
    columns: [
      ["notification_id", "INT", "PK", "Ma thong bao."],
      ["user_id", "INT", "FK -> users.user_id", "Nguoi nhan thong bao."],
      ["type", "VARCHAR(80)", "", "Loai thong bao."],
      ["reference_id", "INT", "", "Ma doi tuong lien quan."],
      ["title", "VARCHAR(255)", "", "Tieu de thong bao."],
      ["message", "TEXT", "", "Noi dung thong bao."],
      ["is_read", "TINYINT(1)", "", "Trang thai da doc."],
      ["created_at", "DATETIME", "", "Thoi diem tao thong bao."],
    ],
  },
  {
    name: "ai_documents",
    vietnamese: "TaiLieuAI",
    purpose: "Luu tai lieu da upload/nhung vector phuc vu tro ly AI.",
    columns: [
      ["document_id", "INT", "PK", "Ma tai lieu AI."],
      ["user_id", "INT", "FK -> users.user_id", "Nguoi upload tai lieu."],
      ["file_name", "VARCHAR(255)", "", "Ten file."],
      ["file_type", "VARCHAR(30)", "", "Loai file."],
      ["chunk_index", "INT", "", "So thu tu doan van ban."],
      ["chunk_text", "TEXT", "", "Noi dung doan van ban."],
      ["embedding", "JSON", "", "Vector embedding."],
      ["created_at", "DATETIME", "", "Thoi diem upload/xu ly."],
    ],
  },
  {
    name: "ai_chat_history",
    vietnamese: "LichSuChatAI",
    purpose: "Luu lich su hoi dap voi tro ly AI.",
    columns: [
      ["history_id", "INT", "PK", "Ma lich su chat AI."],
      ["user_id", "INT", "FK -> users.user_id", "Nguoi chat voi AI."],
      ["session_id", "VARCHAR(100)", "", "Phien chat."],
      ["role", "ENUM", "", "Vai tro tin nhan: user/assistant/system."],
      ["content", "TEXT", "", "Noi dung tin nhan."],
      ["provider", "VARCHAR(80)", "", "Nha cung cap AI."],
      ["created_at", "DATETIME", "", "Thoi diem tao tin nhan."],
    ],
  },
];

const relationships = [
  ["users", "projects", "users.user_id = projects.owner_id", "1 - n", "Mot nguoi dung co the so huu nhieu du an."],
  ["users", "accounts", "users.user_id = accounts.user_id", "1 - n", "Mot nguoi dung co the co nhieu tai khoan lien ket."],
  ["projects", "project_members", "projects.project_id = project_members.project_id", "1 - n", "Mot du an co nhieu thanh vien."],
  ["users", "project_members", "users.user_id = project_members.user_id", "1 - n", "Mot nguoi dung tham gia nhieu du an."],
  ["projects", "workflows", "projects.project_id = workflows.project_id", "1 - n", "Mot du an co the co mot hoac nhieu workflow."],
  ["workflows", "workflow_stages", "workflows.workflow_id = workflow_stages.workflow_id", "1 - n", "Mot workflow gom nhieu giai doan."],
  ["projects", "tasks", "projects.project_id = tasks.project_id", "1 - n", "Mot du an co nhieu cong viec."],
  ["workflow_stages", "tasks", "workflow_stages.stage_id = tasks.stage_id", "1 - n", "Mot giai doan co nhieu cong viec."],
  ["users", "tasks", "users.user_id = tasks.created_by", "1 - n", "Mot nguoi dung tao nhieu cong viec."],
  ["tasks", "task_assignees", "tasks.task_id = task_assignees.task_id", "1 - n", "Mot cong viec co the giao cho nhieu nguoi."],
  ["users", "task_assignees", "users.user_id = task_assignees.user_id", "1 - n", "Mot nguoi dung co the duoc giao nhieu cong viec."],
  ["tasks", "task_subtasks", "tasks.task_id = task_subtasks.task_id", "1 - n", "Mot cong viec co nhieu cong viec con."],
  ["tasks", "task_comments", "tasks.task_id = task_comments.task_id", "1 - n", "Mot cong viec co nhieu binh luan."],
  ["users", "task_comments", "users.user_id = task_comments.user_id", "1 - n", "Mot nguoi dung viet nhieu binh luan."],
  ["tasks", "attachments", "tasks.task_id = attachments.task_id", "1 - n", "Mot cong viec co nhieu tep dinh kem."],
  ["task_comments", "attachments", "task_comments.comment_id = attachments.comment_id", "1 - n", "Mot binh luan co the co tep dinh kem."],
  ["projects", "chat_conversations", "projects.project_id = chat_conversations.project_id", "1 - n", "Mot du an co nhieu phong chat."],
  ["chat_conversations", "chat_conversation_members", "chat_conversations.conversation_id = chat_conversation_members.conversation_id", "1 - n", "Mot phong chat co nhieu thanh vien."],
  ["users", "chat_conversation_members", "users.user_id = chat_conversation_members.user_id", "1 - n", "Mot nguoi dung tham gia nhieu phong chat."],
  ["chat_conversations", "chat_messages", "chat_conversations.conversation_id = chat_messages.conversation_id", "1 - n", "Mot phong chat co nhieu tin nhan."],
  ["users", "chat_messages", "users.user_id = chat_messages.sender_id", "1 - n", "Mot nguoi dung gui nhieu tin nhan."],
  ["users", "notifications", "users.user_id = notifications.user_id", "1 - n", "Mot nguoi dung nhan nhieu thong bao."],
  ["users", "ai_documents", "users.user_id = ai_documents.user_id", "1 - n", "Mot nguoi dung upload nhieu tai lieu AI."],
  ["users", "ai_chat_history", "users.user_id = ai_chat_history.user_id", "1 - n", "Mot nguoi dung co nhieu lich su chat AI."],
];

function writeSheet(sheet, headers, rows, tableName) {
  sheet.showGridLines = false;
  sheet.getRange("A1").values = [["TaskFlow - Bang mo ta chi tiet database"]];
  sheet.getRange("A1:F1").merge();
  sheet.getRange("A1").format = {
    fill: "#1D4ED8",
    font: { bold: true, color: "#FFFFFF", size: 15 },
    horizontalAlignment: "center",
  };
  sheet.getRange("A3").values = [headers];
  sheet.getRange("A3:F3").format = {
    fill: "#E0F2FE",
    font: { bold: true, color: "#0F172A" },
    borders: { preset: "all", style: "thin", color: "#CBD5E1" },
  };
  const endRow = rows.length + 3;
  sheet.getRange(`A4:F${endRow}`).values = rows;
  sheet.getRange(`A4:F${endRow}`).format = {
    borders: { preset: "all", style: "thin", color: "#E2E8F0" },
    wrapText: true,
    verticalAlignment: "top",
  };
  sheet.tables.add(`A3:F${endRow}`, true, tableName).style = "TableStyleMedium2";
  sheet.freezePanes.freezeRows(3);
  sheet.getRange("A:A").format.columnWidth = 24;
  sheet.getRange("B:B").format.columnWidth = 24;
  sheet.getRange("C:C").format.columnWidth = 22;
  sheet.getRange("D:D").format.columnWidth = 20;
  sheet.getRange("E:E").format.columnWidth = 28;
  sheet.getRange("F:F").format.columnWidth = 55;
  sheet.getRange(`A4:F${endRow}`).format.autofitRows();
}

await fs.mkdir(outputDir, { recursive: true });
const workbook = Workbook.create();

const summary = workbook.worksheets.add("Tong quan");
summary.showGridLines = false;
summary.getRange("A1").values = [["TaskFlow - Tong quan database diagram"]];
summary.getRange("A1:E1").merge();
summary.getRange("A1").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  horizontalAlignment: "center",
};
summary.getRange("A3:E3").values = [["STT", "Bang", "Ten tieng Viet", "So field", "Chuc nang"]];
summary.getRange("A3:E3").format = {
  fill: "#CCFBF1",
  font: { bold: true, color: "#0F172A" },
  borders: { preset: "all", style: "thin", color: "#99F6E4" },
};
summary.getRange(`A4:E${tables.length + 3}`).values = tables.map((table, index) => [
  index + 1,
  table.name,
  table.vietnamese,
  table.columns.length,
  table.purpose,
]);
summary.getRange(`A4:E${tables.length + 3}`).format = {
  borders: { preset: "all", style: "thin", color: "#E2E8F0" },
  wrapText: true,
  verticalAlignment: "top",
};
summary.tables.add(`A3:E${tables.length + 3}`, true, "TongQuanTables").style = "TableStyleMedium4";
summary.freezePanes.freezeRows(3);
summary.getRange("A:A").format.columnWidth = 8;
summary.getRange("B:B").format.columnWidth = 30;
summary.getRange("C:C").format.columnWidth = 24;
summary.getRange("D:D").format.columnWidth = 12;
summary.getRange("E:E").format.columnWidth = 72;

const detailRows = [];
for (const table of tables) {
  for (const column of table.columns) {
    detailRows.push([table.name, table.vietnamese, ...column]);
  }
}

const detail = workbook.worksheets.add("Bang mo ta chi tiet");
writeSheet(
  detail,
  ["Bang", "Ten tieng Viet", "Field", "Kieu du lieu", "Khoa/Rang buoc", "Mo ta"],
  detailRows,
  "BangMoTaChiTiet",
);

const rel = workbook.worksheets.add("Quan he");
writeSheet(
  rel,
  ["Bang cha", "Bang con", "Dieu kien lien ket", "Loai quan he", "Y nghia", "Ghi chu"],
  relationships.map((item) => [...item, ""]),
  "QuanHeDatabase",
);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const overview = await workbook.inspect({
  kind: "table",
  sheetId: "Bang mo ta chi tiet",
  range: "A3:F15",
  include: "values",
  tableMaxRows: 12,
  tableMaxCols: 6,
});
console.log(overview.ndjson);

for (const sheetName of ["Tong quan", "Bang mo ta chi tiet", "Quan he"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName.replaceAll(" ", "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);
