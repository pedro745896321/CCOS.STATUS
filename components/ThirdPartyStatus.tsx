
import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileSpreadsheet, Filter, Search, X, Users, Briefcase, MapPin, Clock, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { ProcessedWorker } from '../types';

// --- CONFIGURAÇÃO ---

const VALID_COMPANIES = ['B11', 'MULT', 'MPI', 'FORMA', 'SUPERA LOG', 'MJM', 'PRIMUS', 'PRAYLOG'];

const VALID_UNITS = [
    { 
        id: 'GALPÃO G2', 
        keywords: [
            'G2', 'G202', 'G210', 'G211', 'G205', 
            'G2 TORNIQUETE', 'CATRACA G2', 'G2-G210LF', 'G202LF', 'G211LF', 'G205LF'
        ] 
    },
    { 
        id: 'GALPÃO G3 / MATRIZ', 
        keywords: [
            'G3', 'MATRIZ', 'CORPORATIVO', 'RECEPÇÃO', 'RECEPCAO', 
            'G314', 'G312', 'G314LF', 'G312LF'
        ],
        // REGRA DE EXCLUSÃO: Se tiver LSP no nome, NÃO É G3 (mesmo que tenha keywords do G3)
        exclude: ['LSP']
    },
    { 
        id: 'GALPÃO G5 (MD6)', 
        keywords: [
            'G5', 'MD6', 'MD 6', 'TERABYTE', 
            'G523', 'G512', 'G522', 'G520', 
            'G523LF', 'G512LF', 'G522LF', 'G520LF', 'CONTROLE DE ACESSO MD 6'
        ] 
    },
    { 
        id: 'UNIDADE SP-IP', 
        keywords: [
            'SP-IP', 'SP IP', 'ITAPEVI', 'SP - IP', 
            'SP-IP01', 'SP-IP03', 'SP-IP02', 'SP-IP05',
            'SP-IP01LF', 'SP-IP03LF', 'SP-IP02LF', 'SP-IP05LF'
        ] 
    },
    { 
        id: 'EXPRESSA SJM', 
        keywords: [
            'SJM', 'EXPRESSA', 'SÃO JOSÉ', 'SAO JOSE', 'LATERAL', 'SJ', 'SJC',
            'EXPRESSA-SJM08LF', 'EXPRESSA-SJM10LF', 'LATERAL-SJM15LF'
        ] 
    },
    { 
        id: 'PAVUNA', 
        keywords: [
            'PAVUNA', 'PV', 'PV02', 'PV02LF', 'PAVUNA-PV02LF'
        ] 
    },
    { 
        id: 'GALPÃO 4 ELOS', 
        keywords: ['4 ELOS', '4ELOS', '4ELLOS', 'GA-G4', 'G4'] 
    },
    { 
        id: 'GALPÃO LSP', 
        keywords: ['LSP', 'LSP01', 'LSP02', 'LSP01LF', 'LSP02LF'] 
    },
    {
        id: 'MERITI',
        keywords: ['MERITI', 'UNILOG MERITI']
    }
];

interface RawRow {
    'Tipo de evento'?: string;
    'Eventos'?: string;
    'Hora'?: string;
    'Data'?: string;
    'Date'?: string;
    'Ambiente'?: string;
    'Ponto de Acesso'?: string;
    'Tipo de ponto de acesso'?: string;
    'Pessoa'?: string;
    'ID'?: string;
    'Grupo de pessoas'?: string;
    'Status de Entrada/Saída'?: string;
    [key: string]: any;
}

interface UnitStats {
    id: string;
    total: number;
    byCompany: { [key: string]: number };
    workers: ProcessedWorker[];
}

interface ThirdPartyStatusProps {
    workers?: ProcessedWorker[];
    setWorkers?: (workers: ProcessedWorker[]) => void;
}

const ThirdPartyStatus: React.FC<ThirdPartyStatusProps> = ({ workers = [], setWorkers }) => {
    // Note: 'workers' is now passed from App.tsx. 
    // We compute available dates from it.
    
    // UI State
    const [fileName, setFileName] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

    // Filters
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
    const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Derived Available Dates from workers
    const availableDates = useMemo(() => {
        const datesSet = new Set<string>();
        workers.forEach(w => {
            if (w.date && w.date !== 'N/A') datesSet.add(w.date);
        });
        return Array.from(datesSet).sort().reverse();
    }, [workers]);

    // Update selectedDate default if not set
    if (!selectedDate && availableDates.length > 0) {
        setSelectedDate(availableDates[0]);
    }

    // --- LOGIC: DATE PARSING ---
    const parseRowDate = (row: any): string => {
        let val = row['Data'] || row['DATA'] || row['Date'] || row['Dia'];
        
        // Fallback: Tenta extrair data da coluna Hora se ela contiver data/hora conjugadas
        if (!val && row['Hora'] && typeof row['Hora'] === 'string' && row['Hora'].length > 10) {
            val = row['Hora'];
        }
        
        if (!val) return 'N/A';

        // Caso Excel Serial Date (Número)
        if (typeof val === 'number') {
            const d = new Date(Math.round((val - 25569)*86400*1000));
            d.setMinutes(d.getMinutes() + 1); // Ajuste fino para evitar erro de arredondamento
            return d.toISOString().split('T')[0];
        }

        // Caso String
        if (typeof val === 'string') {
            let datePart = val.split(' ')[0].trim();
            // Formato PT-BR dd/mm/yyyy
            if (datePart.includes('/')) {
                const parts = datePart.split('/');
                if (parts.length === 3) {
                    return `${parts[2]}-${parts[1]}-${parts[0]}`; // Retorna YYYY-MM-DD
                }
            }
            // Formato ISO yyyy-mm-dd
            if (datePart.includes('-')) return datePart;
        }
        
        return 'N/A';
    };

    // --- LOGIC: DETECTION ---

    const detectCompany = (text: string): string | null => {
        if (!text) return null;
        const upper = text.toUpperCase();
        
        // 1. PRAYLOG
        if (upper.includes('PRAYLOG') || upper.includes('PRAY LOG')) return 'PRAYLOG';
        
        // 2. SUPERA LOG
        if (upper.includes('SUPERA LOG') || upper.includes('SUPERA')) return 'SUPERA LOG';
        
        // 3. MPI
        // Captura "MPI SERVIÇOS", "MPI"
        if (upper.includes('MPI')) return 'MPI';
        
        // 4. B11
        // Captura "B11", "B11 BLACK FRIDAY"
        if (upper.includes('B11')) return 'B11';
        
        // 5. MJM
        // Captura "MJM", "MJM_BLACK"
        if (upper.includes('MJM')) return 'MJM';
        
        // 6. PRIMUS
        // Captura "PRIMUS", "PRIMUS - LIMPEZA"
        if (upper.includes('PRIMUS')) return 'PRIMUS';
        
        // 7. FORMA
        if (upper.includes('FORMA')) return 'FORMA';
        
        // 8. MULT
        // Captura "MULT", "MULT_BLACK", "TERC - MULTI"
        if (upper.includes('MULT')) return 'MULT';

        return null;
    };

    const detectUnit = (text: string): string | null => {
        if (!text) return null;
        const upper = text.toUpperCase();

        for (const unit of VALID_UNITS) {
            // VERIFICAÇÃO DE EXCLUSÃO
            // Se a unidade tiver uma lista 'exclude' e o texto contiver algum termo proibido, PULA essa unidade.
            if ((unit as any).exclude && (unit as any).exclude.some((exc: string) => upper.includes(exc))) {
                continue;
            }

            if (unit.keywords.some(k => upper.includes(k))) {
                return unit.id;
            }
        }
        return null;
    };

    const processFile = (file: File) => {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const bstr = e.target?.result;
            if (window.XLSX) {
                const wb = window.XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData: RawRow[] = window.XLSX.utils.sheet_to_json(ws);
                analyzeData(jsonData);
            } else {
                alert("Biblioteca XLSX não carregada.");
            }
            setLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    const analyzeData = (rows: RawRow[]) => {
        const newWorkers: ProcessedWorker[] = [];

        rows.forEach((row, index) => {
            // 1. Check Event Type (Ignorar Saída)
            const eventType = (row['Tipo de evento'] || row['Eventos'] || '').toUpperCase();
            const status = (row['Status de Entrada/Saída'] || '').toUpperCase();

            // Lógica de Entrada: Se for "Entrada", "Desbloqueio", "Acesso Liberado"
            const isEntry = 
                eventType.includes('ENTRADA') || 
                eventType.includes('DESBLOQUEIO') || 
                eventType.includes('ACESSO LIBERADO') ||
                status.includes('ENTRADA');

            if (!isEntry) return;
            // Garantia extra para não pegar saídas explicitas
            if (eventType.includes('SAÍDA') || eventType.includes('SAIDA')) return;

            // Concatenar campos chaves para busca da UNIDADE e EMPRESA
            // Adicionamos 'Pessoa' aqui também caso a empresa esteja no nome da pessoa (ex: TERC - MULTI - JOAO)
            const searchString = [
                row['Ambiente'],
                row['Ponto de Acesso'],
                row['Grupo de pessoas'],
                row['Tipo de ponto de acesso'],
                row['Pessoa'],
                row['Nome']
            ].join(' ').toUpperCase();

            // 2. Detect Company
            const company = detectCompany(searchString);
            if (!company) return; 

            // 3. Detect Unit
            const unit = detectUnit(searchString);
            if (!unit) return;

            // 4. Extract Date
            const dateNormalized = parseRowDate(row);

            // 5. Extract Time (Hora) - Tenta pegar só HH:MM
            let timeStr = row['Hora'] || '-';
            if (timeStr.includes(' ')) timeStr = timeStr.split(' ')[1]; 

            newWorkers.push({
                id: `w-${index}`,
                name: row['Pessoa'] || row['Nome'] || 'Desconhecido',
                company,
                unit,
                date: dateNormalized,
                time: timeStr,
                accessPoint: row['Ponto de Acesso'] || row['Ambiente'] || '-',
                eventType: eventType
            });
        });

        if (setWorkers) {
            setWorkers(newWorkers);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            processFile(file);
        }
    };

    // --- AGGREGATION & FILTER LOGIC (Memoized) ---
    
    const stats = useMemo(() => {
        // 1. Initial Filtering by UI controls
        const filtered = workers.filter(w => {
            // Date Filter
            if (selectedDate && w.date !== 'N/A' && w.date !== selectedDate) return false;
            // Unit Filter (Global)
            if (selectedUnit !== 'ALL' && w.unit !== selectedUnit) return false;
            return true;
        });

        // 2. Aggregation with Unique Headcount Logic
        const statsMap: { [key: string]: UnitStats } = {};
        const uniqueWorkerSet = new Set<string>(); // Tracks duplicates
        
        // Init valid units structure
        VALID_UNITS.forEach(u => {
            statsMap[u.id] = { id: u.id, total: 0, byCompany: {}, workers: [] };
            VALID_COMPANIES.forEach(c => statsMap[u.id].byCompany[c] = 0);
        });

        // Populate stats
        filtered.forEach(w => {
            // Create a unique key for the person within the context of Date + Unit
            // Key format: "DATE-UNIT-NAME-COMPANY"
            // If "selectedDate" is empty (All dates), this key ensures we count unique people PER DAY.
            // Example: Joao on 2023-10-01 is one count. Joao on 2023-10-02 is another count.
            const uniqueKey = `${w.date}-${w.unit}-${w.name.trim().toUpperCase()}-${w.company}`;

            if (!uniqueWorkerSet.has(uniqueKey)) {
                uniqueWorkerSet.add(uniqueKey); // Mark as seen

                if (statsMap[w.unit]) {
                    statsMap[w.unit].total++;
                    statsMap[w.unit].byCompany[w.company] = (statsMap[w.unit].byCompany[w.company] || 0) + 1;
                    statsMap[w.unit].workers.push(w); // Push only the first occurrence (entry)
                }
            }
        });

        // Return sorted active units (only those that match global unit filter, essentially handled by logic above, but cleaner list return)
        return Object.values(statsMap)
            .filter(u => selectedUnit === 'ALL' || u.id === selectedUnit)
            .sort((a, b) => b.total - a.total);

    }, [workers, selectedDate, selectedUnit]);

    // Secondary Filter for Detail Table (Search & Company)
    const getDetailTableWorkers = (unitStats: UnitStats) => {
        return unitStats.workers.filter(w => {
            const matchesCompany = selectedCompany === 'ALL' || w.company === selectedCompany;
            const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCompany && matchesSearch;
        });
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto p-6">
            
            {/* Header & Upload */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="text-amber-500" />
                        Status dos Terceirizados
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Contagem de pessoas únicas (headcount) por dia e unidade.
                    </p>
                </div>

                <div className="w-full md:w-auto flex flex-col items-end gap-2">
                    <input 
                        type="file" 
                        accept=".xlsx, .csv" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileUpload} 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-lg shadow-blue-900/30 w-full md:w-auto justify-center"
                    >
                        {loading ? 'Processando...' : <><Upload size={20} /> Carregar Planilha</>}
                    </button>
                    {fileName && <span className="text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-1"><FileSpreadsheet size={12}/> {fileName}</span>}
                </div>
            </div>

            {workers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-100 dark:bg-slate-900/50 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-center">
                    <Briefcase size={48} className="text-slate-400 dark:text-slate-600 mb-4" />
                    <h3 className="text-slate-700 dark:text-slate-300 font-bold text-lg">Nenhum dado carregado</h3>
                    <p className="text-slate-500 text-sm max-w-md mt-2">
                        Faça o upload da planilha de eventos para visualizar o relatório.
                    </p>
                </div>
            ) : (
                <>
                    {/* Filters Bar */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                                placeholder="Buscar por nome do colaborador..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                             {/* Date Filter */}
                             <div className="relative">
                                <select 
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full sm:w-auto pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-300 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer min-w-[160px]"
                                    disabled={availableDates.length === 0}
                                >
                                    <option value="">Todas Datas</option>
                                    {availableDates.map(d => (
                                        <option key={d} value={d}>{d.split('-').reverse().join('/')}</option>
                                    ))}
                                </select>
                                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={14} />
                            </div>

                             {/* Unit Filter */}
                            <div className="relative">
                                <select 
                                    value={selectedUnit}
                                    onChange={(e) => setSelectedUnit(e.target.value)}
                                    className="w-full sm:w-auto pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-300 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer min-w-[150px]"
                                >
                                    <option value="ALL">Todas Unidades</option>
                                    {VALID_UNITS.map(u => (
                                        <option key={u.id} value={u.id}>{u.id}</option>
                                    ))}
                                </select>
                                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={14} />
                            </div>

                            {/* Company Filter */}
                            <div className="relative">
                                <select 
                                    value={selectedCompany}
                                    onChange={(e) => setSelectedCompany(e.target.value)}
                                    className="w-full sm:w-auto pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-300 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer min-w-[150px]"
                                >
                                    <option value="ALL">Todas Empresas</option>
                                    {VALID_COMPANIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={14} />
                            </div>
                        </div>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {stats.map((unit) => (
                            <div key={unit.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                        <MapPin size={18} className="text-emerald-500" />
                                        {unit.id}
                                    </h3>
                                    <div className="flex flex-col items-end">
                                        <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold shadow-lg">
                                            {unit.total} Pessoas
                                        </span>
                                        {selectedDate && <span className="text-[10px] text-slate-500 mt-1">{selectedDate.split('-').reverse().join('/')}</span>}
                                    </div>
                                </div>
                                
                                <div className="p-5 flex-1">
                                    <div className="space-y-3">
                                        {Object.entries(unit.byCompany)
                                            .filter(([_, count]) => (count as number) > 0)
                                            .sort((a, b) => (b[1] as number) - (a[1] as number))
                                            .map(([company, count]) => (
                                                <div key={company} className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-600 dark:text-slate-400 font-medium">{company}</span>
                                                    <span className="text-slate-800 dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                        {count as number}
                                                    </span>
                                                </div>
                                            ))
                                        }
                                        {unit.total === 0 && (
                                            <p className="text-slate-500 text-xs italic text-center py-4">Nenhum registro encontrado para esta data/filtro.</p>
                                        )}
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
                                    className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium border-t border-slate-200 dark:border-slate-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    {expandedUnit === unit.id ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                                    {expandedUnit === unit.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </button>
                            </div>
                        ))}
                        {stats.length === 0 && selectedUnit !== 'ALL' && (
                             <div className="col-span-full py-10 text-center text-slate-500 italic">
                                 A unidade selecionada não possui registros para os filtros atuais.
                             </div>
                        )}
                    </div>

                    {/* Expanded Details Table */}
                    {expandedUnit && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xl animate-fade-in scroll-mt-6" id="details-section">
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Briefcase className="text-blue-500" />
                                    Detalhes: {expandedUnit}
                                    {selectedDate && <span className="text-sm font-normal text-slate-500 ml-2">({selectedDate.split('-').reverse().join('/')})</span>}
                                </h3>
                                <button onClick={() => setExpandedUnit(null)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white"><X size={20}/></button>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs uppercase sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-4">Data</th>
                                            <th className="p-4">Nome</th>
                                            <th className="p-4">Empresa</th>
                                            <th className="p-4">Chegada</th>
                                            <th className="p-4">Ponto de Acesso</th>
                                            <th className="p-4">Evento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
                                        {getDetailTableWorkers(stats.find(s => s.id === expandedUnit)!).map((worker) => (
                                            <tr key={worker.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="p-4 font-mono text-slate-500 text-xs">
                                                    {worker.date !== 'N/A' ? worker.date.split('-').reverse().join('/') : '-'}
                                                </td>
                                                <td className="p-4 font-medium text-slate-900 dark:text-white">{worker.name}</td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        {worker.company}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-emerald-500 dark:text-emerald-400 flex items-center gap-2">
                                                    <Clock size={14}/> {worker.time}
                                                </td>
                                                <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">{worker.accessPoint}</td>
                                                <td className="p-4 text-xs">
                                                    {worker.eventType.includes('DESBLOQUEIO') ? 
                                                        <span className="text-blue-500 dark:text-blue-400">Desbloqueio Facial</span> : 
                                                        <span className="text-emerald-500">Entrada</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                        {getDetailTableWorkers(stats.find(s => s.id === expandedUnit)!).length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                                                    Nenhum colaborador encontrado com os filtros atuais.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ThirdPartyStatus;
