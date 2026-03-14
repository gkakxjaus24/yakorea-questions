// 서비스 워커(Service Worker) 설정 파일
// 오프라인 상태에서도 앱이 기본적으로 동작할 수 있도록 캐싱을 관리합니다.

const CACHE_NAME = 'yakorea-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/common.css',
  '/js/config.js',
  '/js/i18n.js',
  '/js/app.js',
  '/js/index.js'
];

// 서비스 워커 설치 시 리소스 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('서비스 워커: 캐시 생성 및 리소스 저장');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 리소스 요청 시 캐시 우선 전략 (Offline First)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 캐시에 있으면 캐시 반환, 없으면 네트워크 요청
      return response || fetch(event.request);
    })
  );
});
