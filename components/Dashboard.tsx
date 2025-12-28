
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { AppData, Camera, ProcessedWorker, Status, User } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Video, WifiOff, Users, Box, AlertTriangle, MessageSquare, Copy, ShieldAlert, DoorClosed, ShieldCheck, PieChart as PieChartIcon, Ticket, Shield, FileText, Calendar, Briefcase, Save, CheckCircle, Warehouse, Power, Clock, Activity } from 'lucide-react';
import { monitoringService } from '../services/monitoring';

interface DashboardProps {
  data: AppData;
  thirdPartyWorkers?: ProcessedWorker[];
  onSetWarehouseStatus?: (warehouse: string, status: Status) => void;
  currentUser?: User | null;
}

const VALID_THIRD_PARTY_COMPANIES = ['B11', 'MULT', 'MPI', 'FORMA', 'SUPERA LOG', 'MJM', 'PRIMUS', 'PRAYLOG'];

// Helper para verificar permissão de forma flexível (Lida com 'G2' vs 'GALPÃO G2')
const hasWarehousePermission = (allowedList: string[] | undefined, targetWarehouse: string) => {
    if (!allowedList || allowedList.length === 0) return false;
    const normalizedTarget = (targetWarehouse || '').toUpperCase();
    
    return allowedList.some(allowed => {
        const normalizedAllowed = allowed.toUpperCase();
        // 1. Match Exato
        if (normalizedAllowed === normalizedTarget) return true;
        // 2. Contém (Ex: 'GALPÃO G2' contém 'G2')
        if (normalizedAllowed.includes(normalizedTarget) || normalizedTarget.includes(normalizedAllowed)) return true;
        // 3. Casos Específicos (Mapeamento manual se necessário)
        if (normalizedAllowed.includes('SP-IP') && normalizedTarget.includes('ITAPEVI')) return true;
        if (normalizedAllowed.includes('PAVUNA') && normalizedTarget.includes('PAVUNA')) return true;
        if (normalizedAllowed.includes('MERITI') && normalizedTarget.includes('MERITI')) return true;
        if (normalizedAllowed.includes('4 ELOS') && normalizedTarget.includes('ELOS')) return true;
        
        return false;
    });
};

const Dashboard: React.FC<DashboardProps> = ({ data, thirdPartyWorkers = [], onSetWarehouseStatus, currentUser }) => {
  const { cameras, accessPoints, documents } = data;
  const [copied, setCopied] = useState(false);
  // Local state for editing tickets before saving
  const [localTickets, setLocalTickets] = useState<{ [key: string]: string }>({});
  
  // State for Chart Date Filter
  const [selectedChartDate, setSelectedChartDate] = useState<string>('');

  // State for Real-Time Clock (Manager View)
  const [currentTime, setCurrentTime] = useState(new Date());

  const userRole = currentUser?.role;
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager'; // Helper for manager role

  // --- EFFECT: CLOCK ---
  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
  }, []);

  // --- PERMISSION FILTERING ---
  // Filter cameras and access points based on user role and allowed warehouses
  const visibleCameras = useMemo(() => {
      if (isManager && currentUser?.allowedWarehouses) {
          return cameras.filter(c => hasWarehousePermission(currentUser.allowedWarehouses, c.warehouse));
      }
      return cameras;
  }, [cameras, isManager, currentUser]);

  const visibleAccessPoints = useMemo(() => {
      if (isManager && currentUser?.allowedWarehouses) {
          return accessPoints.filter(a => hasWarehousePermission(currentUser.allowedWarehouses, a.warehouse));
      }
      return accessPoints;
  }, [accessPoints, isManager, currentUser]);


  // Camera Stats - Memoized (Using visibleCameras)
  const { totalCameras, camerasOnline, camerasOffline, availability } = useMemo(() => {
      const total = visibleCameras.length;
      const online = visibleCameras.filter(c => c.status === 'ONLINE').length;
      const offline = visibleCameras.filter(c => c.status === 'OFFLINE').length;
      const avail = total > 0 ? ((online / total) * 100).toFixed(1) : '0.0';
      return { totalCameras: total, camerasOnline: online, camerasOffline: offline, availability: avail };
  }, [visibleCameras]);

  const availabilityNum = parseFloat(availability);

  // Access Stats - Memoized (Using visibleAccessPoints)
  const { totalAccess, accessOnline, accessOffline } = useMemo(() => {
      const total = visibleAccessPoints.length;
      const online = visibleAccessPoints.filter(a => a.status === 'ONLINE').length;
      const offline = visibleAccessPoints.filter(a => a.status === 'OFFLINE').length;
      return { totalAccess: total, accessOnline: online, accessOffline: offline };
  }, [visibleAccessPoints]);
  
  // Third Party Stats Summary (Using permission logic inside useMemo)
  const { totalPeopleCount, uniqueThirdPartyCount, latestDate, filteredWorkers } = useMemo(() => {
      let filtered = thirdPartyWorkers;
      
      // Filter workers if manager
      if (isManager && currentUser?.allowedWarehouses) {
          filtered = thirdPartyWorkers.filter(w => hasWarehousePermission(currentUser.allowedWarehouses, w.unit));
      }

      // 1. Identificar a Data Mais Recente (para os contadores de "Presentes Agora")
      const availableDates = Array.from(new Set(filtered.map(w => w.date))).filter(d => d && d !== 'N/A').sort().reverse();
      const mostRecentDate = availableDates.length > 0 ? availableDates[0] : null;

      // 2. Filtrar apenas registros desta data para o Dashboard
      const currentDayWorkers = mostRecentDate 
          ? filtered.filter(w => w.date === mostRecentDate) 
          : [];

      // LÓGICA CORRIGIDA: Contagem por Chave Única (Unidade + Nome + Empresa)
      // Isso alinha com o Status Terceirizados, onde a contagem é a soma das unidades.
      // Se João está em G2 e G3, conta como 2 presenças.
      const getUniquePresenceKey = (w: ProcessedWorker) => `${w.unit}-${w.name.toUpperCase()}-${w.company}`;

      const totalUniquePresences = new Set(currentDayWorkers.map(w => getUniquePresenceKey(w))).size;

      // Total Apenas de Terceiros (Empresas Validadas do dia)
      const thirdPartyOnly = currentDayWorkers.filter(w => VALID_THIRD_PARTY_COMPANIES.includes(w.company));
      const tpCount = new Set(thirdPartyOnly.map(w => getUniquePresenceKey(w))).size;

      return { 
          totalPeopleCount: totalUniquePresences, 
          uniqueThirdPartyCount: tpCount, 
          latestDate: mostRecentDate, 
          filteredWorkers: filtered // Retorna o histórico completo para o gráfico
      };
  }, [thirdPartyWorkers, isManager, currentUser]);

  // Available Dates for Chart
  const availableChartDates = useMemo(() => {
      const dates = new Set(filteredWorkers.map(w => w.date));
      return Array.from(dates).sort().reverse().filter(d => d && d !== 'N/A');
  }, [filteredWorkers]);

  // Initialize selectedChartDate
  useEffect(() => {
      if (!selectedChartDate && availableChartDates.length > 0) {
          setSelectedChartDate(availableChartDates[0]);
      }
  }, [availableChartDates, selectedChartDate]);

  // Hourly Data for Chart (Filtered by Date)
  const hourlyData = useMemo(() => {
        const counts = new Array(24).fill(0);
        filteredWorkers.forEach(w => {
            // Filter by date
            if (w.date !== selectedChartDate) return;

            if (w.time && w.time.includes(':')) {
                const hour = parseInt(w.time.split(':')[0], 10);
                if (!isNaN(hour) && hour >= 0 && hour < 24) {
                    counts[hour]++;
                }
            }
        });
        return counts.map((count, hour) => ({
            hour: `${hour.toString().padStart(2, '0')}:00`,
            acessos: count
        }));
  }, [filteredWorkers, selectedChartDate]);

  // Status Logic
  const { systemState, systemColor } = useMemo(() => {
      let state = 'CRÍTICO';
      let color = 'text-rose-600 dark:text-rose-500';

      if (availabilityNum >= 95) {
          state = 'ÓTIMO';
          color = 'text-emerald-500 dark:text-emerald-400';
      } else if (availabilityNum >= 70) {
          state = 'NORMAL';
          color = 'text-blue-500 dark:text-blue-400';
      } else if (availabilityNum >= 40) {
          state = 'REGULAR';
          color = 'text-amber-500 dark:text-amber-400';
      }
      return { systemState: state, systemColor: color };
  }, [availabilityNum]);

  // Chart Data
  const pieData = useMemo(() => [
    { name: 'Online', value: camerasOnline, color: '#10b981' }, 
    { name: 'Offline', value: camerasOffline, color: '#f43f5e' }, 
  ], [camerasOnline, camerasOffline]);

  // --- ANALYSIS LOGIC (Memoized using visibleCameras) ---

  // 1. Group by Module
  const moduleList = useMemo(() => {
      const stats = visibleCameras.reduce((acc: any, curr) => {
        const mod = curr.module || 'Geral';
        if (!acc[mod]) acc[mod] = { name: mod, online: 0, offline: 0, total: 0 };
        if (curr.status === 'ONLINE') acc[mod].online++;
        else acc[mod].offline++;
        acc[mod].total++;
        return acc;
      }, {});
      return Object.values(stats).sort((a: any, b: any) => b.offline - a.offline);
  }, [visibleCameras]);

  // 2. Group by Responsible (ALL)
  const responsibleList = useMemo(() => {
      const stats = visibleCameras.reduce((acc: any, curr) => {
        const resp = curr.responsible || 'Sem Resp.';
        if (!acc[resp]) acc[resp] = { name: resp, offline: 0, total: 0 };
        
        acc[resp].total++;
        if (curr.status === 'OFFLINE') {
            acc[resp].offline++;
        }
        return acc;
      }, {});

      return Object.values(stats).sort((a: any, b: any) => {
          if (b.offline !== a.offline) return b.offline - a.offline;
          return a.name.localeCompare(b.name);
      });
  }, [visibleCameras]);

  // 3. Group by Warehouse (New)
  const warehouseList = useMemo(() => {
      const stats = visibleCameras.reduce((acc: any, curr) => {
        const wh = curr.warehouse || 'Geral';
        if (!acc[wh]) acc[wh] = { name: wh, online: 0, offline: 0, total: 0 };
        if (curr.status === 'ONLINE') acc[wh].online++;
        else acc[wh].offline++;
        acc[wh].total++;
        return acc;
      }, {});
      return Object.values(stats).sort((a: any, b: any) => b.offline - a.offline);
  }, [visibleCameras]);

  // 4. Criticality Logic
  const offlineCameras = useMemo(() => {
      const getPriority = (location: string) => {
        const criticalKeywords = ['DOCA', 'PORTARIA', 'SERVIDOR', 'ACESSO', 'ENTRADA'];
        const locUpper = location.toUpperCase();
        if (criticalKeywords.some(k => locUpper.includes(k))) return 'CRÍTICO';
        return 'MODERADO';
      };

      return visibleCameras.filter(c => c.status === 'OFFLINE').map(c => ({
        ...c,
        priority: getPriority(c.location)
      })).sort((a, b) => a.priority === 'CRÍTICO' ? -1 : 1);
  }, [visibleCameras]);

  // 5. Document Expiration Logic
  const expiringDocuments = useMemo(() => {
      return (documents || []).map(doc => {
          const today = new Date();
          const expDate = new Date(doc.expirationDate);
          const diffTime = expDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          let status: 'VALID' | 'WARNING' | 'EXPIRED' = 'VALID';
          if (diffDays < 0) status = 'EXPIRED';
          else if (diffDays <= 30) status = 'WARNING';
          
          return { ...doc, diffDays, status };
      }).filter(d => d.status !== 'VALID').sort((a, b) => a.diffDays - b.diffDays);
  }, [documents]);


  // --- HANDLERS ---
  const handleTicketChange = (uuid: string, value: string) => {
    setLocalTickets(prev => ({ ...prev, [uuid]: value }));
  };

  const handleSaveTicket = async (uuid: string) => {
      const ticketValue = localTickets[uuid];
      if (ticketValue !== undefined) {
          await monitoringService.updateCameraTicket(uuid, ticketValue, cameras); // Pass all cameras to service
          setLocalTickets(prev => {
              const newState = { ...prev };
              delete newState[uuid]; 
              return newState;
          });
          alert("Chamado salvo com sucesso!");
      }
  };

  const handleResolveTicket = async (uuid: string) => {
      if (window.confirm("Isso marcará a câmera como ONLINE e limpará o chamado. Confirmar?")) {
          await monitoringService.resolveCameraIssue(uuid, cameras); // Pass all cameras to service
          setLocalTickets(prev => {
              const newState = { ...prev };
              delete newState[uuid];
              return newState;
          });
      }
  };

  const handleWarehouseBulkAction = (warehouseName: string) => {
      if (onSetWarehouseStatus && isAdmin) {
          if (window.confirm(`Deseja definir TODAS as câmeras de "${warehouseName}" como ONLINE?`)) {
              onSetWarehouseStatus(warehouseName, 'ONLINE');
          }
      }
  };

  // --- WHATSAPP GENERATOR ---
  const whatsAppMessage = useMemo(() => {
    let msg = `*RELATÓRIO DE MONITORAMENTO*\n`;
    msg += `📅 ${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
    msg += `📊 *Status Geral: ${systemState}*\n`;
    
    if (totalCameras > 0) {
        msg += `📹 *CÂMERAS*\n   Total: ${totalCameras} | 🟢 On: ${camerasOnline} | 🔴 Off: ${camerasOffline}\n   📉 Disponibilidade: ${availability}%\n`;
    }

    if (totalAccess > 0) {
        msg += `🚪 *ACESSOS*\n   Total: ${totalAccess} | 🟢 On: ${accessOnline} | 🔴 Off: ${accessOffline}\n`;
    }

    if (totalPeopleCount > 0) {
        msg += `👷 *PESSOAS*\n   Total Presente: ${totalPeopleCount} (Terceiros: ${uniqueThirdPartyCount})\n`;
    }
    
    msg += `\n`;

    if (offlineCameras.length > 0) {
      msg += `❗ *CÂMERAS OFFLINE (${camerasOffline}):*\n`;
      offlineCameras.forEach(c => {
        const ticket = c.ticket || localTickets[c.uuid]; 
        const ticketStr = ticket ? ` [Chamado: ${ticket}]` : '';
        msg += `❌ *${c.name}*${ticketStr}\n   📍 ${c.location} (${c.module})\n   👤 Resp: ${c.responsible}\n`;
      });
    }

    if (accessOffline > 0) {
         msg += `\n❗ *ACESSOS OFFLINE (${accessOffline}):*\n`;
         visibleAccessPoints.filter(a => a.status === 'OFFLINE').forEach(a => {
             msg += `❌ *${a.name}* (${a.location})\n`;
         });
    }

    if (camerasOffline === 0 && accessOffline === 0) {
      msg += `✅ *Sistema operando normalmente.*\n`;
    }
    
    const topOffender = responsibleList.find((r: any) => r.offline > 0);
    if (topOffender) {
        msg += `\n⚠ *Atenção:* ${(topOffender as any).name} tem ${(topOffender as any).offline} câmeras pendentes.`;
    }

    return msg;
  }, [systemState, totalCameras, camerasOnline, camerasOffline, availability, totalAccess, accessOnline, accessOffline, totalPeopleCount, uniqueThirdPartyCount, offlineCameras, visibleAccessPoints, localTickets, responsibleList]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(whatsAppMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [whatsAppMessage]);

  return (
    <div className="space-y-6 pb-8">
      
      {/* --- MANAGER HEADER (CLOCK & UNIT) --- */}
      {isManager && (
          <div className="bg-slate-900 p-6 rounded-xl border border-purple-500/30 mb-2 flex flex-col md:flex-row justify-between items-center shadow-lg shadow-purple-900/10 relative overflow-hidden animate-fade-in">
              {/* Visual stripe */}
              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>

              <div className="mb-4 md:mb-0">
                  <h2 className="text-white font-bold text-xl flex items-center gap-2">
                      <Shield className="text-purple-500 fill-purple-500/20" size={24} />
                      Painel do Gestor
                  </h2>
                  <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                      <Warehouse size={16} className="text-purple-400" />
                      <span className="font-medium text-slate-300">
                          {currentUser?.allowedWarehouses && currentUser.allowedWarehouses.length > 0 
                              ? currentUser.allowedWarehouses.join(', ') 
                              : 'Sem Unidade Vinculada'}
                      </span>
                  </div>
              </div>

              <div className="text-center md:text-right bg-slate-950/50 p-3 rounded-lg border border-slate-800 min-w-[200px]">
                  <div className="text-3xl font-mono font-bold text-white tracking-widest flex items-center justify-center md:justify-end gap-2">
                      <Clock size={24} className="text-purple-500 animate-pulse" />
                      {currentTime.toLocaleTimeString('pt-BR')}
                  </div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                      {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
              </div>
          </div>
      )}

      {/* 1. Header Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
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

        {/* People/Third Party Summary (Modified) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between h-full relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
                <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider flex items-center gap-2">
                    Pessoas Presentes
                </p>
                <Briefcase className="text-slate-400 dark:text-slate-700" size={20} />
            </div>
            
            <div className="flex items-center gap-6">
                <div className="flex flex-col">
                    <span className="text-4xl font-black text-slate-800 dark:text-white leading-none tracking-tight">
                        {totalPeopleCount}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold mt-1">Total</span>
                </div>
                <div className="h-10 w-px bg-slate-300 dark:bg-slate-700"></div>
                <div className="flex flex-col">
                    <span className="text-4xl font-black text-blue-600 dark:text-blue-500 leading-none tracking-tight">
                        {uniqueThirdPartyCount}
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">Terceiros</span>
                </div>
            </div>
            
            {latestDate && (
                <div className="mt-4 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800/50 flex justify-end">
                    <p className="text-[10px] text-slate-400 font-mono">
                        Ref: <span className="text-slate-300">{latestDate.split('-').reverse().join('/')}</span>
                    </p>
                </div>
            )}
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
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
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

      {/* NEW SECTION: VISÃO GERAL DE ACESSOS (CHART) */}
      <div className="animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Clock size={20} className="text-blue-500" />
                        Fluxo de Acessos por Horário
                    </h3>
                    
                    {/* Date Selector */}
                    <div className="relative">
                        <select 
                            value={selectedChartDate}
                            onChange={(e) => setSelectedChartDate(e.target.value)}
                            className="pl-3 pr-8 py-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                            disabled={availableChartDates.length === 0}
                        >
                            {availableChartDates.length > 0 ? (
                                availableChartDates.map(date => (
                                    <option key={date} value={date}>{date.split('-').reverse().join('/')}</option>
                                ))
                            ) : (
                                <option value="">Sem dados</option>
                            )}
                        </select>
                        <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
                    </div>
                </div>

                <div className="h-[250px] w-full">
                    {filteredWorkers.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                />
                                <Bar dataKey="acessos" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 italic">
                            Nenhum registro de acesso para gerar gráfico.
                        </div>
                    )}
                </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
        
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

            {/* Ticket Management (HIDDEN FOR MANAGERS) */}
            {!isManager && (
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
                            offlineCameras.map(cam => {
                                const currentValue = localTickets[cam.uuid] !== undefined ? localTickets[cam.uuid] : (cam.ticket || '');
                                const isDirty = (localTickets[cam.uuid] !== undefined) && (localTickets[cam.uuid] !== (cam.ticket || ''));

                                return (
                                    <div key={cam.uuid} className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate" title={cam.name}>{cam.name}</p>
                                                <p className="text-[10px] text-slate-500 truncate">{cam.location}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20">OFF</span>
                                                <button 
                                                    onClick={() => handleResolveTicket(cam.uuid)}
                                                    className="text-emerald-500 hover:text-emerald-400 p-1 hover:bg-emerald-500/10 rounded transition-colors"
                                                    title="Concluir / Resolver (Voltar para Online)"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 whitespace-nowrap">Chamado:</span>
                                            <input
                                                type="text"
                                                placeholder="Nº..."
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-amber-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-700 transition-colors"
                                                value={currentValue}
                                                onChange={(e) => handleTicketChange(cam.uuid, e.target.value)}
                                            />
                                            {isDirty && (
                                                <button 
                                                    onClick={() => handleSaveTicket(cam.uuid)}
                                                    className="text-blue-500 hover:text-blue-400 p-1 hover:bg-blue-500/10 rounded transition-colors"
                                                    title="Salvar Chamado"
                                                >
                                                    <Save size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

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
                    {whatsAppMessage}
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

            {/* Priority Offline List (VISIBLE TO MANAGERS NOW) */}
            {(camerasOffline > 0) && (
                <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/30 p-0 rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-rose-50 dark:bg-rose-950/20 p-4 border-b border-rose-100 dark:border-rose-900/20 flex justify-between items-center">
                        <h3 className="text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-2">
                            <ShieldAlert size={18} />
                            Câmeras Offline - Prioridade
                        </h3>
                        <span className="text-xs text-rose-600 dark:text-rose-300/60 bg-rose-100 dark:bg-rose-900/20 px-2 py-1 rounded">Ação Necessária</span>
                    </div>
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                
                {/* NEW: Warehouse Status with Actions */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg md:col-span-2 lg:col-span-1">
                    <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-4 flex items-center gap-2">
                        <Warehouse size={18} className="text-indigo-500" />
                        Status por Galpão
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {warehouseList.map((wh: any, idx) => {
                            const isGreen = wh.offline === 0;
                            return (
                                <div key={idx} className="p-3 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate" title={wh.name}>{wh.name}</span>
                                        <span className={`text-xs font-bold ${isGreen ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {wh.online} / {wh.total} ON
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full ${isGreen ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${(wh.online / wh.total) * 100}%` }}></div>
                                    </div>
                                    {!isGreen && isAdmin && onSetWarehouseStatus && (
                                        <button 
                                            onClick={() => handleWarehouseBulkAction(wh.name)}
                                            className="mt-1 w-full py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase rounded border border-emerald-600/20 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Power size={12} /> Ligar Todas
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Module Traffic Light (HIDDEN FOR MANAGERS if desired, but kept for context as it's just stats) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg">
                    <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-4 flex items-center gap-2">
                        <Box size={18} className="text-blue-500" />
                        Análise por Módulo
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
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

                {/* Responsible Breakdown (VISIBLE TO MANAGERS) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-lg md:col-span-2">
                    <h3 className="text-slate-800 dark:text-slate-200 font-semibold mb-4 flex items-center gap-2">
                        <Users size={18} className="text-slate-400" />
                        Status por Responsável
                    </h3>
                    {responsibleList.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                {responsibleList.map((resp: any, idx) => {
                                    const hasPending = resp.offline > 0;
                                    return (
                                    <div key={idx} className="flex justify-between items-center p-3 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
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

export default React.memo(Dashboard);
