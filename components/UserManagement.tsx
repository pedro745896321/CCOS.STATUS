
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authService } from '../services/auth';
import { Users, UserPlus, Trash2, Shield, Eye, Lock, Check, AlertCircle, Loader2 } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'viewer' as UserRole });
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setListLoading(true);
    try {
      const list = await authService.listUsers();
      setUsers(list);
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setListLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (newUser.password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres (Exigência Firebase).');
        setLoading(false);
        return;
    }

    try {
      await authService.addUser(newUser);
      setSuccess('Usuário adicionado com sucesso!');
      setNewUser({ name: '', email: '', password: '', role: 'viewer' });
      await loadUsers();
    } catch (err: any) {
      let msg = 'Erro ao adicionar usuário.';
      if (err.code === 'auth/email-already-in-use') msg = 'Este email já está em uso.';
      if (err.code === 'auth/weak-password') msg = 'A senha é muito fraca.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (uid: string) => {
    if (!window.confirm('Tem certeza que deseja remover este usuário?')) return;
    try {
      await authService.removeUser(uid);
      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
       <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Users className="text-amber-500" />
                Gestão de Usuários (Firebase)
            </h2>
            <p className="text-slate-400 text-sm">Adicione usuários visualizadores para acompanhar o monitoramento.</p>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-1">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <UserPlus size={18} className="text-blue-500" />
                        Novo Usuário
                    </h3>
                    
                    <form onSubmit={handleAddUser} className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Nome Completo</label>
                            <input 
                                type="text" 
                                required
                                value={newUser.name}
                                onChange={e => setNewUser({...newUser, name: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                placeholder="Ex: João Silva"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Email</label>
                            <input 
                                type="email" 
                                required
                                value={newUser.email}
                                onChange={e => setNewUser({...newUser, email: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                placeholder="usuario@ccos.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Senha Inicial</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    required
                                    value={newUser.password}
                                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 pl-8 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    placeholder="Mínimo 6 caracteres"
                                />
                                <Lock size={14} className="absolute left-2.5 top-2.5 text-slate-600" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Permissão</label>
                            <select 
                                value={newUser.role}
                                onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                            >
                                <option value="viewer">Visualizador (Apenas Leitura)</option>
                                <option value="admin">Administrador (Acesso Total)</option>
                            </select>
                        </div>

                        {error && (
                            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                        {success && (
                            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                                <Check size={14} /> {success}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Cadastrar Usuário'}
                        </button>
                    </form>
                </div>
            </div>

            {/* List */}
            <div className="lg:col-span-2">
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg min-h-[400px]">
                    <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                        <span className="text-sm font-semibold text-slate-200">Usuários Cadastrados</span>
                    </div>
                    {listLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="animate-spin text-blue-500" size={24} />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                                    <tr>
                                        <th className="p-4">Nome</th>
                                        <th className="p-4">Email</th>
                                        <th className="p-4">Função</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                                    {users.map(user => (
                                        <tr key={user.uid} className="hover:bg-slate-800/30">
                                            <td className="p-4 font-medium">{user.name}</td>
                                            <td className="p-4 text-slate-400">{user.email}</td>
                                            <td className="p-4">
                                                {user.role === 'admin' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-xs border border-amber-500/20">
                                                        <Shield size={10} /> Admin
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                                                        <Eye size={10} /> Visualizador
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => handleRemoveUser(user.uid)}
                                                    className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded transition-colors"
                                                    title="Remover Usuário"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
       </div>
    </div>
  );
};

export default UserManagement;
