import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Shield, LayoutDashboard, Video, Settings, Bell, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';

interface OnboardingTourProps {
  role: UserRole;
  onFinish: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ role, onFinish }) => {
  const [step, setStep] = useState(0);

  const isAdmin = role === 'admin';

  const steps = [
    {
      title: "Bem-vindo ao CCOS",
      description: "Este é o seu novo sistema ControlVision. Vamos fazer um tour rápido para você aprender a monitorar e gerenciar sua segurança com eficiência.",
      icon: <Shield size={48} className="text-amber-400" />,
      image: null
    },
    {
      title: "Dashboard Inteligente",
      description: "Na tela inicial, você tem uma visão geral em tempo real. Acompanhe câmeras online/offline, status dos acessos e alertas críticos de prioridade.",
      icon: <LayoutDashboard size={48} className="text-blue-500" />,
    },
    {
      title: "Monitoramento",
      description: "Use as abas 'Câmeras' e 'Acessos' no menu lateral para ver listas detalhadas. Você pode filtrar por galpão, módulo ou status e reportar problemas.",
      icon: <Video size={48} className="text-emerald-500" />,
    },
    isAdmin ? {
      title: "Área Administrativa",
      description: "Como Administrador, você tem acesso exclusivo para Cadastrar novos dispositivos, Gerenciar Usuários e Importar dados via planilha CSV.",
      icon: <Settings size={48} className="text-slate-400" />,
    } : null,
    {
      title: "Notificações e Alertas",
      description: "Fique atento ao ícone de sino no topo. Ele avisará sobre mudanças de status e ações importantes realizadas no sistema.",
      icon: <Bell size={48} className="text-rose-500" />,
    },
    {
      title: "Tudo Pronto!",
      description: "Você está pronto para usar o ControlVision. Se precisar de ajuda, contate o suporte.",
      icon: <CheckCircle2 size={48} className="text-emerald-400" />,
    }
  ].filter(Boolean) as any[]; // Remove nulls

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onFinish();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const currentStepData = steps[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Progress Bar */}
        <div className="h-1 bg-slate-800 w-full">
            <div 
                className="h-full bg-amber-500 transition-all duration-300 ease-out"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            ></div>
        </div>

        {/* Close Button */}
        <button 
            onClick={onFinish}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-2"
        >
            <X size={20} />
        </button>

        <div className="p-8 flex flex-col items-center text-center flex-1">
            <div className="mb-6 p-6 bg-slate-950 rounded-full border border-slate-800 shadow-inner transform transition-all duration-500 hover:scale-110">
                {currentStepData.icon}
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">
                {currentStepData.title}
            </h2>
            
            <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm">
                {currentStepData.description}
            </p>
        </div>

        {/* Footer Navigation */}
        <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
            <div className="flex gap-2">
                {steps.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`w-2 h-2 rounded-full transition-colors ${idx === step ? 'bg-amber-500' : 'bg-slate-800'}`}
                    />
                ))}
            </div>

            <div className="flex gap-3">
                {step > 0 && (
                    <button 
                        onClick={handlePrev}
                        className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Voltar
                    </button>
                )}
                <button 
                    onClick={handleNext}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                >
                    {step === steps.length - 1 ? 'Começar' : 'Próximo'}
                    {step < steps.length - 1 && <ChevronRight size={16} />}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
