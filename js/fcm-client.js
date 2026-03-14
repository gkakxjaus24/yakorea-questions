/**
 * Firebase Cloud Messaging 연동 및 알림 권한 관리 유틸리티
 */

const FCMManager = {
  // FCM 설정 (자동 획득된 설정값 반영)
  config: {
    apiKey: "AIzaSyDE17beY-krn9_5vSGK4CFWvizJNvMHmFA",
    authDomain: "chat-system-7527c.firebaseapp.com",
    projectId: "chat-system-7527c",
    storageBucket: "chat-system-7527c.firebasestorage.app",
    messagingSenderId: "43785958676",
    appId: "1:43785958676:web:4e377444cf9b7c574e7e01"
  },

  async init() {
    try {
      // Firebase 초기화 로직 (SDK 로드 후 호출)
      if (typeof firebase === 'undefined') {
        console.error('Firebase SDK가 로드되지 않았습니다.');
        return;
      }
      
      firebase.initializeApp(this.config);
      const messaging = firebase.messaging();

      // 권한 요청 및 토큰 획득
      await this.requestPermission(messaging);

      // 포그라운드 메시지 수신 처리
      messaging.onMessage((payload) => {
        console.log('메시지 수신 (포그라운드):', payload);
        alert(`${payload.notification.title}\n${payload.notification.body}`);
      });

    } catch (error) {
      console.error('FCM 초기화 에러:', error);
    }
  },

  async requestPermission(messaging) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('알림 권한 허용됨');
        
        // FCM 토큰 획득
        const token = await messaging.getToken({
          vapidKey: 'BN9Es8CxiM67_EK_v-HKq8ljoQdQwJzUpkpeABhzTTgz_JPMUOwnaXlXmgATd_caH5j632dyY_nCWV3wt_fMnHs' 
        });

        if (token) {
          console.log('FCM 토큰:', token);
          // TODO: 서버로 토큰 전송 로직 추가
          // this.sendTokenToServer(token);
        } else {
          console.log('토큰을 생성할 수 없습니다. 권한을 확인하세요.');
        }
      } else {
        console.log('알림 권한 거부됨');
      }
    } catch (error) {
      console.error('권한 요청 에러:', error);
    }
  }
};

// 페이지 로드 시 초기화 시도
window.addEventListener('load', () => FCMManager.init());
