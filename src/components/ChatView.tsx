import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, ArrowLeft, Smile } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner@2.0.3';

interface Message {
  senderId: string;
  recipientId: string;
  message: string;
  timestamp: string;
}

interface ChatViewProps {
  currentUserId: string;
  currentUserAvatar: string;
  recipient: {
    id: string;
    name: string;
    avatar: string;
  };
  accessToken: string;
  onBack: () => void;
}

export function ChatView({ currentUserId, currentUserAvatar, recipient, accessToken, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch(
        `https://eyccfayrpuvknajlbgbs.supabase.co/functions/v1/make-server-648c7146/get-messages/${recipient.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      } else {
        const error = await response.json();
        console.error('Failed to fetch messages:', error);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [recipient.id, accessToken]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(
        `https://eyccfayrpuvknajlbgbs.supabase.co/functions/v1/make-server-648c7146/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            recipientId: recipient.id,
            message: newMessage
          })
        }
      );
      
      if (response.ok) {
        setNewMessage('');
        fetchMessages(); // Refresh messages
      } else {
        const error = await response.json();
        console.error('Failed to send message:', error);
        toast.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Network error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gradient-to-br from-violet-50 to-purple-50">
      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white shadow-sm border-b border-gray-200 p-4 flex items-center gap-4"
      >
        <Button
          onClick={onBack}
          variant="ghost"
          size="icon"
          className="hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="text-4xl"
        >
          {recipient.avatar}
        </motion.div>
        
        <div className="flex-1">
          <h2 className="text-gray-900">{recipient.name}</h2>
          <p className="text-gray-500 text-sm">Online</p>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isOwnMessage = msg.senderId === currentUserId;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className={`flex items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-2xl"
                >
                  {isOwnMessage ? currentUserAvatar : recipient.avatar}
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={`max-w-xs md:max-w-md px-4 py-3 rounded-2xl ${
                    isOwnMessage
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-none'
                      : 'bg-white text-gray-900 rounded-bl-none shadow-sm'
                  }`}
                >
                  <p className="break-words">{msg.message}</p>
                  <p className={`text-xs mt-1 ${isOwnMessage ? 'text-white/70' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-t border-gray-200 p-4"
      >
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hover:bg-gray-100 text-gray-500"
          >
            <Smile className="w-5 h-5" />
          </Button>
          
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 border-none focus:bg-gray-200"
            disabled={isSending}
          />
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
            >
              <Send className="w-5 h-5" />
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
