import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword, // 補上登入方法
  User
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { auth, db } from '../config/firebaseConfig'; // 請根據實際路徑檢查

// 定義 AuthContext 的資料型態（確保 login 頁面呼叫的名稱都有對應到）
interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>; // 補上這行定義
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 監聽 Firebase 帳號登入狀態的改變
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        console.log(`使用者已登入: ${currentUser.uid}，正在更新在線狀態...`);
        try {
          // 當偵測到使用者登入成功時，強制將 Firestore 狀態設為在線 (true)
          const userDocRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userDocRef, {
            isOnline: true
          });
        } catch (error) {
          console.error("更新登入在線狀態失敗:", error);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle unexpected offline scenarios:
  // - on web: listen for beforeunload to mark user offline
  // - on native: listen for AppState changes to mark offline/online
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (auth.currentUser?.uid) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          // best-effort update before unload. Note: browsers may kill async work here.
          // Also attempt to set offline on visibility change which is generally more reliable.
          updateDoc(userDocRef, { isOnline: false }).catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      try {
        if (!auth.currentUser?.uid) return;
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        if (nextAppState === 'active') {
          updateDoc(userDocRef, { isOnline: true }).catch(() => {});
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          updateDoc(userDocRef, { isOnline: false }).catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      // Also listen to visibilitychange: when the page becomes hidden, mark offline; when visible, mark online.
      const handleVisibilityChange = () => {
        try {
          if (!auth.currentUser?.uid) return;
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          if (document.hidden) {
            // page hidden (user switched tab or minimized) -> mark offline
            updateDoc(userDocRef, { isOnline: false }).catch(() => {});
          } else {
            // page visible again -> mark online
            updateDoc(userDocRef, { isOnline: true }).catch(() => {});
          }
        } catch (e) {
          // ignore
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // AppState listener for mobile / native
    let subscription: { remove?: () => void } | null = null;
    try {
      // addEventListener returns a subscription with remove()
      // older RN may have AppState.addEventListener returning void; this is best-effort
      // @ts-ignore
      subscription = AppState.addEventListener('change', handleAppStateChange);
    } catch (e) {
      // fallback for older RN
      // @ts-ignore
      AppState.addEventListener && AppState.addEventListener('change', handleAppStateChange);
    }

    return () => {
      if (Platform.OS === 'web') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', () => {});
      }
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        } else if (AppState.removeEventListener) {
          // @ts-ignore
          AppState.removeEventListener('change', handleAppStateChange);
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // 1. 補上讓登入頁面呼叫的 signIn 功能
  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // 登入成功時，手動強制將 Firestore 狀態改為在線
      if (userCredential.user) {
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        await updateDoc(userDocRef, {
          isOnline: true
        });
      }
      return userCredential;
    } catch (error) {
      console.error("Firebase 登入失敗:", error);
      throw error;
    }
  };

  // 2. 登出功能（先改狀態再登出）
  const logout = async () => {
    try {
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        console.log(`正在強制將使用者 ${uid} 的資料庫狀態改為離線...`);
        
        // 登出前，先手動把當前使用者的 Firestore isOnline 欄位寫死成 false
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, {
          isOnline: false
        });
      }
      
      await firebaseSignOut(auth);
      console.log("Firebase 登出成功！");
    } catch (error) {
      console.error("登出邏輯發生錯誤:", error);
      await firebaseSignOut(auth); // 保險起見依然強迫登出
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, signIn }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必須在 AuthProvider 內部使用');
  }
  return context;
};