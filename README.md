# 벽깨자 러너 관리 시스템

온라인 운영을 전제로 만든 React/Vite 기반 러닝 크루 관리 웹서비스입니다. Vercel 배포와 Supabase 연결을 기준으로 구성되어 있으며, 첫 화면에는 훈련 일정이 공개로 보이고 러너 등록/참석 기록이 필요할 때 Google 로그인을 사용합니다.

## 주요 기능

- Google 계정 로그인
- 비로그인 사용자도 훈련 일정과 대회 일정을 확인 가능
- 훈련 참석 버튼과 러너 등록에서 Google 로그인 사용
- 관리자만 러너 등록, 수정, 삭제 가능
- 일반 멤버는 자기 Google 이메일과 연결된 러너 정보만 확인
- Google 계정 이메일 1개당 러너 1명만 등록
- 훈련 일정 등록과 참석 버튼
- 10km, 하프, 풀코스 기록 관리
- 목표 대회, 목표 기록, 부상 여부 관리
- 화요일/목요일 출석 체크
- 월간 출석률 표시
- 대회명, 날짜, 장소 중심의 대회 일정 관리
- 러너 데이터, 출석 데이터, 대회 데이터 테이블 분리

## 파일 구조

```txt
src/
  App.jsx
  main.jsx
  styles.css
  lib/
    supabase.js
supabase/
  schema.sql
.env.example
```

## 1. Supabase 프로젝트 만들기

1. [Supabase](https://supabase.com)에 가입합니다.
2. 새 프로젝트를 만듭니다.
3. 왼쪽 메뉴에서 **SQL Editor**를 엽니다.
4. `supabase/schema.sql` 파일 내용을 복사해서 실행합니다.

이 SQL은 아래 테이블을 만듭니다.

- `runners`: 러너 기본 정보와 기록
- `attendances`: 화/목 출석 기록
- `races`: 대회 일정
- `training_schedules`: 훈련 일정
- `training_participants`: 훈련 참석 신청
- `admins`: 관리자 이메일

## 2. 관리자 이메일 설정

`supabase/schema.sql` 안에는 기본 예시로 `admin@example.com`이 들어 있습니다. SQL을 실행하기 전에 이 값을 실제 관리자 Google 이메일로 바꾸는 것이 가장 쉽습니다.

이미 SQL을 실행했다면 Supabase SQL Editor에서 아래처럼 추가할 수 있습니다.

```sql
insert into public.admins (email)
values ('admin@example.com')
on conflict (email) do nothing;
```

관리자가 여러 명이면 이메일마다 한 번씩 추가하면 됩니다.

```sql
insert into public.admins (email)
values ('coach@example.com')
on conflict (email) do nothing;
```

## 3. Google 로그인 설정

1. Supabase 왼쪽 메뉴에서 **Authentication**을 엽니다.
2. **Providers** 메뉴로 이동합니다.
3. **Google**을 켭니다.
4. Google Cloud Console에서 OAuth Client ID와 Client Secret을 만든 뒤 Supabase에 입력합니다.
5. Google Cloud Console의 승인된 리디렉션 URI에 Supabase에서 안내하는 callback URL을 추가합니다.

보통 Supabase Google Provider 화면에 아래 형태의 callback URL이 표시됩니다.

```txt
https://your-project-id.supabase.co/auth/v1/callback
```

## 4. 환경 변수 설정

`.env.example`을 참고해서 로컬에는 `.env` 파일을 만듭니다.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ADMIN_EMAILS=admin@example.com
```

값을 찾는 위치:

1. Supabase 프로젝트에서 **Project Settings**를 엽니다.
2. **API** 메뉴로 이동합니다.
3. Project URL을 `VITE_SUPABASE_URL`에 넣습니다.
4. anon public key를 `VITE_SUPABASE_ANON_KEY`에 넣습니다.

`VITE_ADMIN_EMAILS`는 화면에서 관리자 UI를 보여줄 이메일 목록입니다. Supabase의 `admins` 테이블에 들어간 이메일과 같아야 합니다.

## 5. 러너 등록 방식

러너는 Google 계정 이메일 기준으로 등록합니다.

예를 들어 멤버가 `runner@gmail.com`으로 로그인한다면, 그 계정으로 러너 등록을 해야 자기 정보를 볼 수 있습니다. 관리자는 관리자 화면에서 대신 등록하거나 수정할 수도 있습니다.

같은 Google 이메일로 러너를 여러 명 등록할 수 없습니다. `runners.email`에는 중복 방지 설정이 들어 있으며, 앱 화면에서도 중복 이메일 저장을 막습니다.

## 훈련 일정 운영 방식

- 첫 화면 맨 위에 훈련 일정이 표시됩니다.
- 비로그인 사용자도 훈련 일정은 볼 수 있습니다.
- 참석 버튼을 누르면 Google 로그인 후 참석이 기록됩니다.
- 관리자는 훈련명, 날짜, 시간, 장소, 메모를 등록/수정/삭제할 수 있습니다.
- 참석 기록은 `training_participants` 테이블에 저장됩니다.

## 6. Vercel 배포 방법

1. 이 프로젝트를 GitHub 저장소에 올립니다.
2. [Vercel](https://vercel.com)에 로그인합니다.
3. **Add New Project**를 선택합니다.
4. GitHub 저장소를 연결합니다.
5. Framework Preset은 Vite로 자동 인식됩니다.
6. Vercel 프로젝트 설정의 **Environment Variables**에 아래 값을 추가합니다.

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_ADMIN_EMAILS
```

7. 배포 후 생성된 Vercel 도메인을 Supabase에 등록합니다.

Supabase에서:

1. **Authentication**으로 이동합니다.
2. **URL Configuration**을 엽니다.
3. Site URL에 Vercel 주소를 넣습니다.
4. Redirect URLs에도 Vercel 주소를 추가합니다.

예시:

```txt
https://your-service.vercel.app
```

## GitHub에 올리는 방법

프로젝트 폴더:

```txt
C:\Users\rdrag\Documents\Codex\2026-05-05\1-react-vite-2-vercel-3
```

GitHub Desktop을 쓰는 경우:

1. GitHub Desktop을 엽니다.
2. **File > Add Local Repository**를 선택합니다.
3. 위 프로젝트 폴더를 선택합니다.
4. 저장소가 아니라고 나오면 **create a repository**를 선택합니다.
5. Repository name은 예를 들어 `byeokgaeja-runner-admin`으로 입력합니다.
6. 첫 커밋 메시지를 입력하고 **Commit to main**을 누릅니다.
7. **Publish repository**를 누릅니다.
8. **Keep this code private**는 원하는 공개 범위에 맞게 선택합니다.

PowerShell에서 하는 경우:

```powershell
cd C:\Users\rdrag\Documents\Codex\2026-05-05\1-react-vite-2-vercel-3
git init
git add .
git commit -m "Initial runner management system"
git branch -M main
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

`.env` 파일은 GitHub에 올라가면 안 됩니다. 이 프로젝트에는 `.gitignore`가 준비되어 있어서 `.env`, `node_modules`, `dist`는 제외됩니다.

## 7. 운영 전 체크리스트

- Supabase 테이블이 생성되었는지 확인
- Google Provider가 켜져 있는지 확인
- Supabase `admins` 테이블에 관리자 이메일이 들어갔는지 확인
- `.env` 또는 Vercel Environment Variables에 같은 관리자 이메일이 들어갔는지 확인
- 관리자는 로그인 후 훈련 일정을 먼저 등록
- 일반 멤버는 참석 버튼이나 러너 등록 버튼을 누를 때 Google 로그인

## 참고

이 프로젝트는 클라이언트 앱에서 관리자 화면을 숨기고, Supabase Row Level Security로 데이터 접근을 제한하는 구조입니다. 운영에서는 Supabase 정책이 실제 보안의 핵심이므로 `supabase/schema.sql`을 반드시 적용해야 합니다.
