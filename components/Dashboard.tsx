
import React, { useState } from 'react';
import { AppData, Camera, ProcessedWorker } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Video, WifiOff, Users, Box, AlertTriangle, MessageSquare, Copy, ShieldAlert, DoorClosed, ShieldCheck, PieChart as PieChartIcon, Ticket, Shield, FileText, Calendar, Briefcase } from 'lucide-react';

interface DashboardProps {
  data: AppData;
  thirdPartyWorkers?: ProcessedWorker[];
}

const Dashboard: React.FC<DashboardProps> = ({ data, thirdPartyWorkers = [] }) => {
  const { cameras, accessPoints, documents } = data;
  const [copied, setCopied] = useState(false);
  // State for tickets: key is camera uuid, value is ticket number
  const [tickets, setTickets] = useState<{ [key: string]: string }>({});

  // Camera Stats
  const totalCameras = cameras.length;
  const camerasOnline = cameras.filter(c => c.status === 'ONLINE').length;
  const camerasOffline = cameras.filter(c => c.status === 'OFFLINE').length;
  const availability = totalCameras > 0 ? ((camerasOnline / totalCameras) * 100).toFixed(1) : '0.0';
  const availabilityNum = parseFloat(availability);

  // Access Stats
  const totalAccess = accessPoints.length;
  const accessOnline = accessPoints.filter(a => a.status === 'ONLINE').length;
  const accessOffline = accessPoints.filter(a => a.status === 'OFFLINE').length;
  
  // Third Party Stats Summary (Unique Headcount Total)
  // Reverted to total unique count without date filtering based on "Retirar ultimo pedido"
  const uniqueThirdPartyCount = new Set(thirdPartyWorkers.map(w => w.name.toUpperCase())).size;
  const latestDate = thirdPartyWorkers.length > 0 
      ? thirdPartyWorkers.map(w => w.date).sort().reverse()[0] 
      : null;

  // Status Logic (Updated based on Percentage Ranges)
  let systemState = 'CRÍTICO';
  let systemColor = 'text-rose-600 dark:text-rose-500'; // Default Critical

  if (availabilityNum >= 95) {
      systemState = 'ÓTIMO';
      systemColor = 'text-emerald-500 dark:text-emerald-400';
  } else if (availabilityNum >= 70) {
      systemState = 'NORMAL';
      systemColor = 'text-blue-500 dark:text-blue-400';
  } else if (availabilityNum >= 40) {
      systemState = 'REGULAR';
      systemColor = 'text-amber-500 dark:text-amber-400';
  } else {
      systemState = 'CRÍTICO';
      systemColor = 'text-rose-600 dark:text-rose-500';
  }

  // Chart Data
  const pieData = [
    { name: 'Online', value: camerasOnline, color: '#10b981' }, // emerald-500
    { name: 'Offline', value: camerasOffline, color: '#f43f5e' }, // rose-500
  ];

  // --- ANALYSIS LOGIC ---

  // 1. Group by Module
  const moduleStats = cameras.reduce((acc: any, curr) => {
    const mod = curr.module || 'Geral';
    if (!acc[mod]) acc[mod] = { name: mod, online: 0, offline: 0, total: 0 };
    if (curr.status === 'ONLINE') acc[mod].online++;
    else acc[mod].offline++;
    acc[mod].total++;
    return acc;
  }, {});
  const moduleList = Object.values(moduleStats).sort((a: any, b: any) => b.offline - a.offline);

  // 2. Group by Responsible (ALL)
  const responsibleStats = cameras.reduce((acc: any, curr) => {
    const resp = curr.responsible || 'Sem Resp.';
    if (!acc[resp]) acc[resp] = { name: resp, offline: 0, total: 0 };
    
    acc[resp].total++;
    if (curr.status === 'OFFLINE') {
        acc[resp].offline++;
    }
    return acc;
  }, {});

  // Sort: High offline counts first, then alphabetical
  const responsibleList = Object.values(responsibleStats).sort((a: any, b: any) => {
      if (b.offline !== a.offline) return b.offline - a.offline;
      return a.name.localeCompare(b.name);
  });

  // 3. Criticality Logic
  const getPriority = (location: string) => {
    const criticalKeywords = ['DOCA', 'PORTARIA', 'SERVIDOR', 'ACESSO', 'ENTRADA'];
    const locUpper = location.toUpperCase();
    if (criticalKeywords.some(k => locUpper.includes(k))) return 'CRÍTICO';
    return 'MODERADO';
  };

  const offlineCameras = cameras.filter(c => c.status === 'OFFLINE').map(c => ({
    ...c,
    priority: getPriority(c.location)
  })).sort((a, b) => a.priority === 'CRÍTICO' ? -1 : 1);

  // 4. Document Expiration Logic
  const expiringDocuments = (documents || []).map(doc => {
      const today = new Date();
      const expDate = new Date(doc.expirationDate);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let status: 'VALID' | 'WARNING' | 'EXPIRED' = 'VALID';
      if (diffDays < 0) status = 'EXPIRED';
      else if (diffDays <= 30) status = 'WARNING';
      
      return { ...doc, diffDays, status };
  }).filter(d => d.status !== 'VALID').sort((a, b) => a.diffDays - b.diffDays);


  // --- HANDLERS ---
  const handleTicketChange = (uuid: string, value: string) => {
    setTickets(prev => ({
        ...prev,
        [uuid]: value
    }));
  };

  // --- WHATSAPP GENERATOR ---
  const generateWhatsAppMessage = () => {
    let msg = `*RELATÓRIO DE MONITORAMENTO*\n`;
    msg += `📅 ${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
    msg += `📊 *Status Geral: ${systemState}*\n`;
    
    if (totalCameras > 0) {
        msg += `📹 *CÂMERAS*\n   Total: ${totalCameras} | 🟢 On: ${camerasOnline} | 🔴 Off: ${camerasOffline}\n   📉 Disponibilidade: ${availability}%\n`;
    }

    if (totalAccess > 0) {
        msg += `🚪 *ACESSOS*\n   Total: ${totalAccess} | 🟢 On: ${accessOnline} | 🔴 Off: ${accessOffline}\n`;
    }

    if (uniqueThirdPartyCount > 0) {
        msg += `👷 *TERCEIROS*\n   Total Presente: ${uniqueThirdPartyCount}\n`;
    }
    
    msg += `\n`;

    if (offlineCameras.length > 0) {
      msg += `❗ *CÂMERAS OFFLINE (${camerasOffline}):*\n`;
      offlineCameras.forEach(c => {
        const ticket = tickets[c.uuid];
        const ticketStr = ticket ? ` [Chamado: ${ticket}]` : '';
        msg += `❌ *${c.name}*${ticketStr}\n   📍 ${c.location} (${c.module})\n   👤 Resp: ${c.responsible}\n`;
      });
    }

    if (accessOffline > 0) {
         msg += `\n❗ *ACESSOS OFFLINE (${accessOffline}):*\n`;
         accessPoints.filter(a => a.status === 'OFFLINE').forEach(a => {
             msg += `❌ *${a.name}* (${a.location})\n`;
         });
    }

    if (camerasOffline === 0 && accessOffline === 0) {
      msg += `✅ *Sistema operando normalmente.*\n`;
    }
    
    // Find top offender
    const topOffender = responsibleList.find((r: any) => r.offline > 0);
    if (topOffender) {
        msg += `\n⚠ *Atenção:* ${(topOffender as any).name} tem ${(topOffender as any).offline} câmeras pendentes.`;
    }

    return msg;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateWhatsAppMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      
      {/* 1. Header Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Total Cameras */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">Total Câmeras</p>
            <div className="flex justify-between items-end">
                <span className="text-3xl font-bold text-slate-800 dark:text-white">{totalCameras}</span>
                <Video className="text-slate-400 dark:text-slate-700 mb-1" size={24} />
            </div>
        </div>
        
        {/* Online */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">Online</p>
            <div className="flex justify-between items-end">
                <span className="text-3xl font-bold text-emerald-500 dark:text-emerald-400">{camerasOnline}</span>
                {totalCameras > 0 && (
                    <div className="h-1.5 flex-1 mx-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-2 hidden sm:block">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(camerasOnline/totalCameras)*100}%` }}></div>
                    </div>
                )}
            </div>
        </div>

        {/* Offline */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between relative overflow-hidden">
            <div className={`absolute right-0 top-0 p-4 opacity-10 ${camerasOffline > 0 ? 'animate-pulse' : ''}`}>
               <WifiOff size={48} className="text-rose-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">Offline</p>
            <div className="flex justify-between items-end">
                <span className={`text-3xl font-bold ${camerasOffline > 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>{camerasOffline}</span>
                <span className="text-xs text-slate-500 mb-1">Câmeras</span>
            </div>
        </div>

        {/* Third Party Summary */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">Terceirizados</p>
            <div className="flex justify-between items-end">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {uniqueThirdPartyCount}
                </span>
                <Briefcase className="text-slate-400 dark:text-slate-700 mb-1" size={24} />
            </div>
            {latestDate && <p className="text-[10px] text-slate-400 mt-1">Ref: {latestDate.split('-').reverse().join('/')}</p>}
        </div>

        {/* Availability / State */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">Estado do Sistema</p>
            <div className="flex justify-between items-end">
                <span className={`text-lg sm:text-xl font-bold ${systemColor} flex items-center gap-2 truncate`}>
                   {systemState}
                </span>
                <span className="text-2xl font-bold text-blue-500">{availability}%</span>
            </div>
        </div>
      </div>
      
      {/* 1.5 Access Control Stats (Conditional) */}
      {totalAccess > 0 && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg flex items-center justify-between">
                 <div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Acessos Total</p>
                    <span className="text-2xl font-bold text-slate-800 dark:text-white">{totalAccess}</span>
                 </div>
                 <DoorClosed className="text-slate-400 dark:text-slate-700" size={24} />
             </div>
             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg flex items-center justify-between">
                 <div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Acessos Online</p>
                    <span className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{accessOnline}</span>
                 </div>
                 <ShieldCheck className="text-emerald-500/50" size={24} />
             </div>
             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg flex items-center justify-between">
                 <div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Acessos Offline</p>
                    <span className={`text-2xl font-bold ${accessOffline > 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>{accessOffline}</span>
                 </div>
                 <AlertTriangle className={`${accessOffline > 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-700'}`} size={24} />
             </div>
         </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 2. Tickets & WhatsApp (Left Column) */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* ALERT WIDGET: PUBLIC DOCUMENTS */}
            {expiringDocuments.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-5 rounded-xl shadow-lg flex flex-col animate-pulse">
                    <h3 className="text-amber-600 dark:text-amber-400 font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        Alertas de Validade (Órgãos Públicos)
                    </h3>
                    <div className="flex-1 space-y-2">
                        {expiringDocuments.map(doc => (
                            <div key={doc.uuid} className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{doc.name}</p>
                                    <p className="text-xs text-slate-500">{doc.organ}</p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-xs font-bold px-2 py-0.5 rounded ${doc.status === 'EXPIRED' ? 'bg-rose-500 text-white' : 'bg-yellow-500 text-black'}`}>
                                        {doc.status === 'EXPIRED' ? 'VENCIDO' : `${doc.diffDays} dias`}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">{new Date(doc.expirationDate).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ticket Management (NEW) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg flex flex-col max-h-[400px]">
                <h3 className="text-amber-600 dark:text-amber-400 font-semibold mb-3 flex items-center gap-2">
                    <Ticket size={18} />
                    Gestão de Chamados (Offline)
                </h3>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {offlineCameras.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs italic">
                            <ShieldCheck size={24} className="mx-auto mb-2 opacity-50" />
                            Nenhuma câmera offline. Tudo operando!
                        </div>
                    ) : (
                        offlineCameras.map(cam => (
                            <div key={cam.uuid} className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate" title={cam.name}>{cam.name}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{cam.location}</p>
                                    </div>
                                    <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20">OFF</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 whitespace-nowrap">Chamado:</span>
                                    <input
                                        type="text"
                                        placeholder="Digite o Nº..."
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-amber-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-700 transition-colors"
                                        value={tickets[cam.uuid] || ''}
                                        onChange={(e) => handleTicketChange(cam.uuid, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* WhatsApp Export */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg flex flex-col h-full max-h-[500px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-2">
                        <MessageSquare size={18} />
                        Relatório WhatsApp
                    </h3>
                    <button 
                        onClick={copyToClipboard}
                        className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
                    >
                        {copied ? 'Copiado!' : 'Copiar'}
                        <Copy size={14} />
                    </button>
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                    {generateWhatsAppMessage()}
                </div>
            </div>

        </div>

        {/* 3. Detailed Metrics (Center & Right) */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* NEW DONUT CHART SECTION */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg relative min-h-[250px]">
                 <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-2 flex items-center gap-2 absolute top-5 left-5 z-10">
                    <PieChartIcon size={18} className="text-blue-500" />
                    Status da Rede
                </h3>
                <div className="h-[250px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={90}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'var(--tw-bg-opacity, #0f172a)', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                itemStyle={{ color: '#f1f5f9' }}
                                cursor={{fill: 'transparent'}}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Centered Total Label */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center -mt-4 pointer-events-none">
                        <span className="text-4xl font-bold text-slate-800 dark:text-white block">{totalCameras}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">Total</span>
                    </div>
                </div>
            </div>

            {/* Priority Offline List */}
            {camerasOffline > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/30 p-0 rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-rose-50 dark:bg-rose-950/20 p-4 border-b border-rose-100 dark:border-rose-900/20 flex justify-between items-center">
                        <h3 className="text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-2">
                            <ShieldAlert size={18} />
                            Câmeras Offline - Prioridade
                        </h3>
                        <span className="text-xs text-rose-600 dark:text-rose-300/60 bg-rose-100 dark:bg-rose-900/20 px-2 py-1 rounded">Ação Necessária</span>
                    </div>
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs uppercase sticky top-0">
                                <tr>
                                    <th className="p-3">Prioridade</th>
                                    <th className="p-3">Nome</th>
                                    <th className="p-3">Local (Módulo)</th>
                                    <th className="p-3">Responsável</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
                                {offlineCameras.map((cam, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3">
                                            {cam.priority === 'CRÍTICO' ? (
                                                <span className="px-2 py-1 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-200 dark:border-rose-500/30">CRÍTICO</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-500/20">MODERADO</span>
                                            )}
                                        </td>
                                        <td className="p-3 font-medium">{cam.name}</td>
                                        <td className="p-3 text-slate-500 dark:text-slate-400 text-xs">{cam.location} <span className="text-slate-400 dark:text-slate-600">({cam.module})</span></td>
                                        <td className="p-3 text-slate-500 dark:text-slate-400 text-xs">{cam.responsible}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Module Traffic Light */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg">
                    <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-4 flex items-center gap-2">
                        <Box size={18} className="text-blue-500" />
                        Análise por Módulo
                    </h3>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                        {moduleList.length > 0 ? moduleList.map((mod: any, idx) => {
                            const isGreen = mod.offline === 0;
                            const isYellow = mod.offline > 0 && mod.offline <= 2;
                            return (
                                <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] 
                                            ${isGreen ? 'bg-emerald-500' : isYellow ? 'bg-amber-500' : 'bg-rose-500'}`
                                        }></div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{mod.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="text-slate-500">Total: {mod.total}</span>
                                        <span className={`${isGreen ? 'text-emerald-500' : 'text-rose-500'} font-bold`}>
                                            {isGreen ? '100% ON' : `${mod.offline} OFF`}
                                        </span>
                                    </div>
                                </div>
                            )
                        }) : (
                            <p className="text-slate-500 text-xs italic">Nenhum dado de módulo.</p>
                        )}
                    </div>
                </div>

                {/* Responsible Breakdown (ALL) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg">
                    <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-4 flex items-center gap-2">
                        <Users size={18} className="text-slate-400" />
                        Status por Responsável
                    </h3>
                    {responsibleList.length > 0 ? (
                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                             {responsibleList.map((resp: any, idx) => {
                                 const hasPending = resp.offline > 0;
                                 return (
                                 <div key={idx} className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                                     <div className="flex flex-col">
                                        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{resp.name}</span>
                                        <span className="text-[10px] text-slate-500">{resp.total} câmeras total</span>
                                     </div>
                                     
                                     {hasPending ? (
                                        <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                                            {resp.offline} OFF
                                        </span>
                                     ) : (
                                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                                            OK
                                        </span>
                                     )}
                                 </div>
                             )})}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-xs italic">
                            <Users size={32} className="mb-2 opacity-20" />
                            Nenhum responsável encontrado.
                        </div>
                    )}
                </div>

            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
