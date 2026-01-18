# Abstract Analysis Tool (Public)

## 📖 프로젝트 소개 (Project Overview)
**Abstract Analysis Tool**은 연구자들이 학술 논문의 초록(Abstract)을 효율적으로 관리하고 분석할 수 있도록 돕는 웹 기반 플랫폼입니다.
Google의 최신 Gemini AI 모델을 활용하여 초록을 분석하고, 드래그 앤 드롭으로 논문을 정리하며, 세부적인 태깅 작업을 수행할 수 있습니다.

### ✨ 주요 기능 (Key Features)
- **AI 기반 분석**: Google Gemini 모델을 연동하여 초록의 내용을 자동으로 요약하고 구조를 분석합니다.
- **논문 관리**: 논문을 카드 형태로 시각화하고, `dnd-kit`을 활용한 드래그 앤 드롭으로 우선순위를 정리할 수 있습니다.
- **태깅 및 하이라이트**: 텍스트의 특정 부분을 선택하여 주석(Annotation)을 달고 태그로 분류할 수 있습니다.
- **안전한 사용자 관리**: Firebase Authentication을 통한 이메일 로그인 및 회원가입을 지원합니다.
- **실시간 데이터 동기화**: Firestore를 사용하여 모든 데이터가 실시간으로 저장되고 동기화됩니다.

---

## 🛠 사전 준비 사항 (Prerequisites)
이 프로젝트를 실행하기 위해서는 다음 서비스들의 설정이 필요합니다.

1. **Google Gemini API Key**: [Google AI Studio](https://aistudio.google.com/)에서 API 키를 발급받아야 합니다.
2. **Firebase 프로젝트**: 사용자 인증 및 데이터 저장을 위해 개인 Firebase 프로젝트가 필요합니다.

---

## 🔥 Firebase 설정 가이드 (Firebase Setup)
이 프로젝트는 백엔드로 **Firebase**를 사용합니다. 실행 전에 반드시 본인의 Firebase 프로젝트를 생성하고 연결해야 합니다.

### 1단계: 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com/)에 접속하여 `프로젝트 추가`를 클릭합니다.
2. 프로젝트 이름을 입력하고 생성 단계를 완료합니다.

### 2단계: 웹 앱 추가 및 설정 확인
1. 프로젝트 개요 페이지에서 웹 아이콘(`</>`)을 클릭하여 앱을 등록합니다.
2. 등록 후 나타나는 `firebaseConfig` 객체 내용을 복사하거나 별도로 저장해 둡니다. 이 정보는 나중에 `setup.json`에 입력해야 합니다.
   ```javascript
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     ...
   };
   ```

### 3단계: 인증(Authentication) 설정
1. 왼쪽 메뉴에서 **Build(빌드) > Authentication**으로 이동합니다.
2. **Get started(시작하기)**를 클릭합니다.
3. **Sign-in method(로그인 방법)** 탭에서 **이메일/비밀번호**를 선택하고 **사용 설정(Enable)**을 켭니다.

### 4단계: Firestore Database 설정
1. 왼쪽 메뉴에서 **Build(빌드) > Firestore Database**로 이동합니다.
2. **데이터베이스 만들기**를 클릭합니다.
3. 위치를 선택하고 생성을 완료합니다.
4. **규칙(Rules)** 탭으로 이동하여, 프로젝트에 포함된 `firestore.rules` 파일의 내용을 복사하여 붙여넣고 게시합니다.
   - *참고: 기본 규칙은 인증된 사용자에게 읽기/쓰기 권한을 부여합니다.*

---

## 👥 사용자 권한 및 관리자 설정 (User Roles & Admin Setup)
이 프로젝트는 **일반 사용자(User)**와 **관리자(Admin)** 두 가지 역할을 지원합니다.

### 1. 일반 사용자 (User)
- `/signup` 페이지를 통해 회원가입한 모든 계정은 기본적으로 `User` 권한을 가집니다.
- 본인의 데이터를 생성, 조회, 수정, 삭제할 수 있습니다.

### 2. 관리자 (Admin)
관리자는 전체 사용자 통계와 데이터를 조회할 수 있는 **Admin Dashboard**에 접근할 수 있습니다.
현재 코드에는 관리자 이메일이 하드코딩되어 있으므로, 본인의 이메일로 변경해야 합니다.

**관리자 권한 설정 방법:**
1. `firestore.rules` 파일을 열고 아래 부분을 본인의 관리자 이메일로 변경합니다.
   ```javascript
   function isAdmin() {
     return request.auth != null && request.auth.token.email == 'YOUR_ADMIN_EMAIL@example.com';
   }
   ```
2. `app/page.tsx` (또는 관련 컴포넌트)에서 관리자 버튼 표시 조건을 찾아 변경합니다.
   ```tsx
   {user.email === "YOUR_ADMIN_EMAIL@example.com" && (
     <Button ... >Admin Dashboard</Button>
   )}
   ```
3. 변경 후 Firebase Console에서 Firestore 규칙을 다시 게시하고, 애플리케이션을 재실행합니다.

---

## 🚀 설치 및 실행 방법 (Installation)

### 1. 프로젝트 설정 (Configuration)
프로젝트 루트 디렉토리에 있는 `setup.json` 파일을 열고, 위에서 준비한 정보들을 입력합니다.

```json
{
  "api_keys": {
    "google_generative_ai_api_key": "여기에_GEMINI_API_KEY_입력"
  },
  "firebase": {
    "apiKey": "여기에_FIREBASE_API_KEY",
    "authDomain": "PROJECT_ID.firebaseapp.com",
    "projectId": "PROJECT_ID",
    "storageBucket": "PROJECT_ID.firebasestorage.app",
    "messagingSenderId": "...",
    "appId": "...",
    "measurementId": "..."
  }
}
```

### 2. 환경 변수 생성
설정 파일을 기반으로 `.env.local` 파일을 자동으로 생성하는 스크립트를 실행합니다.
```bash
node scripts/setup.js
```

### 3. 패키지 설치 및 실행
```bash
# 의존성 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 확인합니다.
