import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, MessageCircle, LogOut, RefreshCw, Users } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner@2.0.3';

interface User {
  id: string;
  name: string;
  avatar: string;
  latitude: number;
  longitude: number;
  lastSeen: string;
}

interface MapViewProps {
  currentUser: any;
  accessToken: string;
  onLogout: () => void;
  onStartChat: (user: User) => void;
}

export function MapView({ currentUser, accessToken, onLogout, onStartChat }: MapViewProps) {
  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get user's current location and update it
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          toast.success('Location detected!');
          
          // Update location on server
          try {
            const response = await fetch(
              `https://eyccfayrpuvknajlbgbs.supabase.co/functions/v1/make-server-648c7146/update-location`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ latitude, longitude })
              }
            );
            if (!response.ok) {
              const error = await response.json();
              console.error('Failed to update location:', error);
            }
          } catch (error) {
            console.error('Error updating location:', error);
          }
        },
        (error) => {
          // Handle geolocation errors with user-friendly messages
          let errorMessage = 'Location access denied. Using demo location.';
          
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = 'Location permission denied. Using demo location in San Francisco.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = 'Location unavailable. Using demo location.';
          } else if (error.code === error.TIMEOUT) {
            errorMessage = 'Location request timeout. Using demo location.';
          }
          
          console.log('Geolocation error:', error.message || 'Unknown error');
          toast.info(errorMessage);
          
          // Use default location (San Francisco) for demo
          const defaultLat = 37.7749 + (Math.random() - 0.5) * 0.1;
          const defaultLng = -122.4194 + (Math.random() - 0.5) * 0.1;
          setUserLocation({ lat: defaultLat, lng: defaultLng });
          
          // Update with default location
          fetch(
            `https://eyccfayrpuvknajlbgbs.supabase.co/functions/v1/make-server-648c7146/update-location`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({ latitude: defaultLat, longitude: defaultLng })
            }
          ).catch(err => console.error('Error updating default location:', err));
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      // Browser doesn't support geolocation
      toast.info('Geolocation not supported. Using demo location.');
      const defaultLat = 37.7749 + (Math.random() - 0.5) * 0.1;
      const defaultLng = -122.4194 + (Math.random() - 0.5) * 0.1;
      setUserLocation({ lat: defaultLat, lng: defaultLng });
      
      fetch(
        `https://eyccfayrpuvknajlbgbs.supabase.co/functions/v1/make-server-648c7146/update-location`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ latitude: defaultLat, longitude: defaultLng })
        }
      ).catch(err => console.error('Error updating default location:', err));
    }
  }, [accessToken]);

  // Fetch nearby users
  const fetchNearbyUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://eyccfayrpuvknajlbgbs.supabase.co/functions/v1/make-server-648c7146/nearby-users`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setNearbyUsers(data.users);
      } else {
        const error = await response.json();
        console.error('Failed to fetch nearby users:', error);
        toast.error('Failed to load nearby users');
      }
    } catch (error) {
      console.error('Error fetching nearby users:', error);
      toast.error('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userLocation) {
      fetchNearbyUsers();
      const interval = setInterval(fetchNearbyUsers, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [userLocation, accessToken]);

  // Draw map on canvas
  useEffect(() => {
    if (!canvasRef.current || !userLocation) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#4f46e5');
    gradient.addColorStop(1, '#7c3aed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Convert lat/lng to canvas coordinates (simplified projection)
    const latToY = (lat: number) => {
      const minLat = userLocation.lat - 0.05;
      const maxLat = userLocation.lat + 0.05;
      return ((maxLat - lat) / (maxLat - minLat)) * canvas.height;
    };

    const lngToX = (lng: number) => {
      const minLng = userLocation.lng - 0.05;
      const maxLng = userLocation.lng + 0.05;
      return ((lng - minLng) / (maxLng - minLng)) * canvas.width;
    };

    // Draw current user
    const currentX = lngToX(userLocation.lng);
    const currentY = latToY(userLocation.lat);
    
    ctx.beginPath();
    ctx.arc(currentX, currentY, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw nearby users
    nearbyUsers.forEach(user => {
      const x = lngToX(user.longitude);
      const y = latToY(user.latitude);
      
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [userLocation, nearbyUsers]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !userLocation) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const latToY = (lat: number) => {
      const minLat = userLocation.lat - 0.05;
      const maxLat = userLocation.lat + 0.05;
      return ((maxLat - lat) / (maxLat - minLat)) * canvas.height;
    };

    const lngToX = (lng: number) => {
      const minLng = userLocation.lng - 0.05;
      const maxLng = userLocation.lng + 0.05;
      return ((lng - minLng) / (maxLng - minLng)) * canvas.width;
    };

    // Check if click is on a user marker
    for (const user of nearbyUsers) {
      const x = lngToX(user.longitude);
      const y = latToY(user.latitude);
      const distance = Math.sqrt((clickX - x) ** 2 + (clickY - y) ** 2);
      
      if (distance <= 15) {
        setSelectedUser(user);
        return;
      }
    }
    
    setSelectedUser(null);
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="absolute top-0 left-0 right-0 z-10 bg-white/10 backdrop-blur-xl border-b border-white/20 p-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{currentUser?.user_metadata?.avatar || '😊'}</div>
            <div>
              <h2 className="text-white">{currentUser?.user_metadata?.name || 'User'}</h2>
              <p className="text-white/70 text-sm">{currentUser?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchNearbyUsers}
              disabled={isLoading}
              variant="ghost"
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
              <Users className="w-5 h-5 text-white" />
              <span className="text-white">{nearbyUsers.length}</span>
            </div>
            <Button
              onClick={onLogout}
              variant="ghost"
              className="text-white hover:bg-white/20"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Map Canvas */}
      <motion.canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onClick={handleCanvasClick}
        className="absolute inset-0 cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Legend */}
      <motion.div
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        className="absolute bottom-8 left-8 bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
          <span className="text-white text-sm">You</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-amber-500 rounded-full border-2 border-white"></div>
          <span className="text-white text-sm">Nearby Users</span>
        </div>
      </motion.div>

      {/* Selected User Profile */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="absolute bottom-8 right-8 bg-white rounded-3xl p-6 shadow-2xl w-80"
          >
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">{selectedUser.avatar}</div>
              <h3 className="text-gray-900 text-xl mb-1">{selectedUser.name}</h3>
              <p className="text-gray-500 text-sm">
                Last seen: {new Date(selectedUser.lastSeen).toLocaleTimeString()}
              </p>
            </div>
            
            <Button
              onClick={() => onStartChat(selectedUser)}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Start Chat
            </Button>
            
            <button
              onClick={() => setSelectedUser(null)}
              className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
