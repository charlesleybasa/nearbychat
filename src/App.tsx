import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { MapView } from './components/MapView';
import { ChatView } from './components/ChatView';
import { Toaster, toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { getSupabaseClient } from './utils/supabase/client';

type Screen = 'login' | 'register' | 'map' | 'chat';

interface ChatRecipient {
  id: string;
  name: string;
  avatar: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [chatRecipient, setChatRecipient] = useState<ChatRecipient | null>(null);

  const supabase = getSupabaseClient();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.access_token && session?.user) {
        setAccessToken(session.access_token);
        setCurrentUser(session.user);
        setScreen('map');
      }
    };
    checkSession();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        toast.error(error.message || 'Failed to login');
        return;
      }

      if (session?.access_token && session?.user) {
        setAccessToken(session.access_token);
        setCurrentUser(session.user);
        setScreen('map');
        toast.success('Welcome back!');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string, name: string, avatar: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-648c7146/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ email, password, name, avatar })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Registration error:', data);
        toast.error(data.error || 'Failed to register');
        return;
      }

      toast.success('Account created! Please login.');
      setScreen('login');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAccessToken('');
    setScreen('login');
    toast.success('Logged out successfully');
  };

  const handleStartChat = (user: ChatRecipient) => {
    setChatRecipient(user);
    setScreen('chat');
  };

  const handleBackToMap = () => {
    setScreen('map');
    setChatRecipient(null);
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      
      {screen === 'login' && (
        <Login
          onLogin={handleLogin}
          onSwitchToRegister={() => setScreen('register')}
          isLoading={isLoading}
        />
      )}
      
      {screen === 'register' && (
        <Register
          onRegister={handleRegister}
          onSwitchToLogin={() => setScreen('login')}
          isLoading={isLoading}
        />
      )}
      
      {screen === 'map' && currentUser && (
        <MapView
          currentUser={currentUser}
          accessToken={accessToken}
          onLogout={handleLogout}
          onStartChat={handleStartChat}
        />
      )}
      
      {screen === 'chat' && chatRecipient && (
        <ChatView
          currentUserId={currentUser.id}
          currentUserAvatar={currentUser.user_metadata?.avatar || '😊'}
          recipient={chatRecipient}
          accessToken={accessToken}
          onBack={handleBackToMap}
        />
      )}
    </>
  );
}
