// ============================================================
// Next.js 루트 레이아웃 (layout.js)
// ============================================================
// 모든 페이지에 공통으로 적용되는 최상위 레이아웃입니다.
// ============================================================

import './globals.css';

export const metadata = {
    title:       '야코리아 채팅 관리자',
    description: '야코리아 호스텔 채팅 관리자 페이지'
};

export default function RootLayout({ children }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    );
}
