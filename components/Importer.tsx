
import React, { useRef, useState } from 'react';
import { FileSpreadsheet, RotateCcw, AlertCircle, Power, Upload, FileUp, Video, DoorClosed, Download, Save } from 'lucide-react';
import { Camera, AccessPoint, Status } from '../types';

interface ImporterProps {
  onImport: (cameras: Camera[], accessPoints: AccessPoint[]) => void;
  onReset: () => void;
  initialCameraCsv?: string;
  initialAccessCsv?: string;
  initialMode?: boolean;
}

// Helper to normalize warehouse names based on content (Moved here)
const normalizeWarehouse = (rawWarehouse: string | null, location: string | null, module: string | null): string => {
    const textToCheck = ((rawWarehouse || '') + ' ' + (location || '') + ' ' + (module || '')).toUpperCase();
    if (textToCheck.includes('MERITI')) return 'UNILOG MERITI';
    if (textToCheck.includes('4ELLOS ES') || textToCheck.includes('4 ELOS ES') || textToCheck.includes('G10')) return 'G4 4ELLOS ES';
    if (textToCheck.includes('ITAPEVI')) return 'SP (ITAPEVI)';
    if (textToCheck.includes('4 ELOS RJ') || textToCheck.includes('ELOS RJ')) return '4 ELOS RJ';
    if (textToCheck.includes('LSP')) return 'LSP';
    if (textToCheck.includes('PAVUNA')) return 'UNILOG PAVUNA';
    if (textToCheck.includes('G3')) return 'G3 MATRIZ';
    if (textToCheck.includes('G2')) return 'G2';
    if (textToCheck.includes('G5') || textToCheck.includes('TERABYTE')) return 'G5';
    const g5Modules = [
        'MODULO 08', 'MODULO 09', 'MODULO 8', 'MODULO 9', 'MODULO 06', 'MODULO 07', 'MODULO 6', 'MODULO 7',
        'MODULO 04', 'MODULO 05', 'MODULO 4', 'MODULO 5', 'MODULO A', 'MODULO B', 'MODULO C', 'MODULO D', 'MODULO E', 'MODULO F'
    ];
    if (g5Modules.some(m => textToCheck.includes(m))) return 'G5';
    return rawWarehouse || 'Geral';
};

const getResponsibleByWarehouse = (warehouse: string, currentResponsible: string | null): string => {
    switch (warehouse) {
        case 'G2': return 'ROBSON DIAS BRITO';
        case 'G3 MATRIZ': return 'EDNEI RODRIGUES SOARES';
        case 'G5': return 'MOACIR ANDRADE NUNES';
        case 'UNILOG PAVUNA': 
        case 'UNILOG MERITI': return 'MAURO BAPTISTA CERQUEIRA';
        case 'SP (ITAPEVI)': return 'JOSENIAS SANTOS NASCIMENTO';
        case '4 ELOS RJ': return 'DANIEL CESAR MACHADO';
        case 'G4 4ELLOS ES': return 'SILVIA SANTOS';
        default: return currentResponsible || 'N/A';
    }
};

const parseCSV = (csv: string, type: 'camera' | 'access'): any[] => {
  if (!csv) return [];
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return []; 
  const headers = lines[0].split(',').map(h => h.trim());
  const getValue = (rowObj: any, possibleHeaders: string[]) => {
    const key = Object.keys(rowObj).find(k => 
      possibleHeaders.some(h => k.toUpperCase() === h.toUpperCase())
    );
    return key ? rowObj[key] : null;
  };

  return lines.slice(1).map((line, idx) => {
    if (!line.trim()) return null;
    const uuid = `${type}-${idx}-${Date.now()}`;
    const values = line.split(','); 
    const obj: any = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/["\r]/g, '').trim();
      const cleanValue = values[index]?.replace(/["\r]/g, '').trim();
      obj[cleanHeader] = cleanValue;
    });

    if (type === 'camera') {
      const name = getValue(obj, ['Nome do Canal', 'NOME', 'Nome_Camera', 'Nome', 'Camera']);
      const id = getValue(obj, ['IP do Dispositivo', 'ID_Camera', 'ID', 'Codigo', 'Número']);
      const location = getValue(obj, ['Nome org', 'Localização', 'Localizacao', 'Local']);
      const module = getValue(obj, ['Nome do dispositivo', 'MODULO', 'Módulo', 'Modulo', 'Setor']);
      let warehouseRaw = getValue(obj, ['Galpão', 'Galpao', 'Warehouse']);
      const warehouse = normalizeWarehouse(warehouseRaw, location, module);
      const responsibleRaw = getValue(obj, ['Responsável', 'Responsavel', 'Resp', 'Tecnico']);
      const responsible = getResponsibleByWarehouse(warehouse, responsibleRaw);
      const statusRaw = getValue(obj, ['Canal on-line/off-line', 'Status ONLINE', 'Status', 'Status OFFLINE', 'STATUS', 'Estado', 'SITUACAO'])?.toUpperCase() || '';
      let status: Status = 'ONLINE';
      const offlineKeywords = ['OFFLINE', 'OFF', 'SEM SINAL', 'NO SIGNAL', 'ERRO', 'FALHA', 'DESLIGADO', 'INATIVO', '0', 'FALSE', 'NAO', 'NO', 'PERDA'];
      if (offlineKeywords.some(k => statusRaw.includes(k))) status = 'OFFLINE';
      if (!name) return null;
      return { uuid, id: id || 'N/A', name: name || 'Sem Nome', location: location || 'N/A', module: module || 'Geral', warehouse, responsible, status } as Camera;
    } else {
      const name = getValue(obj, ['Nome do dispositivo', 'Nome', 'Name', 'Dispositivo', 'Equipamento']);
      const id = getValue(obj, ['IP', 'ID', 'Id', 'Cod', 'Código', 'Serial']);
      const location = getValue(obj, ['Nome org', 'Local', 'Location', 'Localização', 'Setor']);
      let warehouseRaw = getValue(obj, ['Galpão', 'Galpao', 'Warehouse']);
      const lastLog = getValue(obj, ['Última alteraçãoStatus', 'UltimoRegistro', 'LastLog', 'Data']);
      if (!name && !id) return null;
      const finalName = name || id || 'Dispositivo Sem Nome';
      const finalId = id || finalName; 
      const warehouse = normalizeWarehouse(warehouseRaw, location, null);
      const statusRaw = getValue(obj, ['Status On-line/Off-line', 'Status', 'STATUS', 'Estado', 'Situação', 'Conexão'])?.toUpperCase() || '';
      let status: Status = 'ONLINE';
      const offlineKeywords = ['OFFLINE', 'OFF', 'INATIVO', 'DESLIGADO', 'FALHA', 'ERRO', 'ERROR', 'DOWN', 'DISCONNECTED', '0', 'FALSE', 'NAO', 'NÃO', 'RUIM', 'PARADO'];
      if (offlineKeywords.some(k => statusRaw === k || statusRaw.includes(k))) status = 'OFFLINE';
      return { uuid, id: finalId, name: finalName, type: 'Controle de Acesso', location: location || 'N/A', warehouse, status, lastLog: lastLog || '-', latency: '-' } as AccessPoint;
    }
  }).filter(Boolean);
};

const Importer: React.FC<ImporterProps> = ({ onImport, onReset, initialCameraCsv = '', initialAccessCsv = '', initialMode = false }) => {
  const [cameraCsv, setCameraCsv] = useState(initialCameraCsv);
  const [accessCsv, setAccessCsv] = useState(initialAccessCsv);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const accessInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'camera' | 'access') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (window.XLSX) {
        const wb = window.XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = window.XLSX.utils.sheet_to_csv(ws);
        
        if (type === 'camera') setCameraCsv(data);
        else setAccessCsv(data);
      } else {
        alert('Biblioteca XLSX não carregada. Recarregue a página.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleDownload = (content: string, filename: string) => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcess = () => {
      if (!cameraCsv && !accessCsv) {
          alert("Por favor, forneça pelo menos uma fonte de dados.");
          return;
      }
      
      const cameras = parseCSV(cameraCsv, 'camera');
      const access = parseCSV(accessCsv, 'access');

      if (cameras.length === 0 && access.length === 0) {
          alert("Nenhum dado válido encontrado. Verifique o formato do CSV.");
          return;
      }

      onImport(cameras, access);
  };

  return (
    <div className={`space-y-6 animate-fade-in mx-auto pb-8 ${initialMode ? 'p-8 max-w-4xl pt-12' : 'max-w-5xl'}`}>
        
        {/* Header Control */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                    <Power size={24} className="text-emerald-500" />
                    Fonte de Dados
                </h2>
                <p className="text-slate-400 text-sm">Gerencie a conexão das planilhas (Importação em Massa).</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                <button 
                    onClick={handleProcess}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 transition-all font-bold"
                >
                    <Save size={18} /> 
                    PROCESSAR E SALVAR
                </button>

                {!initialMode && (
                    <button 
                        onClick={onReset}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors text-sm font-medium whitespace-nowrap"
                    >
                        <RotateCcw size={16} /> Limpar
                    </button>
                )}
            </div>
        </div>

        {/* Upload Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Cameras */}
            <div>
                 <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    ref={cameraInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'camera')}
                />
                <button 
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full h-full bg-slate-900 border-2 border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all rounded-xl p-6 flex flex-col items-center justify-center gap-3 group cursor-pointer min-h-[160px]"
                >
                    <div className="p-4 bg-slate-800 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                        <Video className="w-8 h-8 text-slate-400 group-hover:text-emerald-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                            Câmeras
                        </h3>
                        <p className="text-slate-500 text-xs mt-1">
                            Carregar planilha (.xlsx/.csv)
                        </p>
                    </div>
                </button>
            </div>

            {/* Access Control */}
            <div>
                 <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    ref={accessInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'access')}
                />
                <button 
                    onClick={() => accessInputRef.current?.click()}
                    className="w-full h-full bg-slate-900 border-2 border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all rounded-xl p-6 flex flex-col items-center justify-center gap-3 group cursor-pointer min-h-[160px]"
                >
                    <div className="p-4 bg-slate-800 rounded-full group-hover:bg-blue-500/20 transition-colors">
                        <DoorClosed className="w-8 h-8 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                            Controle de Acesso
                        </h3>
                        <p className="text-slate-500 text-xs mt-1">
                            Carregar planilha (.xlsx/.csv)
                        </p>
                    </div>
                </button>
            </div>

        </div>

        <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-lg flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-200/80">
                <p className="font-semibold mb-1 text-blue-400">Edição de Dados em Massa</p>
                <p>Cole o conteúdo CSV abaixo e clique em "Processar e Salvar" para atualizar o sistema.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Camera Data Input */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-slate-200 font-medium">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                        CSV Câmeras
                    </label>
                </div>
                <div className="relative group">
                    <textarea 
                        value={cameraCsv}
                        onChange={(e) => setCameraCsv(e.target.value)}
                        placeholder="ID_Camera,Nome_Camera,Localização,Módulo,Responsável,Status..."
                        className="w-full h-96 bg-slate-900 border border-slate-700 rounded-xl p-4 font-mono text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                        spellCheck={false}
                    />
                </div>
            </div>

            {/* Access Data Input */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-slate-200 font-medium">
                        <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                        CSV Acessos
                    </label>
                </div>
                <div className="relative group">
                    <textarea 
                        value={accessCsv}
                        onChange={(e) => setAccessCsv(e.target.value)}
                        placeholder="ID,Nome,Tipo,Local,Status,UltimoRegistro..."
                        className="w-full h-96 bg-slate-900 border border-slate-700 rounded-xl p-4 font-mono text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                        spellCheck={false}
                    />
                </div>
            </div>
        </div>
    </div>
  );
};

export default Importer;
