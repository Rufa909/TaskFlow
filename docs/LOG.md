# DAILY LOG - 2026-06-12

**Project:** TaskFlow (Task Management System - Marketing)

---

## Activities (đã làm trong hôm nay)

### 2026-06-20 - Stage-scoped tasks and completed workflow lock

**Mo ta:**
- Cap nhat workflow/task de moi stage co danh sach task rieng.
- Khi chuyen sang stage moi, danh sach task chinh cua project chi hien task cua stage hien tai; stage moi se trong neu chua co task.
- Bam vao tung stage van mo panel xem lich su task cua stage do.

**Thay doi:**
- Frontend:
  - `src/pages/homePage.jsx`
    - Xac dinh stage hien tai bang `in_progress` hoac stage dau tien chua `completed`.
    - Loc task list chinh theo `stage_id` cua stage hien tai.
    - Khi workflow stages thay doi, cap nhat lai `taskStageId` theo stage hien tai.
    - Khi tat ca stages da `completed`, tu dong dong form add task va an nut `Add task`.
  - `src/components/task/AddTaskForm.jsx`
    - Go bo dropdown chon stage trong form tao task vi task da duoc gan theo stage hien tai.
- Backend:
  - `server/src/controllers/taskController.js`
    - Them helper resolve stage khi tao task.
    - Neu client khong gui `stage_id`, backend tu gan task vao stage dang `in_progress`.
    - Neu `stage_id` khong thuoc project thi tra loi 400.
    - Neu project co workflow va tat ca stages da `completed`, chan tao task moi va tra loi 409.

**Ket qua:**
- Task duoc tach theo tung stage dung workflow.
- Stage cu van xem duoc lich su task bang cach bam vao stage.
- Stage moi bat dau voi task list trong.
- Khi complete het workflow thi project coi nhu xong, khong tao task moi duoc nua.

**Kiem tra:**
- `npm.cmd run build` pass.
- `node -c server\src\controllers\taskController.js` pass.

---

### 2026-06-12 - Task Stage

**Mô tả:**
- Cập nhật luồng xử lý **Stage** cho workflow/task (đảm bảo stage transitions & trạng thái task theo đúng workflow).

**Thay đổi:**
- Backend bổ sung/chuẩn hoá luồng transition stage:
  - `update tasks ... stage_id`
  - phát realtime event `io.to('project:${projectId}').emit('taskChanged', ...)`
- Workflow/Stage controller + model cập nhật trạng thái + log activity stage.

**Đoạn code liên quan (tóm tắt):**
```js
// server/src/controllers/taskController.js
const taskStageId = stage_id || stageId || null;
...
await pool.query(`
  UPDATE tasks SET ... stage_id = ?
`, [..., taskStageId]);

io.to(`project:${projectId}`).emit('taskChanged', {
  type: 'updated',
  task: enrichedTask,
  projectId: Number(projectId),
});

// server/src/models/ProjectStage.js
await db.query(`
  UPDATE project_stages SET status='completed', approved_by=?, ...
`);
await db.query(`
  INSERT INTO stage_activities (..., action, comment)
  VALUES (?, ?, 'approve', 'Moved to next stage')
`);
```

**Kết quả (luồng thực thi):**
- Khi stage chuyển → DB cập nhật `stage_id`/`project_stages.status` → UI nhận realtime `taskChanged` → track hiển thị stage mới.



**Kết quả:**
- Nền tảng stage/workflow sẵn sàng cho tracking & realtime updates.


---

### 2026-06-12 - fixed auto-refresh

**Mô tả:**
- Khắc phục hành vi auto-refresh: hạn chế refresh sai thời điểm / giúp đồng bộ trạng thái workflow/task ổn định hơn.

**Thay đổi:**
- Chỉnh logic refresh để đồng bộ UI theo trạng thái mới (phối hợp cùng realtime events từ Socket.io).

**Kết quả:**
- Người dùng nhìn thấy cập nhật tiến độ/workflow gần như ngay lập tức, giảm tình trạng “chậm refresh”.


---

### 2026-06-12 - now member can be approved by owner

**Mô tả:**
- Điều chỉnh permission/logic để **Owner** có thể phê duyệt việc thành viên được chấp nhận (membership approval).

**Thay đổi:**
- *(cần bổ sung file cụ thể nếu muốn chi tiết hơn)*

**Kết quả:**
- Flow phê duyệt thành viên rõ ràng hơn, đúng quyền hạn Owner.

---

### 2026-06-12 - add socket.io to auto-refresh pages

**Mô tả:**
- Bổ sung **Socket.io** để auto-refresh trang theo sự kiện realtime.

**Thay đổi:**
- *(cần bổ sung file cụ thể nếu muốn chi tiết hơn)*

**Kết quả:**
- Cập nhật trạng thái workflow/task realtime thay vì chờ refresh thủ công.

---

### 2026-06-12 - design UI workflow

**Mô tả:**
- Thiết kế giao diện liên quan tới **UI workflow** (đảm bảo hiển thị stage/tracking rõ ràng hơn).

**Thay đổi:**
- *(cần bổ sung file cụ thể nếu muốn chi tiết hơn)*

**Kết quả:**
- UI workflow trực quan hơn, sẵn sàng cho phần realtime tracking.

---

### 2026-06-12 - WorkflowTracking

**Mô tả:**
- Bắt đầu/triển khai phần **Workflow Tracking**.

**Thay đổi:**
- *(cần bổ sung file cụ thể nếu muốn chi tiết hơn)*

**Kết quả:**
- Có luồng theo dõi diễn biến workflow.

---

### 2026-06-12 - workflow tracking

**Mô tả:**
- Tiếp tục hoàn thiện/đồng bộ **workflow tracking** sau commit WorkflowTracking.

**Thay đổi:**
- *(cần bổ sung file cụ thể nếu muốn chi tiết hơn)*

**Kết quả:**
- Hoàn thiện hơn luồng tracking và/hoặc cách cập nhật trạng thái.

---

## Notes nhanh (tóm tắt)
- Hôm nay tập trung cải thiện **workflow/stage**, **realtime auto-refresh (Socket.io)** và **workflow tracking**.
- Đồng thời xử lý permission: **member approval bởi owner**.

## Tham chiếu commit
- 6000c91 2026-06-12 task Stage
- cd5722a 2026-06-12 fixed auto-refresh
- 471afb5 2026-06-12 now member can be approved by owner
- b59f556 2026-06-12 add socket.io to auto-refresh pages
- f030bc8 2026-06-12 design UI workflow
- ccc23ad 2026-06-12 WorkflowTracking
- 9fa11a3 2026-06-12 workflow tracking

---

