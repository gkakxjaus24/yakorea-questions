// Firebase Cloud Messaging 서비스 워커
// 이 파일은 브라우저가 백그라운드에 있을 때 푸시 메시지를 수신하는 역할을 합니다.

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase 초기화 (자동 획득된 설정값 반영)
const firebaseConfig = {
  apiKey: "AIzaSyDE17beY-krn9_5vSGK4CFWvizJNvMHmFA",
  authDomain: "chat-system-7527c.firebaseapp.com",
  projectId: "chat-system-7527c",
  storageBucket: "chat-system-7527c.firebasestorage.app",
  messagingSenderId: "43785958676",
  appId: "1:43785958676:web:4e377444cf9b7c574e7e01"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// 백그라운드 메시지 수신 처리
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/images/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
