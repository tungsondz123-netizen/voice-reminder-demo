# Voice Reminder Notes Demo

Web demo cho app ghi chú nhanh bằng giọng nói, thiết kế để thử ý tưởng trên điện thoại trước khi chuyển sang app iPhone native.

## Có gì trong repo

- `index.html`: demo desktop/web ban đầu
- `phone-test.html`: trang test microphone và thu âm trực tiếp trên điện thoại
- `phone-app.html`: app demo tối ưu cho điện thoại, có ghi âm, playback, transcript thủ công và reminder parser
- `src/modules/`: các module tách riêng cho ghi âm, storage, parser reminder và notification

## Tính năng chính

- Ghi âm trực tiếp trong trình duyệt
- Phát lại audio vừa ghi
- Lưu note cục bộ trên thiết bị
- Phân tích các câu như `mai 8 giờ gọi khách`
- Tạo reminder cục bộ trong web demo
- Giao diện riêng để test trên điện thoại

## Chạy local trên Windows

Mở PowerShell trong thư mục project rồi chạy:

```powershell
cd "C:\Users\Admin\Desktop\App điện thoại"
.\start-demo.ps1
```

Nếu bị chặn execution policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-demo.ps1
```

Sau đó mở:

- `http://localhost:8080/index.html`
- `http://localhost:8080/phone-test.html`
- `http://localhost:8080/phone-app.html`

## Test trên điện thoại

Để microphone hoạt động trên iPhone, trang web phải chạy bằng `HTTPS`.

Luồng nên dùng:

1. Đưa repo này lên GitHub.
2. Deploy repo lên Vercel, Netlify hoặc GitHub Pages có HTTPS.
3. Mở `phone-app.html` bằng Safari trên iPhone.

Trang nên test chính:

- `phone-app.html`

Trang test mic riêng nếu cần:

- `phone-test.html`

## Ghi chú kỹ thuật

- Web demo trên iPhone phù hợp để test `ghi âm`, `UI`, `luồng note`, `playback` và `reminder parser`.
- `Speech-to-text` trên web mobile không ổn định bằng app native iOS.
- Nếu muốn dùng thật lâu dài trên iPhone, bước tiếp theo hợp lý là chuyển sang `SwiftUI` trên macOS.

## Cấu trúc thư mục

```text
.
|-- index.html
|-- phone-app.html
|-- phone-test.html
|-- start-demo.ps1
|-- styles.css
`-- src
    |-- app.js
    |-- phone-app.js
    |-- phone-test.js
    `-- modules
```

## Đưa lên GitHub

Nếu chưa có Git trên máy:

- Tạo repo mới trên GitHub
- Chọn `Upload files`
- Kéo toàn bộ file trong thư mục này lên

Nếu có Git:

```bash
git init
git add .
git commit -m "Initial voice reminder demo"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
