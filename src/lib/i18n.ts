export const languageNames = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ms: "Bahasa Melayu",
};
export type Locale = keyof typeof languageNames;
const en = {
  badge: "YOUR WORDS, A LITTLE CLEARER",
  heading: "How was your visit?",
  intro:
    "Tell us what you experienced. We’ll help with the wording, while you stay in control.",
  interface: "Page language",
  output: "Write my draft in",
  destination: "Where would you like to share?",
  google: "Google Reviews",
  xiaohongshu: "Xiaohongshu",
  experience: "Your experience",
  placeholder: "What did you try? What went well, or could have been better?",
  hint: "A few honest details are enough. Positive, mixed and negative experiences are equally welcome.",
  photos: "Add a photo preview",
  optional: "Optional",
  photoHint:
    "Photos stay on this device. Add the originals yourself in Google or Xiaohongshu.",
  remove: "Remove",
  consent:
    "Use AI to help with my wording. I agree to send my text and selected answers to the AI provider.",
  generate: "Help me write",
  generating: "Working on your wording…",
  manual: "Use my own words",
  step: "Your draft",
  editHint: "Check every detail. Change anything that doesn’t sound like you.",
  title: "Title",
  body: "Review",
  confirm:
    "I have checked this version and it accurately reflects my own experience.",
  copy: "Copy review",
  copyTitle: "Copy title",
  copied: "Copied",
  copyFailed: "Copy was blocked. Select the text above and copy it manually.",
  open: "Open Google Reviews",
  noLink:
    "A Google review link is not available for this location. You can still copy your draft.",
  xhsHelp:
    "Copy your title and review, open Xiaohongshu yourself, and add your original photos. Review everything there before posting.",
  regenerate: "Try another version",
  finish: "Finish & clear",
  finished: "Your draft and photo previews have been cleared.",
  privacy:
    "No name, phone number or platform login required. Nothing is posted automatically.",
  demo: "Local demo: no AI call or translation. Your selected details and original wording are shown without AI rewriting.",
  local: "FICTIONAL BUSINESS · LOCAL PROTOTYPE",
  more: "Please add at least a few details about your experience.",
  photoError:
    "Choose up to 4 JPEG, PNG or WebP images, each under 5 MB. HEIC originals can be added in the destination app.",
  sample: "Try a sample",
  sampleText:
    "The noodles were tasty and the staff were friendly. We waited about 20 minutes for our food.",
  draftNotice:
    "You decide what to share. Copying or opening a platform does not publish a review.",
  back: "Back to local demo",
  count: "characters",
  clear: "Clear",
  aiUnavailable: "AI is unavailable. You can still use your own wording.",
  quota:
    "This business has reached its AI allowance. You can still write and share manually.",
  limit:
    "You have reached the generation limit. Please use or edit your current wording.",
  busy: "A request is already running. Please wait before trying again.",
  expired: "The session expired. Refresh the page to start again.",
  subscription:
    "AI assistance is paused for this business. Manual writing remains available.",
  retry:
    "The request did not finish. Your text is still here. Try again or use your own words.",
  serverClearUnconfirmed:
    "This device has been cleared. Server cleanup could not be confirmed; the session expires automatically.",
  privacyLink: "Privacy information",
  rateLimited:
    "AI requests are temporarily limited here. You can still write and share manually.",
};
type Copy = typeof en;
const cn: Copy = {
  badge: "保留你的真实感受",
  heading: "这次体验怎么样？",
  intro: "分享你的真实经历。我们帮你整理文字，内容由你决定。",
  interface: "页面语言",
  output: "评价语言",
  destination: "你想分享到哪里？",
  google: "Google 评价",
  xiaohongshu: "小红书",
  experience: "你的体验",
  placeholder: "你尝试了什么？哪些地方满意，哪些可以改善？",
  hint: "简单写下真实细节即可。欢迎正面、负面及不同感受。",
  photos: "预览照片",
  optional: "可选",
  photoHint: "照片只保留在此设备。请在 Google 或小红书自行选择原图。",
  remove: "移除",
  consent: "使用 AI 帮助整理文字。我同意将文字和所选答案发送给 AI 服务商。",
  generate: "帮我整理文字",
  generating: "正在整理文字…",
  manual: "使用我自己的文字",
  step: "你的草稿",
  editHint: "请检查每个细节，并修改不符合你感受的内容。",
  title: "标题",
  body: "评价内容",
  confirm: "我已检查此版本，内容准确反映我的真实经历。",
  copy: "复制评价",
  copyTitle: "复制标题",
  copied: "已复制",
  copyFailed: "无法自动复制，请选择上方文字并手动复制。",
  open: "打开 Google 评价",
  noLink: "此门店暂未提供 Google 评价链接。你仍然可以复制草稿。",
  xhsHelp: "复制标题与内容后，自行打开小红书并添加原图。发布前请再次检查。",
  regenerate: "换一个版本",
  finish: "完成并清除",
  finished: "已清除草稿和照片预览。",
  privacy: "无需姓名、电话号码或平台登录。不会自动发布任何内容。",
  demo: "本地演示：不会调用 AI 或翻译。所选详情和原文将直接显示，不经过 AI 改写。",
  local: "虚构商家 · 本地原型",
  more: "请补充一些真实体验细节。",
  photoError:
    "最多选择 4 张 JPEG、PNG 或 WebP 图片，每张小于 5 MB。HEIC 原图可在目标平台添加。",
  sample: "试用示例",
  sampleText: "面条很好吃，员工也很友善。不过我们等了大约20分钟才上菜。",
  draftNotice: "分享什么由你决定。复制文字或打开平台不会发布评价。",
  back: "返回本地演示",
  count: "字符",
  clear: "清除",
  aiUnavailable: "AI 暂时无法使用。你仍可使用自己的文字。",
  quota: "此商家的 AI 次数已用完。你仍可手动撰写和分享。",
  limit: "已达到生成次数上限。请使用或修改现有文字。",
  busy: "请求正在处理中，请稍候。",
  expired: "会话已过期，请刷新页面重新开始。",
  subscription: "此商家的 AI 功能已暂停，仍可手动撰写。",
  retry: "请求未完成，你的文字仍然保留。请重试或使用自己的文字。",
  serverClearUnconfirmed: "已清除此设备上的内容，但暂时无法确认服务器端清除。会话会自动过期。",
  privacyLink: "隐私说明",
  rateLimited: "目前 AI 请求次数受限。你仍可自行撰写并分享。",
};
const tw: Copy = {
  badge: "保留你的真實感受",
  heading: "這次體驗怎麼樣？",
  intro: "分享你的真實經歷。我們幫你整理文字，內容由你決定。",
  interface: "頁面語言",
  output: "評價語言",
  destination: "你想分享到哪裡？",
  google: "Google 評價",
  xiaohongshu: "小紅書",
  experience: "你的體驗",
  placeholder: "你嘗試了什麼？哪些地方滿意，哪些可以改善？",
  hint: "簡單寫下真實細節即可。歡迎正面、負面及不同感受。",
  photos: "預覽照片",
  optional: "選填",
  photoHint: "照片只保留在此裝置。請在 Google 或小紅書自行選擇原圖。",
  remove: "移除",
  consent: "使用 AI 幫助整理文字。我同意將文字和所選答案傳送給 AI 服務商。",
  generate: "幫我整理文字",
  generating: "正在整理文字…",
  manual: "使用我自己的文字",
  step: "你的草稿",
  editHint: "請檢查每個細節，並修改不符合你感受的內容。",
  title: "標題",
  body: "評價內容",
  confirm: "我已檢查此版本，內容準確反映我的真實經歷。",
  copy: "複製評價",
  copyTitle: "複製標題",
  copied: "已複製",
  copyFailed: "無法自動複製，請選擇上方文字並手動複製。",
  open: "開啟 Google 評價",
  noLink: "此門店暫未提供 Google 評價連結。你仍然可以複製草稿。",
  xhsHelp: "複製標題與內容後，自行開啟小紅書並加入原圖。發布前請再次檢查。",
  regenerate: "換一個版本",
  finish: "完成並清除",
  finished: "已清除草稿和照片預覽。",
  privacy: "無需姓名、電話號碼或平台登入。不會自動發布任何內容。",
  demo: "本地演示：不會呼叫 AI 或翻譯。所選詳情和原文將直接顯示，不經過 AI 改寫。",
  local: "虛構商家 · 本地原型",
  more: "請補充一些真實體驗細節。",
  photoError:
    "最多選擇 4 張 JPEG、PNG 或 WebP 圖片，每張小於 5 MB。HEIC 原圖可在目標平台加入。",
  sample: "試用範例",
  sampleText: "麵條很好吃，員工也很友善。不過我們等了大約20分鐘才上菜。",
  draftNotice: "分享什麼由你決定。複製文字或開啟平台不會發布評價。",
  back: "返回本地演示",
  count: "字元",
  clear: "清除",
  aiUnavailable: "AI 暫時無法使用。你仍可使用自己的文字。",
  quota: "此商家的 AI 次數已用完。你仍可手動撰寫和分享。",
  limit: "已達到生成次數上限。請使用或修改現有文字。",
  busy: "請求正在處理中，請稍候。",
  expired: "工作階段已過期，請重新整理頁面。",
  subscription: "此商家的 AI 功能已暫停，仍可手動撰寫。",
  retry: "請求未完成，你的文字仍然保留。請重試或使用自己的文字。",
  serverClearUnconfirmed: "已清除此裝置上的內容，但暫時無法確認伺服器端清除。工作階段會自動到期。",
  privacyLink: "隱私說明",
  rateLimited: "目前 AI 請求次數受限。你仍可自行撰寫並分享。",
};
const ms: Copy = {
  badge: "PENGALAMAN ANDA, LEBIH JELAS",
  heading: "Bagaimana kunjungan anda?",
  intro:
    "Ceritakan pengalaman sebenar anda. Kami bantu menyusun ayat, anda yang tentukan isinya.",
  interface: "Bahasa halaman",
  output: "Bahasa draf",
  destination: "Di mana anda mahu berkongsi?",
  google: "Ulasan Google",
  xiaohongshu: "Xiaohongshu",
  experience: "Pengalaman anda",
  placeholder: "Apa yang anda cuba? Apa yang baik atau boleh diperbaiki?",
  hint: "Beberapa butiran jujur sudah memadai. Pengalaman positif, bercampur dan negatif dialu-alukan.",
  photos: "Pratonton foto",
  optional: "Pilihan",
  photoHint:
    "Foto kekal pada peranti ini. Pilih foto asal sendiri dalam Google atau Xiaohongshu.",
  remove: "Buang",
  consent:
    "Gunakan AI untuk membantu penulisan saya. Saya bersetuju menghantar teks dan jawapan pilihan saya kepada penyedia AI.",
  generate: "Bantu saya menulis",
  generating: "Sedang menyusun ayat…",
  manual: "Guna ayat sendiri",
  step: "Draf anda",
  editHint:
    "Semak setiap butiran. Ubah apa-apa yang tidak menggambarkan pengalaman anda.",
  title: "Tajuk",
  body: "Ulasan",
  confirm:
    "Saya telah menyemak versi ini dan ia menggambarkan pengalaman sebenar saya dengan tepat.",
  copy: "Salin ulasan",
  copyTitle: "Salin tajuk",
  copied: "Disalin",
  copyFailed: "Salinan disekat. Pilih teks di atas dan salin secara manual.",
  open: "Buka Ulasan Google",
  noLink:
    "Pautan ulasan Google belum tersedia untuk lokasi ini. Anda masih boleh menyalin draf.",
  xhsHelp:
    "Salin tajuk dan ulasan, buka Xiaohongshu sendiri dan pilih foto asal anda. Semak semuanya sebelum menyiarkan.",
  regenerate: "Cuba versi lain",
  finish: "Selesai & padam",
  finished: "Draf dan pratonton foto telah dipadam.",
  privacy:
    "Nama, nombor telefon dan log masuk platform tidak diperlukan. Tiada siaran automatik.",
  demo: "Demo tempatan: tiada panggilan AI atau terjemahan. Butiran pilihan dan ayat asal dipaparkan tanpa penulisan semula AI.",
  local: "PERNIAGAAN REKAAN · PROTOTAIP TEMPATAN",
  more: "Sila tambah beberapa butiran pengalaman sebenar anda.",
  photoError:
    "Pilih sehingga 4 foto JPEG, PNG atau WebP, setiap satu di bawah 5 MB. Foto HEIC asal boleh ditambah dalam aplikasi destinasi.",
  sample: "Cuba contoh",
  sampleText:
    "Mi sedap dan kakitangannya mesra. Namun, kami menunggu kira-kira 20 minit untuk makanan.",
  draftNotice:
    "Anda tentukan apa yang dikongsi. Menyalin atau membuka platform tidak menyiarkan ulasan.",
  back: "Kembali ke demo",
  count: "aksara",
  clear: "Padam",
  aiUnavailable:
    "AI tidak tersedia. Anda masih boleh menggunakan ayat sendiri.",
  quota:
    "Perniagaan ini telah mencapai had AI. Anda masih boleh menulis dan berkongsi secara manual.",
  limit:
    "Anda telah mencapai had penjanaan. Gunakan atau sunting ayat sedia ada.",
  busy: "Permintaan masih diproses. Sila tunggu.",
  expired: "Sesi tamat. Muat semula halaman untuk bermula semula.",
  subscription:
    "Bantuan AI dijeda untuk perniagaan ini. Penulisan manual masih tersedia.",
  retry:
    "Permintaan tidak selesai. Teks anda masih ada. Cuba lagi atau guna ayat sendiri.",
  serverClearUnconfirmed:
    "Kandungan telah dipadam pada peranti ini. Pemadaman pada pelayan belum dapat disahkan; sesi tamat secara automatik.",
  privacyLink: "Maklumat privasi",
  rateLimited:
    "Permintaan AI dihadkan buat sementara. Anda masih boleh menulis dan berkongsi sendiri.",
};
export const translations: Record<Locale, Copy> = {
  en,
  "zh-CN": cn,
  "zh-TW": tw,
  ms,
};
export function errorText(code: string, t: Copy) {
  if (["QUOTA_EXHAUSTED", "DAILY_LIMIT", "BUSINESS_DAILY_LIMIT"].includes(code)) return t.quota;
  if (["SESSION_RATE_LIMIT", "AI_RATE_LIMIT"].includes(code)) return t.rateLimited;
  if (code === "SESSION_LIMIT") return t.limit;
  if (["ALREADY_RUNNING", "BUSY"].includes(code)) return t.busy;
  if (code === "SESSION_EXPIRED") return t.expired;
  if (code === "SUBSCRIPTION_EXPIRED") return t.subscription;
  if (["MORE_DETAIL", "INVALID_INPUT"].includes(code)) return t.more;
  if (
    ["AI_UNAVAILABLE", "AI_NOT_CONFIGURED", "INVALID_AI_OUTPUT"].includes(code)
  )
    return t.aiUnavailable;
  return t.retry;
}
