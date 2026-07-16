# Huong Dan Quy Trinh Workflow Handover - TaskFlow

Tai lieu nay huong dan chi tiet cach van hanh quy trinh ban giao cong viec giua cac stage trong TaskFlow.

## 1. Muc tieu quy trinh

Workflow Handover System giup moi stage khong chi hoan thanh task, ma con ban giao day du tri thuc cho stage tiep theo.

Ket qua mong muon:

- Giam viec hoi lai thong tin giua cac team.
- Giam sai lech yeu cau khi chuyen tu Phan tich sang Phat trien, Kiem thu, Trien khai.
- Luu lai decisions, discussions, documents, deliverables va handover notes theo tung stage.
- Dam bao chi nguoi phu trach stage moi duoc chuyen stage.

## 2. Cac role trong website

### Owner

Nguoi tao project va co quyen cao nhat trong project.

Quyen:

- Quan ly project.
- Moi thanh vien.
- Cap nhat role thanh vien.
- Xem tat ca workflow data.
- Quay lai stage truoc neu can.

### Leader

Nguoi dieu phoi project hoac technical lead.

Quyen:

- Tao task.
- Gan task cho thanh vien.
- Duyet task submission theo luong hien co.
- Ghi decisions, discussions, documents, handover.

### BA

Phu trach giai doan Phan tich.

Trach nhiem:

- Tao Requirement Document.
- Tao User Story.
- Tao Use Case.
- Tai ERD, Wireframe, Meeting Notes.
- Ghi handover notes cho team Phat trien.

### Developer

Phu trach giai doan Phat trien.

Trach nhiem:

- Nhan thong tin tu giai doan Phan tich.
- Doc Requirement, User Story, ERD, Wireframe, Decisions.
- Ghi lai technical decisions moi.
- Ban giao API docs, implementation notes cho QA.

### QA

Phu trach giai doan Thu nghiem.

Trach nhiem:

- Nhan thong tin tu Development.
- Tao test cases, bug notes, test report.
- Ghi issues con ton dong.
- Ban giao ket qua test cho Deployment.

### DevOps

Phu trach giai doan Trien khai va bao tri.

Trach nhiem:

- Nhan build/package/release notes.
- Ghi deployment decisions.
- Ghi van de moi truong, rollback plan, monitoring notes.

### Member

Thanh vien thao tac chung trong project.

Quyen:

- Nhan task.
- Cap nhat tien do task.
- Ghi discussion va thong tin lien quan neu duoc phan cong.

### Viewer

Nguoi chi xem thong tin.

Gioi han:

- Khong tao task.
- Khong duoc gan task.
- Khong duoc chuyen stage.
- Khong cap nhat role.

## 3. Du lieu can co trong moi stage

Moi stage can co cac nhom thong tin:

- Tasks: cong viec can hoan thanh trong stage.
- Documents: file/tai lieu cua stage.
- Discussions: trao doi theo ngu canh stage.
- Decisions: quyet dinh quan trong va ly do.
- Handover Notes: tom tat ban giao.
- Deliverables: san pham dau ra cua stage.

## 4. Quy trinh thuc hien theo tung stage

### Buoc 1: Mo project

Nguoi dung vao project can lam viec.

He thong hien workflow hien tai:

```text
Phan tich -> Phat trien -> Thu nghiem -> Trien khai va bao tri
```

Thanh tien do tu dong tinh theo cac stage da completed.

### Buoc 2: Click vao stage

Khi click mot stage, drawer Stage Workspace mo ra.

Drawer gom cac khu vuc:

- Thong tin nhan tu giai doan truoc.
- Tabs: Tasks, Documents, Discussions, Decisions, Handover.
- Thong tin ban giao cho giai doan tiep theo.
- Nut Chuyen sang giai doan tiep theo.

### Buoc 3: Xu ly task trong stage

Vao tab Tasks de xem task thuoc stage.

Thanh vien phu trach can:

- Doc task.
- Cap nhat task.
- Hoan thanh task theo luong hien co.
- Dam bao task quan trong da duoc xu ly truoc khi ban giao.

### Buoc 4: Tai documents

Vao tab Documents.

Chon document type va tai file len.

Vi du stage Phan tich nen co:

- Requirement Document.
- User Story.
- Use Case.
- ERD.
- Wireframe.
- Meeting Notes.

### Buoc 5: Ghi discussions

Vao tab Discussions.

Ghi cac thong tin theo ngu canh, vi du:

```text
Khach hang chi ho tro tieng Viet.
Can uu tien mobile responsive cho man hinh task.
Chua xac nhan nha cung cap thanh toan.
```

Discussions giup stage sau hieu cac trao doi khong nam trong tai lieu chinh.

### Buoc 6: Ghi decisions

Vao tab Decisions.

Moi decision can co:

- Quyet dinh.
- Ly do.
- Nguoi tao.
- Thoi gian tao.

Vi du:

```text
Quyet dinh: Su dung JWT Authentication
Ly do: De mo rong he thong va ho tro stateless authentication.
Nguoi tao: Tech Lead
Ngay: 16/07/2026
```

### Buoc 7: Ghi handover notes

Vao tab Handover.

Bat buoc nhap:

- Tom tat cong viec da hoan thanh.
- Cac van de con ton dong.
- Cac gioi han ky thuat.
- De xuat cho nhom tiep theo.

Vi du:

```text
Tom tat:
Hoan thanh phan tich yeu cau.

Van de ton dong:
Chua xac dinh cong thanh toan.

Gioi han ky thuat:
Can xac nhan webhook tu cong thanh toan.

De xuat:
Nen tich hop VNPay.
```

### Buoc 8: Them deliverables

Trong tab Handover, them deliverables la san pham dau ra cua stage.

Vi du:

- Analysis Handover Package.
- API Specification.
- Test Report.
- Deployment Checklist.

### Buoc 9: Kiem tra checklist truoc khi chuyen stage

He thong tu dong hien checklist.

Voi stage Phan tich, dieu kien bat buoc gom:

- Requirement Document da tai len.
- User Story da tai len.
- ERD da tai len.
- Wireframe da tai len.
- Handover Notes da hoan thanh.

Neu thieu du lieu, nut chuyen stage bi khoa hoac API tra ve loi:

```text
Khong the chuyen sang giai doan tiep theo.
Thieu: ERD, Handover Notes
```

### Buoc 10: Chuyen sang stage tiep theo

Khi checklist day du, nguoi phu trach stage bam:

```text
Chuyen sang giai doan tiep theo
```

He thong se:

- Kiem tra quyen stage owner/member phu trach.
- Kiem tra documents bat buoc.
- Kiem tra handover notes.
- Tao handover package snapshot.
- Cap nhat status stage hien tai thanh completed.
- Chuyen stage tiep theo sang in progress.
- Gui notification cho thanh vien stage tiep theo.
- Cap nhat progress bar.

## 5. Handover Package

Khi stage hoan thanh, he thong dong goi thong tin cua stage thanh handover package.

Vi du package tu Phan tich sang Phat trien:

```text
Phan tich
├── Requirement.pdf
├── UserStory.docx
├── ERD.png
├── Wireframe.fig
├── MeetingNotes.md
├── Decisions
├── Discussions
├── Deliverables
└── HandoverNotes
```

Stage tiep theo se thay package nay o khu vuc:

```text
Thong tin nhan tu giai doan truoc
```

## 6. Quy tac hoan thanh stage

Mot stage chi nen duoc complete khi:

- Cac task quan trong da xu ly.
- Tai lieu bat buoc da co.
- Handover notes da day du.
- Decisions quan trong da duoc ghi lai.
- Van de ton dong da duoc neu ro.
- De xuat cho stage tiep theo da ro rang.

## 7. Vi du luong Phan tich sang Phat trien

1. BA mo stage Phan tich.
2. BA tai Requirement Document, User Story, ERD, Wireframe.
3. BA ghi discussion ve ngon ngu khach hang.
4. BA ghi decision ve database va authentication.
5. BA nhap handover notes.
6. BA them deliverable Analysis Handover Package.
7. BA kiem tra checklist.
8. BA bam Chuyen sang giai doan tiep theo.
9. Developer mo stage Phat trien.
10. Developer thay toan bo thong tin tu Phan tich trong drawer.

## 8. Luu y van hanh

- Khong nen dung discussion de thay the requirement document.
- Moi decision quan trong nen co ly do.
- Handover notes can viet cho nguoi tiep theo doc, khong chi viet cho nguoi trong stage hien tai.
- Viewer chi nen dung cho stakeholder can theo doi, khong tham gia thuc hien.
- Owner nen gan role dung theo chuyen mon: BA, Developer, QA, DevOps.

## 9. API chinh

```text
GET  /api/projects/:projectId/workflow
GET  /api/projects/:projectId/stages/:stageId/overview
GET  /api/projects/:projectId/stages/:stageId/documents
POST /api/projects/:projectId/stages/:stageId/documents
GET  /api/projects/:projectId/stages/:stageId/discussions
POST /api/projects/:projectId/stages/:stageId/discussions
GET  /api/projects/:projectId/stages/:stageId/decisions
POST /api/projects/:projectId/stages/:stageId/decisions
GET  /api/projects/:projectId/stages/:stageId/handover
POST /api/projects/:projectId/stages/:stageId/handover
GET  /api/projects/:projectId/stages/:stageId/deliverables
POST /api/projects/:projectId/stages/:stageId/deliverables
POST /api/projects/:projectId/stages/:stageId/complete
```

## 10. Checklist cho team

Truoc khi bam chuyen stage, nguoi phu trach nen tu hoi:

- Stage tiep theo co du thong tin de bat dau ngay khong?
- Tai lieu bat buoc da du chua?
- Cac quyet dinh quan trong da co ly do chua?
- Cac van de chua giai quyet da duoc neu ro chua?
- De xuat cho team tiep theo co hanh dong cu the chua?
