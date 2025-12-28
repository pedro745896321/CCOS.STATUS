
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, update, off } from 'firebase/database';
import { EmailPendency, User } from '../types';
import { Mail, AlertCircle, CheckCircle2, ExternalLink, Clock, User as UserIcon, Check } from 'lucide-react';

interface EmailPendenciesProps {
    currentUser: User;
}

const EmailPendencies: React.FC<EmailPendenciesProps> = ({ currentUser }) => {
    const [pendencies, setPendencies] = useState<EmailPendency[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const pendenciesRef = ref(db, 'email_pendencies');
        const unsubscribe = onValue(pendenciesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                // Sort: Pending first, then by date desc
                list.sort((a, b) => {
                    if (a.status === 'pendente' && b.status !== 'pendente') return -1;
                    if (a.status !== 'pendente' && b.status === 'pendente') return 1;
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
                setPendencies(list);
            } else {
                setPendencies([]);
            }
            setLoading(false);
        });

        return () => off(pendenciesRef);
    }, []);

    const handleResolve = async (id: string) => {
        if (!window.confirm("Confirmar que esta pendência foi resolvida?")) return;
        
        try {
            await update(ref(db, `email_pendencies/${id}`), {
                status: 'resolvido',
                resolvedBy: currentUser.name,
                resolvedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar pendência.");
        }
    };

    const pendingCount = pendencies.filter(p => p.status === 'pendente').length;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-12">
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Mail className="text-amber-500" />
                        Pendências de E-mail
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Acompanhamento de solicitações e e-mails críticos pendentes de resposta.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-3">
                        <div className="text-right">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Pendentes</span>
                            <span className="block text-xl font-bold text-amber-500 leading-none">{pendingCount}</span>
                        </div>
                        <AlertCircle className="text-amber-500/50" size={24} />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Carregando pendências...</div>
            ) : pendencies.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 border border-dashed border-slate-800 rounded-xl">
                    <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500/50" />
                    <h3 className="text-white font-bold text-lg">Tudo limpo!</h3>
                    <p className="text-slate-500">Nenhuma pendência de e-mail registrada no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {pendencies.map((item) => (
                        <div 
                            key={item.id} 
                            className={`relative overflow-hidden rounded-xl border transition-all duration-300 p-5 flex flex-col md:flex-row gap-4
                                ${item.status === 'pendente' 
                                    ? 'bg-slate-900 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]' 
                                    : 'bg-slate-950/50 border-slate-800 opacity-60 hover:opacity-100'}
                            `}
                        >
                            {/* Status Stripe */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.status === 'pendente' ? 'bg-amber-500' : 'bg-emerald-500'}`} />

                            <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className={`font-bold text-lg ${item.status === 'pendente' ? 'text-white' : 'text-slate-400 line-through'}`}>
                                        {item.title}
                                    </h3>
                                    {item.status === 'pendente' ? (
                                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20 uppercase tracking-wider">
                                            Pendente
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                                            <Check size={12} /> Resolvido
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mb-4">
                                    <div className="flex items-center gap-1">
                                        <UserIcon size={12} />
                                        Criado por <span className="text-slate-300">{item.createdBy}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(item.timestamp).toLocaleString('pt-BR')}
                                    </div>
                                    {item.status === 'resolvido' && item.resolvedBy && (
                                        <div className="flex items-center gap-1 text-emerald-500/80 ml-auto md:ml-0">
                                            <CheckCircle2 size={12} />
                                            Resolvido por {item.resolvedBy} em {item.resolvedAt ? new Date(item.resolvedAt).toLocaleDateString('pt-BR') : '-'}
                                        </div>
                                    )}
                                </div>

                                {item.link && (
                                    <a 
                                        href={item.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors hover:underline"
                                    >
                                        <ExternalLink size={14} />
                                        Abrir E-mail / Link Externo
                                    </a>
                                )}
                            </div>

                            {item.status === 'pendente' && (
                                <div className="flex items-center md:border-l border-slate-800 md:pl-4">
                                    <button 
                                        onClick={() => handleResolve(item.id)}
                                        className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all hover:scale-105"
                                    >
                                        <CheckCircle2 size={16} />
                                        Resolver
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EmailPendencies;
