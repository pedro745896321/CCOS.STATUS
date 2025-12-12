import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../types';
import { ref, push, onValue, limitToLast, query, off } from 'firebase/database';
import { db } from '../services/firebase';
import { authService } from '../services/auth';
import { Send, User as UserIcon, Settings, X, Camera, Save, MessageSquare, Users, Briefcase, Mail, Hash, ChevronLeft, Image as ImageIcon } from 'lucide-react';

interface ChatProps {
  currentUser: User;
}

const Chat: React.FC<ChatProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // State for Chat Context
  // null = General Chat, User object = Private Chat with that user
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Mobile UI State
  const [mobileShowUserList, setMobileShowUserList] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Profile Edit State
  const [editProfile, setEditProfile] = useState({
      name: currentUser.name,
      jobTitle: currentUser.jobTitle || '',
      bio: currentUser.bio || '',
      photoURL: currentUser.photoURL || '',
      bannerURL: currentUser.bannerURL || ''
  });

  // CRITICAL FIX: Sync local edit state when currentUser updates from DB (via App.tsx)
  useEffect(() => {
    setEditProfile({
      name: currentUser.name,
      jobTitle: currentUser.jobTitle || '',
      bio: currentUser.bio || '',
      photoURL: currentUser.photoURL || '',
      bannerURL: currentUser.bannerURL || ''
    });
  }, [currentUser]);

  // --- HELPER: Conversation ID ---
  // Gera um ID único para a conversa privada baseado nos UIDs ordenados alfabeticamente
  const getConversationId = (uid1: string, uid2: string) => {
      return [uid1, uid2].sort().join('_');
  };

  // --- FETCH USERS ---
  useEffect(() => {
      // Carrega lista de usuários para o menu lateral
      // Usar onValue aqui também seria ideal para ver quem fica online/offline, 
      // mas listUsers (get) é suficiente para MVP, adicionando polling simples ou reload manual
      const fetchUsers = () => {
          authService.listUsers().then((list) => {
              setUsersList(list.filter(u => u.uid !== currentUser.uid));
          });
      };
      
      fetchUsers();
      // Opcional: Atualizar lista a cada 30s para pegar novos cadastros
      const interval = setInterval(fetchUsers, 30000);
      return () => clearInterval(interval);

  }, [currentUser.uid]);

  // --- FETCH MESSAGES (Dynamic based on selectedUser) ---
  useEffect(() => {
    setMessages([]); // Limpa mensagens ao trocar de chat para evitar "flicker"
    
    let messagesPath = 'messages'; // Padrão: Chat Geral
    
    if (selectedUser) {
        // Chat Privado
        const convId = getConversationId(currentUser.uid, selectedUser.uid);
        messagesPath = `private_messages/${convId}`;
    }

    const messagesRef = query(ref(db, messagesPath), limitToLast(50));
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setMessages(msgList);
      } else {
        setMessages([]);
      }
    });

    return () => off(messagesRef);
  }, [selectedUser, currentUser.uid]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- HANDLERS ---

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim()) return;

      const msgData: Omit<ChatMessage, 'id'> = {
          senderId: currentUser.uid,
          senderName: currentUser.name,
          senderPhoto: currentUser.photoURL || '',
          text: newMessage,
          timestamp: new Date().toISOString()
      };

      try {
          let messagesPath = 'messages';
          if (selectedUser) {
              const convId = getConversationId(currentUser.uid, selectedUser.uid);
              messagesPath = `private_messages/${convId}`;
          }

          await push(ref(db, messagesPath), msgData);
          setNewMessage('');
      } catch (err) {
          console.error("Erro ao enviar:", err);
          alert("Erro ao enviar mensagem. Verifique sua conexão.");
      }
  };

  const handleUpdateProfile = async () => {
      setLoading(true);
      try {
          // Atualiza no Firebase Database
          // Como authService agora usa onValue, o App.tsx vai receber o update
          // e passar o novo currentUser para este componente automaticamente.
          await authService.updateUserProfile(currentUser.uid, editProfile);
          
          alert('Perfil salvo com sucesso!');
          setShowProfile(false);
      } catch (err) {
          console.error(err);
          alert('Erro ao atualizar perfil. Tente novamente.');
      } finally {
          setLoading(false);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'photoURL' | 'bannerURL') => {
    const file = e.target.files?.[0];
    if (file) {
      // Limite de tamanho simples (2MB) para evitar problemas no Realtime Database
      if (file.size > 2 * 1024 * 1024) {
          alert("A imagem é muito grande. Tente uma imagem menor que 2MB.");
          return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
          if (evt.target?.result) {
              setEditProfile(prev => ({ ...prev, [field]: evt.target?.result as string }));
          }
      };
      reader.readAsDataURL(file);
    }
  };

  // Switch Chat Handler
  const handleSelectChat = (user: User | null) => {
      setSelectedUser(user);
      setMobileShowUserList(false); // No mobile, esconde a lista e mostra o chat
  };

  // Helper component for Images/Avatars
  const Avatar = ({ url, name, size = 'md' }: { url?: string, name: string, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
      const sizeClasses = {
          sm: 'w-8 h-8 text-xs',
          md: 'w-10 h-10 text-sm',
          lg: 'w-24 h-24 text-xl',
          xl: 'w-32 h-32 text-2xl'
      };
      
      if (url) {
          return <img src={url} alt={name} className={`${sizeClasses[size]} rounded-full object-cover border-2 border-slate-700 shadow-lg shrink-0`} />;
      }
      return (
          <div className={`${sizeClasses[size]} rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 font-bold shadow-lg shrink-0`}>
              {name.charAt(0).toUpperCase()}
          </div>
      );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden animate-fade-in relative">
        
        {/* LEFT SIDEBAR: USERS LIST */}
        <div className={`
            absolute inset-0 z-20 md:static md:z-auto bg-slate-900 border-r border-slate-800 flex-col w-full md:w-72 transition-transform duration-300
            ${mobileShowUserList ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0 hidden md:flex'}
        `}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <h3 className="text-white font-bold flex items-center gap-2">
                    <Users size={18} className="text-blue-500" />
                    Contatos
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                
                {/* General Chat Button */}
                <div 
                    onClick={() => handleSelectChat(null)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer mb-4 border border-transparent
                        ${selectedUser === null ? 'bg-blue-600/20 border-blue-600/50' : 'hover:bg-slate-800/50'}
                    `}
                >
                    <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 font-bold shadow-lg shrink-0">
                        <Hash size={20} />
                    </div>
                    <div className="overflow-hidden">
                        <p className={`text-sm font-bold ${selectedUser === null ? 'text-blue-400' : 'text-slate-200'}`}>Chat Geral</p>
                        <p className="text-[10px] text-slate-500">Canal de toda a equipe</p>
                    </div>
                </div>

                <div className="px-2 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Mensagens Diretas
                </div>

                {usersList.map(u => (
                    <div 
                        key={u.uid} 
                        onClick={() => handleSelectChat(u)}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer group border border-transparent
                             ${selectedUser?.uid === u.uid ? 'bg-slate-800 border-slate-700' : 'hover:bg-slate-800/50'}
                        `}
                    >
                        <div className="relative">
                            <Avatar url={u.photoURL} name={u.name} size="sm" />
                            {/* Simple Online Indicator (Static for now) */}
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-medium text-slate-200 truncate">{u.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{u.jobTitle || 'Membro'}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/30">
                <button 
                    onClick={() => setShowProfile(true)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-left"
                >
                    <Avatar url={currentUser.photoURL} name={currentUser.name} size="sm" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-400">Editar Perfil</p>
                    </div>
                    <Settings size={14} className="text-slate-500" />
                </button>
            </div>
        </div>

        {/* CENTER: CHAT AREA */}
        <div className="flex-1 flex flex-col bg-slate-950 relative w-full">
            {/* Chat Header */}
            <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setMobileShowUserList(true)} 
                        className="md:hidden text-slate-400 hover:text-white p-1"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    
                    {selectedUser ? (
                        <>
                            <Avatar url={selectedUser.photoURL} name={selectedUser.name} size="sm" />
                            <div>
                                <h2 className="text-white font-bold text-sm md:text-base">{selectedUser.name}</h2>
                                <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500">
                                <Hash size={20} />
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-sm md:text-base">Chat Geral</h2>
                                <p className="text-[10px] text-slate-500">Canal oficial da equipe</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/50">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
                        {selectedUser ? (
                            <>
                                <Users size={48} className="mb-2" />
                                <p className="text-sm">Inicie uma conversa privada com {selectedUser.name.split(' ')[0]}.</p>
                            </>
                        ) : (
                            <>
                                <MessageSquare size={48} className="mb-2" />
                                <p className="text-sm">Nenhuma mensagem no chat geral.</p>
                            </>
                        )}
                    </div>
                )}
                
                {messages.map((msg) => {
                    const isMe = msg.senderId === currentUser.uid;
                    return (
                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} group`}>
                            {!isMe && <Avatar url={msg.senderPhoto} name={msg.senderName} size="sm" />}
                            <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-baseline gap-2 mb-1 px-1">
                                    <span className="text-[11px] font-bold text-slate-400">{isMe ? 'Você' : msg.senderName}</span>
                                    <span className="text-[9px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm relative break-words
                                    ${isMe 
                                        ? 'bg-blue-600 text-white rounded-tr-none' 
                                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                                    }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800">
                <form onSubmit={handleSendMessage} className="flex gap-2 relative max-w-4xl mx-auto w-full">
                    <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={selectedUser ? `Mensagem para ${selectedUser.name.split(' ')[0]}...` : "Mensagem para todos..."}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-full pl-5 pr-12 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-600"
                    />
                    <button 
                        type="submit" 
                        disabled={!newMessage.trim()}
                        className="absolute right-2 top-1.5 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:bg-slate-700"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>

        {/* PROFILE EDIT MODAL */}
        {showProfile && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-fade-in">
                <div className="w-full max-w-md bg-slate-900 h-full border-l border-slate-800 shadow-2xl overflow-y-auto relative">
                    <button 
                        onClick={() => setShowProfile(false)}
                        className="absolute top-4 right-4 z-20 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    {/* Banner Section */}
                    <div className="relative h-40 bg-gradient-to-r from-blue-900 to-slate-900">
                        {editProfile.bannerURL ? (
                            <img src={editProfile.bannerURL} alt="Banner" className="w-full h-full object-cover opacity-80" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-30">
                                <ImageIcon size={48} />
                            </div>
                        )}
                        <label className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full cursor-pointer text-white transition-colors" title="Alterar Capa">
                            <Camera size={16} />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'bannerURL')} />
                        </label>
                    </div>

                    {/* Avatar Section */}
                    <div className="px-6 relative -mt-16 mb-4 flex flex-col items-center">
                         <div className="relative group">
                            <Avatar url={editProfile.photoURL} name={editProfile.name} size="xl" />
                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" title="Alterar Foto">
                                <Camera size={24} />
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'photoURL')} />
                            </label>
                         </div>
                    </div>

                    {/* Form Fields */}
                    <div className="px-6 pb-8 space-y-5">
                        <h3 className="text-xl font-bold text-white text-center mb-6">Editar Perfil</h3>
                        
                        <div>
                            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                                <UserIcon size={14} /> Nome Completo
                            </label>
                            <input 
                                type="text" 
                                value={editProfile.name}
                                onChange={e => setEditProfile({...editProfile, name: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                                <Briefcase size={14} /> Cargo / Função
                            </label>
                            <input 
                                type="text" 
                                placeholder="Ex: Supervisor Operacional"
                                value={editProfile.jobTitle}
                                onChange={e => setEditProfile({...editProfile, jobTitle: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                         <div>
                            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                                <Mail size={14} /> Bio / Status
                            </label>
                            <textarea 
                                placeholder="Escreva algo sobre você..."
                                value={editProfile.bio}
                                onChange={e => setEditProfile({...editProfile, bio: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none h-24 resize-none"
                            />
                        </div>

                        <button 
                            onClick={handleUpdateProfile}
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? 'Salvando...' : <><Save size={18} /> Salvar Alterações</>}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Chat;