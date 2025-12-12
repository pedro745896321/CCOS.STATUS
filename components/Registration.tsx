import React, { useState, useRef, useEffect } from 'react';
import { Camera, AccessPoint, PublicDocument } from '../types';
import { Video, DoorClosed, CheckCircle2, Info, Camera as CameraIcon, Upload, Image as ImageIcon, X, ScanLine, List, FileText, Search, Copy, CheckSquare, Square, Trash2, ClipboardList, Loader2, ArrowDown, AlertTriangle, Table, Settings, Plus, FileBadge, Calendar } from 'lucide-react';

interface RegistrationProps {
  onAddCamera: (cam: Camera) => void;
  onAddAccess: (ap: AccessPoint) => void;
  onAddDocument: (doc: PublicDocument) => void;
  onDeleteDocument: (uuid: string) => void;
  documents?: PublicDocument[];
}

type RegistrationType = 'CAMERA' | 'ACCESS' | 'LIST' | 'DOCUMENT';

// Initial defaults if nothing is in localStorage
const DEFAULT_OPTIONS = {
    responsibles: [
        'MOACIR ANDRADE', 
        'ROBSON DIAS', 
        'EDNEI RODRIGUES', 
        'MAURO BAPTISTA', 
        'JOSENIAS SANTOS', 
        'DANIEL CESAR', 
        'SILVIA SANTOS'
    ],
    contractors: ['MULT-PEDRO', 'MULT-JOAO', 'MULT-MARIA', 'OUTRO'],
    types: ['DIARISTA', 'MENSALISTA', 'VISITANTE', 'MOTORISTA', 'AJUDANTE']
};

const Registration: React.FC<RegistrationProps> = ({ onAddCamera, onAddAccess, onAddDocument, onDeleteDocument, documents = [] }) => {
  const [activeType, setActiveType] = useState<RegistrationType>('LIST'); 
  const [successMsg, setSuccessMsg] = useState('');
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  
  // --- DYNAMIC LISTS STATE ---
  const [customOptions, setCustomOptions] = useState(DEFAULT_OPTIONS);
  const [editingCategory, setEditingCategory] = useState<'responsibles' | 'contractors' | 'types' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // --- CAMERA / ACCESS STATE ---
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- DOCUMENT STATE ---
  const [newDoc, setNewDoc] = useState({ name: '', organ: '', expirationDate: '' });

  // --- LIST PROCESSING STATE ---
  const [rawListText, setRawListText] = useState('');
  const [processedPeople, setProcessedPeople] = useState<any[]>([]);
  const [showTable, setShowTable] = useState(false); // Controls table visibility
  const [cleanMode, setCleanMode] = useState(true); // Default to clean (only numbers)
  
  const [listMetadata, setListMetadata] = useState({
      responsible: '', 
      contractor: '',
      company: 'MULT',
      type: ''
  });
  const [listSearch, setListSearch] = useState('');

  // --- EFFECT: LOAD/SAVE OPTIONS ---
  useEffect(() => {
      const saved = localStorage.getItem('controlvision_registration_options_v2'); 
      if (saved) {
          try {
              setCustomOptions(JSON.parse(saved));
          } catch (e) {
              console.error("Error loading options", e);
          }
      }
  }, []);

  useEffect(() => {
      localStorage.setItem('controlvision_registration_options_v2', JSON.stringify(customOptions));
  }, [customOptions]);

  // Set initial defaults for metadata based on loaded options
  useEffect(() => {
      // If current selection is not in list (deleted), or empty, reset to first available
      if (customOptions.responsibles?.length > 0 && (!listMetadata.responsible || !customOptions.responsibles.includes(listMetadata.responsible))) {
          setListMetadata(prev => ({ ...prev, responsible: customOptions.responsibles[0] }));
      }
      
      if (customOptions.contractors?.length > 0 && (!listMetadata.contractor || !customOptions.contractors.includes(listMetadata.contractor))) {
          setListMetadata(prev => ({ ...prev, contractor: customOptions.contractors[0] }));
      }
      
      if (customOptions.types?.length > 0 && (!listMetadata.type || !customOptions.types.includes(listMetadata.type))) {
          setListMetadata(prev => ({ ...prev, type: customOptions.types[0] }));
      }
  }, [customOptions, listMetadata.responsible, listMetadata.contractor, listMetadata.type]);

  // --- HELPER: LIST MANAGEMENT ---
  const handleAddItem = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingCategory || !newItemName.trim()) return;
      
      const val = newItemName.toUpperCase();
      const currentList = customOptions[editingCategory] || [];
      
      if (currentList.includes(val)) {
          alert("Este item já existe na lista.");
          return;
      }

      setCustomOptions(prev => ({
          ...prev,
          [editingCategory]: [...(prev[editingCategory] || []), val]
      }));
      setNewItemName('');
  };

  const handleDeleteItem = (category: 'responsibles' | 'contractors' | 'types', item: string) => {
      // Removed confirm for faster "delete indeed" action.
      // Direct deletion as requested.
      setCustomOptions(prev => ({
          ...prev,
          [category]: prev[category].filter(i => i !== item)
      }));
  };

  // --- HELPER: CPF VALIDATION ---
  const isValidCPF = (cpf: string): boolean => {
    const strCPF = cpf.replace(/[^\d]+/g, '');
    if (strCPF.length !== 11) return false;
    if (/^(\d)\1+$/.test(strCPF)) return false; 

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) sum = sum + parseInt(strCPF.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;

    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(strCPF.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(strCPF.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;

    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(strCPF.substring(10, 11))) return false;

    return true;
  };

  // --- Handlers for Image Section ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => setSelectedImage(evt.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Não foi possível acessar a câmera.");
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, 640, 480);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setSelectedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- DOCUMENT HANDLER ---
  const handleSaveDocument = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newDoc.name || !newDoc.expirationDate) {
          alert('Preencha o nome e a data de validade.');
          return;
      }
      onAddDocument({
          uuid: `doc-${Date.now()}`,
          name: newDoc.name,
          organ: newDoc.organ || 'Não informado',
          expirationDate: newDoc.expirationDate
      });
      setNewDoc({ name: '', organ: '', expirationDate: '' });
  };

  // --- IMAGE PROCESSING & OCR API ---

  const processImageForAPI = (dataUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 1200;

            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height *= maxSize / width;
                    width = maxSize;
                } else {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Canvas to Blob failed"));
                }
            }, 'image/jpeg', 0.7);
        };
        img.onerror = (e) => reject(e);
        img.src = dataUrl;
    });
  };

  const handleExtractText = async () => {
      if (!selectedImage) {
          alert("Selecione ou capture uma imagem primeiro.");
          return;
      }
      setIsProcessingOCR(true);
      setSuccessMsg('');

      try {
          const imageBlob = await processImageForAPI(selectedImage);
          const formData = new FormData();
          formData.append('apikey', 'K89510033988957');
          formData.append('language', 'por');
          formData.append('isOverlayRequired', 'false');
          formData.append('OCREngine', '2');
          formData.append('file', imageBlob, 'image.jpg');

          const response = await fetch('https://api.ocr.space/parse/image', {
              method: 'POST',
              body: formData,
          });

          const data = await response.json();

          if (data.IsErroredOnProcessing) {
              throw new Error(data.ErrorMessage?.[0] || "Erro desconhecido na API OCR.");
          }

          if (data.ParsedResults && data.ParsedResults.length > 0) {
              const extractedText = data.ParsedResults[0].ParsedText;
              setRawListText(extractedText);
              setSuccessMsg("Texto extraído com sucesso via OCR.Space!");
          } else {
              setSuccessMsg("Nenhum texto identificado na imagem.");
          }

      } catch (error: any) {
          console.error("OCR Error:", error);
          alert(`Falha no OCR: ${error.message || 'Erro de conexão.'}`);
      } finally {
          setIsProcessingOCR(false);
          setTimeout(() => setSuccessMsg(''), 3000);
      }
  };

  // --- Handlers for List Processing ---

  const handleOrganizeList = () => {
      if (!rawListText.trim()) return;
      setShowTable(false);

      const lines = rawListText.split(/\r?\n/);
      const newPeople: any[] = [];
      const cpfRegex = /(\d{3}[\.]?\d{3}[\.]?\d{3}[-]?\d{2})|(\d{11})/;
      const blocklistRegex = /\b(RG|SSP|DATA|NASCIMENTO|MAE|PAI|FILIACAO|CARGO|EMPRESA|ADMISSAO|CPF|NOME|EMAIL|TEL|CEL|CNPJ|PAGINA|PAGE|TOTAL|ASSINATURA|LISTA|PRESENCA|DOCUMENTO)\b/gi;

      lines.forEach((line, idx) => {
          let text = line.trim();
          if (!text) return;

          let cpf = '';
          const cpfMatch = text.match(cpfRegex);
          if (cpfMatch) {
              const rawCpf = cpfMatch[0];
              const digits = rawCpf.replace(/\D/g, '');
              if (digits.length === 11) {
                  cpf = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9,11)}`;
              }
              text = text.replace(rawCpf, '');
          }

          text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '');
          text = text.replace(blocklistRegex, '');
          text = text.replace(/[^a-zA-Z\u00C0-\u00FF\s]/g, ' ');
          let name = text.replace(/\s+/g, ' ').trim();
          name = name.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());

          if (name.length > 3) {
              newPeople.push({
                  id: `p-${Date.now()}-${idx}`,
                  name: name,
                  cpf: cpf || '-',
                  done: false
              });
          }
      });

      setProcessedPeople(newPeople);
      setSuccessMsg(`Informações lançadas para Lista Organizada (${newPeople.length} itens).`);
      setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleGenerateTable = () => {
      if (processedPeople.length === 0) {
          alert("A lista está vazia. Extraia o texto ou organize a lista primeiro.");
          return;
      }
      setShowTable(true);
      setTimeout(() => {
          document.getElementById('generated-table')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  };

  const togglePersonDone = (id: string) => {
      setProcessedPeople(prev => prev.map(p => 
          p.id === id ? { ...p, done: !p.done } : p
      ));
  };

  const deletePerson = (id: string) => {
      setProcessedPeople(prev => prev.filter(p => p.id !== id));
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      setSuccessMsg('Copiado!');
      setTimeout(() => setSuccessMsg(''), 1500);
  };

  const getOrganizedList = () => {
      const activeList = processedPeople.filter(p => !p.done);
      if (activeList.length === 0) return "";
      return activeList
        .map(p => {
             const parts = [p.name];
             if (p.cpf && p.cpf !== '-') parts.push(p.cpf);
             return parts.join(' - ');
        })
        .join('\n');
  };

  const filteredPeople = processedPeople.filter(p => 
      p.name.toLowerCase().includes(listSearch.toLowerCase()) || 
      p.cpf.includes(listSearch)
  );

  const remainingCount = processedPeople.filter(p => !p.done).length;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6 pb-12">
      
      {/* Header with Type Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shadow-lg">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-amber-600`}>
                <ClipboardList size={24} />
            </div>
            Central de Cadastro
        </h2>
        
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
             <button 
                onClick={() => setActiveType('LIST')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeType === 'LIST' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                Listas (OCR)
             </button>
             <button 
                onClick={() => setActiveType('DOCUMENT')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeType === 'DOCUMENT' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                Documentos
             </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3 animate-fade-in shadow-lg sticky top-4 z-50 backdrop-blur-md">
              <CheckCircle2 size={24} />
              <span className="font-medium text-sm">{successMsg}</span>
          </div>
      )}

      {/* --- SECTION: DOCUMENTS --- */}
      {activeType === 'DOCUMENT' && (
          <div className="space-y-6 animate-fade-in">
              {/* Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <FileBadge className="text-blue-500" size={20} />
                      Cadastrar Documento Público
                  </h3>
                  <form onSubmit={handleSaveDocument} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                          <label className="block text-xs text-slate-400 mb-1">Nome do Documento</label>
                          <input 
                            type="text" 
                            placeholder="Ex: AVCB Galpão 1" 
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
                            value={newDoc.name}
                            onChange={(e) => setNewDoc({...newDoc, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-slate-400 mb-1">Órgão Emissor</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Corpo de Bombeiros" 
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
                            value={newDoc.organ}
                            onChange={(e) => setNewDoc({...newDoc, organ: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-slate-400 mb-1">Data de Validade</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm [color-scheme:dark]"
                            value={newDoc.expirationDate}
                            onChange={(e) => setNewDoc({...newDoc, expirationDate: e.target.value})}
                          />
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                          <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex items-center gap-2">
                              <Plus size={18} /> Adicionar
                          </button>
                      </div>
                  </form>
              </div>

              {/* List */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                   <div className="p-4 bg-slate-950/50 border-b border-slate-800">
                       <h3 className="text-sm font-semibold text-slate-300">Documentos Monitorados</h3>
                   </div>
                   {documents.length === 0 ? (
                       <div className="p-8 text-center text-slate-500 text-sm">Nenhum documento cadastrado.</div>
                   ) : (
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                               <tr>
                                   <th className="p-4">Nome</th>
                                   <th className="p-4">Órgão</th>
                                   <th className="p-4">Validade</th>
                                   <th className="p-4 text-right">Ações</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-800/50 text-slate-300">
                               {documents.map((doc) => (
                                   <tr key={doc.uuid} className="hover:bg-slate-800/30">
                                       <td className="p-4 font-medium">{doc.name}</td>
                                       <td className="p-4 text-slate-400">{doc.organ}</td>
                                       <td className="p-4 font-mono">{new Date(doc.expirationDate).toLocaleDateString('pt-BR')}</td>
                                       <td className="p-4 text-right">
                                           <button onClick={() => onDeleteDocument(doc.uuid)} className="text-slate-500 hover:text-rose-500 p-2"><Trash2 size={16} /></button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   )}
              </div>
          </div>
      )}

      {/* --- SECTION: LISTS (OCR) --- */}
      {activeType === 'LIST' && (
          <div className="space-y-6 animate-fade-in">
                {/* OCR CONTENT - Same as before */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
                    <div className="bg-slate-900 px-4 md:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="text-base md:text-lg font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wide">
                            <ScanLine size={18} />
                            1. Registro Visual / OCR
                        </h3>
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Passo 1</div>
                    </div>

                    <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-1">
                            <div className="aspect-square bg-black rounded-lg border-2 border-dashed border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group">
                                {selectedImage ? (
                                    <>
                                        <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button onClick={clearImage} className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-500 transition-colors transform hover:scale-110">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-slate-700 text-center p-4">
                                        <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                                        <span className="text-xs font-medium">Nenhuma imagem selecionada</span>
                                    </div>
                                )}
                                {showCamera && (
                                    <div className="absolute inset-0 bg-black z-20 flex flex-col">
                                        <video ref={videoRef} autoPlay playsInline className="flex-1 w-full h-full object-cover" />
                                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                            <button onClick={stopCamera} className="p-2 bg-rose-600 rounded-full text-white"><X size={20}/></button>
                                            <button onClick={capturePhoto} className="p-2 bg-emerald-600 rounded-full text-white font-bold px-6 flex items-center gap-2">
                                                <CameraIcon size={20}/> Usar Foto
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <canvas ref={canvasRef} width="640" height="480" className="hidden"></canvas>
                            </div>
                        </div>

                        <div className="md:col-span-2 flex flex-col justify-center space-y-5">
                            <div className="bg-slate-900/50 p-4 md:p-6 rounded-xl border border-slate-800 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button type="button" onClick={startCamera} className="flex items-center justify-center gap-3 px-4 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-all group">
                                        <CameraIcon size={20} className="text-amber-400 group-hover:scale-110 transition-transform" />
                                        <div className="text-left">
                                            <span className="block text-sm font-bold">Tirar Foto</span>
                                            <span className="block text-[10px] text-slate-500">Usar Webcam / Câmera</span>
                                        </div>
                                    </button>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-3 px-4 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-all group">
                                        <Upload size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
                                        <div className="text-left">
                                            <span className="block text-sm font-bold">Escolher Arquivo</span>
                                            <span className="block text-[10px] text-slate-500">JPG, PNG</span>
                                        </div>
                                    </button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                                </div>
                                
                                <button 
                                    type="button" 
                                    onClick={handleExtractText}
                                    disabled={isProcessingOCR}
                                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-amber-500 font-bold rounded-lg uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessingOCR ? <Loader2 className="animate-spin" size={18}/> : <ScanLine size={18} />}
                                    {isProcessingOCR ? 'Enviando para OCR...' : 'Processar / Extrair Texto'}
                                </button>
                            </div>
                            <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-900/30 p-3 rounded border border-slate-800/50">
                                <Info size={14} className="shrink-0 mt-0.5" />
                                <p>A imagem será redimensionada (max 1200px) e enviada para o OCR.Space (Engine 2) para melhor reconhecimento de caracteres.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center text-slate-700">
                    <ArrowDown size={32} className="animate-bounce" />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-amber-400 font-bold text-base md:text-lg flex items-center gap-2">
                            <FileText size={20} />
                            2. Texto da Imagem
                        </h3>
                        <button onClick={() => setRawListText('')} className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
                            <Trash2 size={12} /> Limpar
                        </button>
                    </div>
                    <textarea
                        value={rawListText}
                        onChange={(e) => setRawListText(e.target.value)}
                        placeholder="O texto extraído aparecerá aqui..."
                        className="w-full h-32 md:h-48 bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 font-mono text-base md:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                    ></textarea>
                    <div className="flex justify-center mt-4">
                        <button onClick={handleOrganizeList} className="px-6 md:px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-500 font-bold rounded-lg uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all hover:scale-105 text-sm md:text-base">
                            <List size={18} />
                            Organizar para Lista
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="text-amber-400 font-bold text-lg text-center">3. Lista Organizada</h4>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${cleanMode ? 'bg-amber-600 border-amber-600' : 'bg-slate-800 border-slate-600'}`}>
                                        {cleanMode && <CheckSquare size={12} className="text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={cleanMode} onChange={(e) => setCleanMode(e.target.checked)} />
                                    <span className="text-xs font-medium text-slate-400">Modo Limpo (Sem pontos/traços)</span>
                                </label>
                            </div>
                        </div>
                        <textarea 
                            readOnly
                            value={getOrganizedList()}
                            placeholder="Resultado..."
                            className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-400 font-mono text-xs md:text-sm resize-none focus:outline-none"
                        ></textarea>
                        <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4 mt-3">
                            <button onClick={() => copyToClipboard(getOrganizedList())} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                                <Copy size={16} /> Copiar Lista
                            </button>
                            <button onClick={handleGenerateTable} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 rounded-lg text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-transform hover:scale-105">
                                <Table size={16} /> Gerar Tabela
                            </button>
                        </div>
                    </div>
                </div>

                {/* METADATA CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Responsável */}
                    <div className="bg-slate-900 border border-amber-900/30 rounded-xl p-4 shadow-lg flex flex-col gap-3 group relative">
                        <div className="flex items-center justify-between">
                            <label className="text-amber-500 font-bold text-xs uppercase tracking-wider">Responsável:</label>
                            <button onClick={() => setEditingCategory('responsibles')} className="text-slate-600 hover:text-amber-500 transition-colors" title="Editar Lista">
                                <Settings size={14} />
                            </button>
                        </div>
                        <select 
                            value={listMetadata.responsible}
                            onChange={(e) => setListMetadata({...listMetadata, responsible: e.target.value})}
                            className="bg-slate-950 border border-slate-700 rounded-md px-3 py-3 md:py-2 text-white text-base md:text-sm focus:outline-none focus:border-amber-500"
                        >
                            {(customOptions.responsibles || []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <button onClick={() => copyToClipboard(listMetadata.responsible)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-colors">Copiar</button>
                    </div>

                    {/* Empresa/Operador */}
                    <div className="bg-slate-900 border border-amber-900/30 rounded-xl p-4 shadow-lg flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <label className="text-amber-500 font-bold text-xs uppercase tracking-wider">Empresa/Operador:</label>
                            <button onClick={() => setEditingCategory('contractors')} className="text-slate-600 hover:text-amber-500 transition-colors" title="Editar Lista">
                                <Settings size={14} />
                            </button>
                        </div>
                        <select 
                            value={listMetadata.contractor}
                            onChange={(e) => setListMetadata({...listMetadata, contractor: e.target.value})}
                            className="bg-slate-950 border border-slate-700 rounded-md px-3 py-3 md:py-2 text-white text-base md:text-sm focus:outline-none focus:border-amber-500"
                        >
                            {customOptions.contractors.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <button onClick={() => copyToClipboard(listMetadata.contractor)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-colors">Copiar</button>
                    </div>

                    {/* Tipo */}
                    <div className="bg-slate-900 border border-amber-900/30 rounded-xl p-4 shadow-lg flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <label className="text-amber-500 font-bold text-xs uppercase tracking-wider">Tipo:</label>
                            <button onClick={() => setEditingCategory('types')} className="text-slate-600 hover:text-amber-500 transition-colors" title="Editar Lista">
                                <Settings size={14} />
                            </button>
                        </div>
                        <select 
                            value={listMetadata.type}
                            onChange={(e) => setListMetadata({...listMetadata, type: e.target.value})}
                            className="bg-slate-950 border border-slate-700 rounded-md px-3 py-3 md:py-2 text-white text-base md:text-sm focus:outline-none focus:border-amber-500"
                        >
                            {customOptions.types.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <button onClick={() => copyToClipboard(listMetadata.type)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-colors">Copiar</button>
                    </div>
                </div>

                {/* 5. TABLE (Conditional Render) */}
                {showTable && (
                    <div id="generated-table" className="bg-slate-900 border border-slate-800 rounded-xl p-0 shadow-lg overflow-hidden animate-fade-in mt-6">
                        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950/30">
                            <div className="relative w-full sm:w-1/2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <input 
                                    type="text" 
                                    value={listSearch}
                                    onChange={(e) => setListSearch(e.target.value)}
                                    placeholder="Pesquisar nome..."
                                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-base md:text-sm focus:outline-none focus:border-amber-500"
                                />
                            </div>
                            <div className="text-sm font-medium text-slate-400">Restantes: <span className="font-bold text-white text-lg">{remainingCount}</span></div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] text-left text-sm">
                                <thead className="bg-slate-800 text-slate-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="p-3 w-16 text-center">Feito</th>
                                        <th className="p-3">Nome</th>
                                        <th className="p-3 w-48">CPF</th>
                                        <th className="p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                                    {filteredPeople.map((p) => {
                                        const displayCpf = cleanMode ? p.cpf.replace(/[^\d]/g, '') : p.cpf;
                                        const isCpfValid = isValidCPF(p.cpf);
                                        return (
                                            <tr key={p.id} className={`transition-all duration-300 ${p.done ? 'bg-slate-900/80 grayscale opacity-40 line-through' : 'hover:bg-slate-800/30'}`}>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => togglePersonDone(p.id)} className={`p-2 rounded hover:bg-slate-700 transition-colors ${p.done ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                        {p.done ? <CheckSquare size={24} /> : <Square size={24} />}
                                                    </button>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center justify-between group">
                                                        <span className={`font-medium text-base md:text-sm ${p.done ? 'text-slate-500' : 'text-white'}`}>{p.name}</span>
                                                        {!p.done && <button onClick={() => copyToClipboard(p.name)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-all"><Copy size={16} /></button>}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-mono text-sm">
                                                    <div className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-2">
                                                            <span className={p.done ? 'text-slate-500' : 'text-slate-300'}>{displayCpf}</span>
                                                            {(!isCpfValid && p.cpf !== '-' && !p.done) && <div className="text-amber-500" title="CPF Inválido"><AlertTriangle size={16} /></div>}
                                                        </div>
                                                        {!p.done && <button onClick={() => copyToClipboard(displayCpf)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-all"><Copy size={16} /></button>}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => deletePerson(p.id)} className="text-slate-600 hover:text-rose-500 transition-colors p-2"><Trash2 size={18} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredPeople.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-500 text-xs italic">Nenhum registro encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* MODAL: MANAGE LISTS */}
                {editingCategory && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full md:w-[95%] max-w-md p-6">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Settings size={18} className="text-amber-500" />
                                    Gerenciar {editingCategory === 'responsibles' ? 'Responsáveis' : editingCategory === 'contractors' ? 'Empresas' : 'Tipos'}
                                </h3>
                                <button onClick={() => setEditingCategory(null)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                            </div>
                            
                            <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
                                <input type="text" autoFocus value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-3 md:py-2 text-white text-base md:text-sm focus:outline-none focus:border-amber-500" placeholder="Novo item..." />
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"><Plus size={20} /></button>
                            </form>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {(customOptions[editingCategory] || []).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 md:p-2 rounded border border-slate-700/50 group hover:border-slate-600">
                                        <span className="text-sm text-slate-300 font-medium pl-2">{item}</span>
                                        <button onClick={() => handleDeleteItem(editingCategory, item)} className="p-2 md:p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors" title="Excluir Permanentemente">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {(customOptions[editingCategory] || []).length === 0 && <p className="text-center text-slate-500 text-xs py-4 italic">A lista está vazia.</p>}
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                                <button onClick={() => setEditingCategory(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm font-medium">Concluir</button>
                            </div>
                        </div>
                    </div>
                )}
          </div>
      )}
    </div>
  );
};

export default Registration;