# MLN111 Quiz

Ứng dụng ôn tập 598 câu hỏi Triết học Mác - Lênin, viết bằng HTML, CSS và JavaScript thuần.

## Chạy ứng dụng

Mở trực tiếp `index.html` bằng trình duyệt, hoặc chạy một static server bất kỳ trong thư mục dự án.

```powershell
npx serve .
```

## Cập nhật dữ liệu câu hỏi

Sau khi chỉnh sửa `MLN111_598_cau_nguyen_ban.txt`, chạy:

```powershell
node scripts/build-questions.mjs
```

Lệnh này sẽ tạo lại `questions.js` để ứng dụng có thể chạy ngay cả khi mở trực tiếp từ máy.
