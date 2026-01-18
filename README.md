# Abstract Analysis Tool

## Setup Instructions

1. **Configure Secrets**
   Open `setup.json` in the root directory and fill in your API keys and configuration:
   - `api_keys.google_generative_ai_api_key`: Your Google Gemini API Key.
   - `firebase`: Your Firebase project configuration objects.

2. **Initialize Environment**
   Run the setup script to generate the necessary `.env` files:
   ```bash
   node scripts/setup.js
   ```

3. **Install & Run**
   ```bash
   npm install
   npm run dev
   ```

---

## 설정 가이드 (Setup Guide)

1. **비밀 키 설정**
   루트 디렉토리의 `setup.json` 파일을 열고 API 키와 설정을 입력하세요:
   - `api_keys.google_generative_ai_api_key`: Google Gemini API 키.
   - `firebase`: Firebase 프로젝트 설정 정보.

2. **환경 초기화**
   다음 스크립트를 실행하여 필요한 `.env` 파일을 생성하세요:
   ```bash
   node scripts/setup.js
   ```

3. **설치 및 실행**
   ```bash
   npm install
   npm run dev
   ```
