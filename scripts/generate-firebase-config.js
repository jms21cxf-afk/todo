const fs = require("fs");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error("다음 환경 변수가 설정되지 않았습니다:", missing.join(", "));
  process.exit(1);
}

const content = `export const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};\n`;
fs.writeFileSync("firebase.config.js", content, "utf8");
console.log("firebase.config.js 생성 완료");
