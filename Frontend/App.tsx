import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// 만약 아래 문장에서 여전히 에러가 난다면 { AppNavigation } 처럼 중괄호를 붙여보세요.
import AppNavigation from "./src/navigation"; 

export default function App() {
  
  useEffect(() => {
    // [중요] 본인의 EC2 퍼블릭 IP 주소로 변경하세요.
    // 80번 포트로 아파치를 설치하셨다면 포트번호를 빼거나, 
    // 백엔드가 3000번 등 다른 포트에서 돌고 있다면 해당 포트를 적어주세요.
    const BACKEND_URL = 'http://43.203.240.192:3000'; 

    console.log("🚀 백엔드 연결 시도 중...");

    fetch(`${BACKEND_URL}/health`)
      .then((response) => response.json())
      .then((data) => {
        console.log("✅ 백엔드 연결 성공:", data);
      })
      .catch((error) => {
        console.error("❌ 백엔드 연결 실패 (IP/포트/보안그룹 확인 필요):", error);
      });
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigation />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}