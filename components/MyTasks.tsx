
import React, { useState, useEffect, useRef } from 'react';
import { User, Task } from '../types';
import { taskService } from '../services/tasks';
import { db } from '../services/firebase';
import { ref, onValue, query, orderByChild, equalTo, off } from 'firebase/database';
import { ClipboardList, Play, CheckSquare, Upload, Paperclip, Clock, AlertCircle, FileText, Loader2, X, MessageSquare, Trash2, AlertTriangle } from 'lucide-react';

interface MyTasksProps {
    currentUser: User;
}

const MyTasks: React.FC<MyTasksProps> = ({ currentUser }) => {
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

    // Completion Modal State
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
    const [completionNote, setCompletionNote] = useState('');

    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        // Listen to Tasks assigned to current user
        const tasksRef = ref(db, 'tasks');
        const unsub = onValue(tasksRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list: Task[] = Object.keys(data).map(key => data[key]);
                // Filter specifically for this user
                const userTasks = list.filter(t => t.assignedToId === currentUser.uid);
                // Sort: Pending > In Progress > Completed
                userTasks.sort((a, b) => {
                    const statusOrder = { 'in_progress': 0, 'pending': 1, 'completed': 2 };
                    return statusOrder[a.status] - statusOrder[b.status];
                });
                setMyTasks(userTasks);
            } else {
                setMyTasks([]);
            }
            setLoading(false);
        });

        return () => off(tasksRef);
    }, [currentUser.uid]);

    const handleStartTask = async (taskId: string) => {
        await taskService.updateTaskStatus(taskId, 'in_progress');
    };

    const handleDeleteClick = (taskId: string) => {
        setDeleteId(taskId);
    };

    const confirmDelete = async () => {
        if (deleteId) {
            await taskService.deleteTask(deleteId);
            setDeleteId(null);
        }
    };

    // Abre o modal
    const openCompletionModal = (taskId: string) => {
        setCompletingTaskId(taskId);
        setCompletionNote('');
        setShowCompleteModal(true);
    };

    // Confirma a conclusão com a nota
    const handleConfirmCompletion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!completingTaskId) return;

        try {
            await taskService.updateTaskStatus(completingTaskId, 'completed', completionNote);
            setShowCompleteModal(false);
            setCompletingTaskId(null);
            setCompletionNote('');
        } catch (error) {
            console.error(error);
            alert("Erro ao concluir tarefa.");
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, taskId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingTaskId(taskId);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            if (evt.target?.result) {
                try {
                    await taskService.addAttachment(taskId, {
                        name: file.name,
                        url: evt.target.result as string,
                        type: 'image' // Treating all as base64 images/docs for simplicity
                    });
                    alert("Arquivo anexado com sucesso!");
                } catch (err) {
                    alert("Erro ao enviar arquivo.");
                } finally {
                    setUploadingTaskId(null);
                }
            }
        };
        reader.readAsDataURL(file);
    };

    const triggerFileInput = (taskId: string) => {
        document.getElementById(`file-input-${taskId}`)?.click();
    };

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6 animate-fade-in pb-12">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CheckSquare className="text-emerald-500" />
                    Minhas Tarefas
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                    Tarefas atribuídas pela supervisão. Inicie, anexe evidências e conclua.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : myTasks.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-xl">
                    <ClipboardList size={48} className="mx-auto mb-4 text-emerald-500/50" />
                    <h3 className="text-white font-bold">Tudo em dia!</h3>
                    <p className="text-slate-500">Você não tem tarefas pendentes no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {myTasks.map(task => (
                        <div key={task.id} className={`border rounded-xl p-5 shadow-lg flex flex-col transition-all relative overflow-hidden
                            ${task.status === 'completed' 
                                ? 'bg-slate-900/50 border-slate-800 opacity-70' 
                                : 'bg-slate-900 border-slate-700 hover:border-blue-500/50'}
                        `}>
                            {/* Status Banner */}
                            <div className={`absolute top-0 left-0 right-0 h-1 
                                ${task.status === 'pending' ? 'bg-amber-500' : task.status === 'in_progress' ? 'bg-blue-500' : 'bg-emerald-500'}
                            `}></div>

                            <div className="flex justify-between items-start mb-3 mt-1">
                                <h3 className="text-lg font-bold text-white leading-tight">{task.title}</h3>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border
                                        ${task.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                                        'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}
                                    `}>
                                        {task.status === 'pending' ? 'Pendente' : task.status === 'in_progress' ? 'Em Andamento' : 'Concluída'}
                                    </span>
                                    {/* BOTÃO EXCLUIR NO CARD DO OPERADOR */}
                                    <button 
                                        onClick={() => handleDeleteClick(task.id)}
                                        className="flex items-center gap-1 px-2 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded transition-colors text-[10px] font-bold uppercase"
                                        title="Apagar Tarefa Permanentemente"
                                    >
                                        <Trash2 size={12} /> APAGAR TAREFA
                                    </button>
                                </div>
                            </div>

                            <p className="text-slate-400 text-sm mb-4 flex-1">{task.description}</p>

                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 border-t border-slate-800 pt-3">
                                <div className="flex items-center gap-1.5">
                                    <Clock size={14} className="text-amber-500" />
                                    Até: {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <FileText size={14} className="text-blue-500" />
                                    Criado por: {task.createdBy}
                                </div>
                            </div>
                            
                            {/* Completion Note (ReadOnly) */}
                            {task.completionNote && task.status === 'completed' && (
                                <div className="mb-4 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg">
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1 flex items-center gap-1">
                                        <MessageSquare size={10} /> Observação de Conclusão:
                                    </p>
                                    <p className="text-xs text-slate-300 italic">"{task.completionNote}"</p>
                                </div>
                            )}

                            {/* Attachments List */}
                            {task.attachments && task.attachments.length > 0 && (
                                <div className="mb-4 bg-slate-950 p-2 rounded-lg border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Anexos:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {task.attachments.map((att, i) => (
                                            <div key={i} className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                                                <Paperclip size={10} /> {att.name.slice(0, 15)}...
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ACTIONS */}
                            {task.status !== 'completed' && (
                                <div className="flex flex-col gap-2 mt-auto">
                                    {task.status === 'pending' ? (
                                        <button 
                                            onClick={() => handleStartTask(task.id)}
                                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
                                        >
                                            <Play size={18} /> Iniciar Tarefa
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input 
                                                    id={`file-input-${task.id}`} 
                                                    type="file" 
                                                    className="hidden" 
                                                    onChange={(e) => handleFileUpload(e, task.id)}
                                                    accept="image/*,application/pdf"
                                                />
                                                <button 
                                                    onClick={() => triggerFileInput(task.id)}
                                                    disabled={uploadingTaskId === task.id}
                                                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg flex items-center justify-center gap-2 transition-all border border-slate-700"
                                                >
                                                    {uploadingTaskId === task.id ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                                    Anexar
                                                </button>
                                            </div>
                                            <button 
                                                onClick={() => openCompletionModal(task.id)}
                                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
                                            >
                                                <CheckSquare size={18} /> Concluir
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* COMPLETION MODAL */}
            {showCompleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <CheckSquare className="text-emerald-500" />
                                Finalizar Tarefa
                            </h3>
                            <button onClick={() => setShowCompleteModal(false)} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleConfirmCompletion} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">
                                    Observações Finais / Resolução (Opcional)
                                </label>
                                <textarea 
                                    autoFocus
                                    value={completionNote}
                                    onChange={(e) => setCompletionNote(e.target.value)}
                                    placeholder="Descreva o que foi feito ou observações importantes..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none h-32 resize-none leading-relaxed"
                                />
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowCompleteModal(false)} 
                                    className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-medium text-sm"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-bold text-sm shadow-lg shadow-emerald-900/20"
                                >
                                    Confirmar Conclusão
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {deleteId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-6 relative">
                        <button 
                            onClick={() => setDeleteId(null)} 
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20">
                                <AlertTriangle className="text-rose-500 w-8 h-8" />
                            </div>
                            
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Excluir Tarefa?</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Você realmente deseja apagar esta tarefa? <br/>
                                    <span className="text-rose-400 font-semibold">Essa ação não pode ser desfeita.</span>
                                </p>
                            </div>
                            
                            <div className="flex gap-3 w-full pt-2">
                                <button 
                                    onClick={() => setDeleteId(null)}
                                    className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-lg shadow-rose-900/20 transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} /> Sim, Apagar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTasks;
