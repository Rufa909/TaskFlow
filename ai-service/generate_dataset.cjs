const fs = require("fs");
const path = require("path");

const intents = {
  deadline_help: [
    "Tôi bị trễ deadline",
    "Deadline sắp tới rồi phải làm sao",
    "Task sắp hết hạn",
    "Làm sao để không bị trễ deadline",
    "Tôi quên deadline rồi",
    "Có cách nào nhắc deadline không",
    "Task nào cần làm gấp nhất",
    "Hạn chót đang đến gần",
    "Ưu tiên task nào trước theo deadline",
    "Sắp xếp task theo hạn chót",
    "Dl gần quá xử lý sao",
    "Tôi bị dí deadline",
    "Có task nào quá hạn không",
    "Deadline hôm nay cần làm gì trước",
    "Việc nào sắp tới hạn",
    "Cảnh báo deadline giúp tôi",
    "Nhắc tôi việc gần deadline",
    "Hạn nộp task là khi nào",
    "Task nào due sớm nhất",
    "Tôi sợ miss deadline",
  ],
  task_breakdown: [
    "Làm sao chia task",
    "Hãy giúp tôi chia nhỏ project",
    "Chia project thành các phần nhỏ",
    "Tôi muốn tách task lớn thành task nhỏ",
    "Cách chia công việc hợp lý",
    "Project quá lớn phải chia thế nào",
    "Tách task con từ task chính",
    "Phân chia công việc trong dự án",
    "Làm sao để quản lý project lớn",
    "Cách tạo subtask",
    "Breakdown dự án này giúp tôi",
    "Chia việc cho dễ làm",
    "Tôi muốn lập các bước cho dự án",
    "Task này nên chia ra sao",
    "Gợi ý các đầu việc nhỏ",
    "Tách công việc thành từng bước",
    "Chia campaign marketing thành task",
    "Lập checklist cho project",
    "Tôi cần chia nhỏ mục tiêu",
    "Biến ý tưởng thành task cụ thể",
  ],
  productivity_help: [
    "Tôi có quá nhiều việc",
    "Làm sao để tăng năng suất",
    "Tôi bị quá tải công việc",
    "Không biết nên làm gì trước",
    "Cách sắp xếp công việc hiệu quả",
    "Tôi muốn làm việc năng suất hơn",
    "Quá nhiều task không biết bắt đầu từ đâu",
    "Làm thế nào để hoàn thành nhiều task hơn",
    "Tôi cần gợi ý về độ ưu tiên",
    "Task nào nên ưu tiên làm trước",
    "Giúp tôi tập trung hơn",
    "Tôi bị mất tập trung",
    "Cách làm việc hiệu quả trong ngày",
    "Sắp xếp việc hôm nay giúp tôi",
    "Tôi nên xử lý việc nào trước",
    "Ưu tiên công việc kiểu gì",
    "Tôi cần quản lý thời gian",
    "Cách giảm quá tải task",
    "Làm sao để không bị ngợp việc",
    "Tôi muốn lập kế hoạch làm việc",
  ],
  add_task_help: [
    "Làm sao tạo task mới",
    "Tạo task ở đâu",
    "Cách thêm task mới vào danh sách",
    "Tôi muốn thêm một công việc mới",
    "Thêm task như thế nào",
    "Hướng dẫn tạo task",
    "Nút tạo task ở chỗ nào",
    "Tôi muốn tạo công việc mới",
    "Làm cách nào để add task",
    "Tạo task nhanh bằng cách nào",
    "Add việc mới giúp tôi",
    "Tạo todo mới ở đâu",
    "Muốn thêm nhiệm vụ thì bấm đâu",
    "Cách nhập task mới",
    "Tôi cần tạo đầu việc",
    "Thêm công việc vào project",
    "Tạo task cho chiến dịch marketing",
    "Hướng dẫn thêm việc",
    "Làm sao để tạo nhiệm vụ",
    "Có thể add task nhanh không",
  ],
  delete_task_help: [
    "Cách xóa task như thế nào",
    "Xóa task bị sai",
    "Tôi muốn xóa một task",
    "Làm sao để xóa công việc",
    "Bỏ task không cần nữa",
    "Nút xóa task ở đâu",
    "Hướng dẫn xóa task",
    "Xóa task đã hoàn thành",
    "Cách loại bỏ task khỏi danh sách",
    "Tôi muốn remove task",
    "Delete task kiểu gì",
    "Xóa việc này giúp tôi",
    "Muốn bỏ nhiệm vụ thì làm sao",
    "Task tạo nhầm xóa ở đâu",
    "Cách xóa công việc cũ",
    "Làm sao bỏ việc không cần làm",
    "Có xóa được task không",
    "Xóa đầu việc sai",
    "Remove công việc khỏi project",
    "Tôi không cần task này nữa",
  ],
  view_upcoming: [
    "Làm sao xem các task sắp tới",
    "Xem task ngày mai",
    "Task nào sắp đến hạn",
    "Xem lịch trình công việc tuần này",
    "Các task trong tuần tới",
    "Hiển thị các task sắp tới",
    "Tôi muốn xem công việc sắp tới",
    "Có task nào hôm nay không",
    "Lịch công việc của tôi",
    "Xem task hôm nay",
    "Xem việc tuần này ở đâu",
    "Task ngày hôm nay là gì",
    "Việc nào cần làm ngày mai",
    "Danh sách task sắp tới",
    "Mở tab upcoming ở đâu",
    "Xem lịch deadline",
    "Xem kế hoạch công việc",
    "Tôi muốn xem todo hôm nay",
    "Có việc gì sắp đến hạn không",
    "Xem timeline công việc",
  ],
  label_help: [
    "Cách dùng nhãn label",
    "Thêm nhãn màu sắc",
    "Làm sao gắn label cho task",
    "Tạo nhãn mới như thế nào",
    "Tôi muốn phân loại task bằng nhãn",
    "Cách tạo label mới",
    "Sử dụng nhãn để phân loại công việc",
    "Thêm tag cho task",
    "Đổi màu nhãn như thế nào",
    "Hướng dẫn dùng label",
    "Gắn tag marketing cho task",
    "Label dùng để làm gì",
    "Tạo nhãn cho campaign",
    "Phân nhóm task bằng label",
    "Cách lọc task theo nhãn",
    "Tôi muốn đổi label của task",
    "Thêm tag màu vào công việc",
    "Quản lý nhãn thế nào",
    "Tạo nhãn ưu tiên cao",
    "Gắn category cho task",
  ],
  marketing_help: [
    "Chiến lược marketing hiệu quả",
    "Làm sao để tăng khách hàng",
    "Làm thế nào quảng cáo sản phẩm",
    "Tôi muốn phát triển thương hiệu",
    "Cách tạo chiến dịch marketing",
    "Làm sao để marketing hiệu quả",
    "Hướng dẫn bán hàng online",
    "Tôi cần lên kế hoạch marketing",
    "Làm sao đạt được khách hàng tiềm năng",
    "Cách phát triển kinh doanh",
    "Làm sao tối ưu hóa chiến dịch quảng cáo",
    "Tôi muốn tăng doanh số bán hàng",
    "Chiến lược SEO và marketing trực tuyến",
    "Cách xây dựng mối quan hệ khách hàng",
    "Hạn chế chi phí marketing nhưng tăng hiệu quả",
    "Làm thế nào để phân tích thị trường",
    "Tôi muốn học marketing digital",
    "Cách tạo nội dung marketing hấp dẫn",
    "Làm sao quản lý chiến dịch marketing",
    "Tôi cần tư vấn marketing cho doanh nghiệp",
    "Gợi ý content Facebook",
    "Lên kế hoạch chạy ads",
    "Cách tăng tương tác fanpage",
    "Phân tích khách hàng mục tiêu",
    "Ý tưởng campaign ra mắt sản phẩm",
    "Tạo lịch đăng bài marketing",
    "Cách đo hiệu quả chiến dịch",
    "Tư vấn phễu marketing",
    "Cách chăm sóc lead",
    "Tối ưu nội dung quảng cáo",
  ],
  out_of_scope: [
    "Xin chào",
    "Hello",
    "Haha",
    "Ok",
    "Hmm",
    "Tôi tên là Nam",
    "Hôm nay trời đẹp quá",
    "Bạn có khỏe không",
    "Tôi thích ăn phở",
    "Asdfghjkl",
    "Chào bạn",
    "Test thử",
    "Cảm ơn bạn",
    "Tạm biệt",
    "Hôm nay mấy giờ rồi",
    "Bạn là ai",
    "Giúp tôi nấu ăn",
    "Thời tiết hôm nay thế nào",
    "Kể chuyện cười đi",
    "Viết thơ tình cho tôi",
    "Giải bài toán này",
    "Dịch câu này sang tiếng Anh",
    "Tư vấn mua điện thoại",
    "Giá vàng hôm nay",
    "Tin tức bóng đá",
    "Tôi bị đau đầu uống thuốc gì",
    "Chơi game gì vui",
    "Mở nhạc giúp tôi",
    "Lập trình React như thế nào",
    "Viết code Python tính tổng",
    "Tạo ảnh con mèo",
    "Ai là tổng thống Mỹ",
    "Đổi tiền đô sang tiền Việt",
    "Kể chuyện ma",
    "Tôi buồn quá",
    "Bài hát này tên gì",
    "Nấu cơm bao lâu",
    "Tìm nhà hàng gần đây",
    "Dự báo thời tiết ngày mai",
    "Hỏi đáp linh tinh",
  ],
};

const prefixes = [
  "",
  "Bạn ơi ",
  "Cho tôi hỏi ",
  "Giúp tôi ",
  "Mình muốn biết ",
  "Tư vấn ",
  "Hướng dẫn ",
  "Ad ơi ",
];

const suffixes = [
  "",
  " được không",
  " với",
  " nha",
  " nhé",
  " pls",
  " đi",
  " trong app này",
];

const replacements = [
  [/không/gi, "ko"],
  [/không/gi, "k"],
  [/được/gi, "dc"],
  [/với/gi, "vs"],
  [/tôi/gi, "t"],
  [/mình/gi, "mk"],
  [/bạn/gi, "b"],
  [/deadline/gi, "dl"],
  [/marketing/gi, "mkt"],
  [/project/gi, "pj"],
  [/task/gi, "tsk"],
  [/công việc/gi, "cv"],
];

function stripVietnamese(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function makeTypo(text) {
  return text
    .replace(/thế nào/gi, "tn")
    .replace(/làm sao/gi, "lm sao")
    .replace(/hướng dẫn/gi, "hd")
    .replace(/chiến dịch/gi, "chien dich")
    .replace(/quảng cáo/gi, "qc")
    .replace(/khách hàng/gi, "kh");
}

function variants(text) {
  const results = new Set();
  results.add(text);
  results.add(text.toLowerCase());
  results.add(stripVietnamese(text));
  results.add(stripVietnamese(text).toLowerCase());
  results.add(makeTypo(text));

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text)) {
      results.add(text.replace(pattern, replacement));
      results.add(stripVietnamese(text.replace(pattern, replacement)).toLowerCase());
    }
  }

  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      if (!prefix && !suffix) continue;
      results.add(`${prefix}${text}${suffix}`.trim());
    }
  }

  return [...results]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const dataset = [];
const seen = new Set();

for (const [intent, examples] of Object.entries(intents)) {
  for (const example of examples) {
    for (const text of variants(example)) {
      const key = `${intent}:${text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dataset.push({ text, intent });
    }
  }
}

const outputPath = path.join(__dirname, "dataset.json");
fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2) + "\n", "utf8");

const counts = dataset.reduce((acc, item) => {
  acc[item.intent] = (acc[item.intent] || 0) + 1;
  return acc;
}, {});

console.log(`Generated ${dataset.length} training examples`);
console.table(counts);
