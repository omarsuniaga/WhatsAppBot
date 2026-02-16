import { useState, useEffect, useRef } from 'react';
import { Terminal, ScrollText, Trash2, ChevronDown, ChevronRight, Search, Clock, AlertCircle, Info, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { API_URL } from '../../api/client';

interface LogEntry {
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    timestamp: string;
}

export const RealTimeLogMonitor = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState('');
    const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
    const scrollRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, []);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const connect = () => {
        if (eventSourceRef.current) return;

        const url = `${API_URL}/api/triggers/logs`;
        const es = new EventSource(url);

        es.onopen = () => {
            setIsConnected(true);
            addLog({
                level: 'INFO',
                message: '--- Conexión establecida con el servidor de logs ---',
                timestamp: new Date().toISOString()
            });
        };

        es.onmessage = (event) => {
            try {
                const log = JSON.parse(event.data);
                addLog(log);
            } catch (e) {
                console.error('Error parsing log:', e);
            }
        };

        es.onerror = () => {
            setIsConnected(false);
            addLog({
                level: 'ERROR',
                message: 'Error en la conexión de logs. Reintentando...',
                timestamp: new Date().toISOString()
            });
            es.close();
            eventSourceRef.current = null;
            setTimeout(connect, 3000);
        };

        eventSourceRef.current = es;
    };

    const disconnect = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setIsConnected(false);
        }
    };

    const addLog = (log: LogEntry) => {
        setLogs(prev => [...prev.slice(-199), log]); // Keep last 200 logs
    };

    const clearLogs = () => setLogs([]);

    const toggleExpand = (idx: number) => {
        const newSet = new Set(expandedLogs);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setExpandedLogs(newSet);
    };

    const filteredLogs = logs.filter(l =>
        l.message.toLowerCase().includes(filter.toLowerCase()) ||
        l.level.toLowerCase().includes(filter.toLowerCase())
    );

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'text-red-400';
            case 'WARN': return 'text-yellow-400';
            case 'INFO': return 'text-blue-400';
            case 'DEBUG': return 'text-gray-400';
            default: return 'text-green-400';
        }
    };

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'ERROR': return <AlertCircle className="w-3 h-3 text-red-400" />;
            case 'WARN': return <AlertCircle className="w-3 h-3 text-yellow-400" />;
            case 'INFO': return <Info className="w-3 h-3 text-blue-400" />;
            default: return <Zap className="w-3 h-3 text-green-400" />;
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-[#0c0c0c] rounded-xl border border-[#374248] shadow-2xl overflow-hidden font-mono text-sm animate-fade-in">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 bg-[#111b21] border-b border-[#374248]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-[#00a884]" />
                        <span className="text-gray-300 font-bold">Consola de Bot</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-[#182229] border border-[#374248]">
                        <div className={clsx(
                            "w-2 h-2 rounded-full",
                            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                        )} />
                        <span className="text-[10px] text-gray-400 uppercase tracking-tighter">
                            {isConnected ? 'Live' : 'Offline'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Filtrar..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-8 pr-3 py-1 bg-[#202c33] border border-[#374248] rounded text-xs text-gray-300 outline-none focus:border-[#00a884] transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={clsx(
                            "p-1.5 rounded transition-colors",
                            autoScroll ? "bg-[#00a884]/20 text-[#00a884]" : "text-gray-500 hover:bg-white/5"
                        )}
                        title="Auto-scroll"
                    >
                        <ScrollText className="w-4 h-4" />
                    </button>
                    <button
                        onClick={clearLogs}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="Limpiar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Logs Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar"
            >
                {filteredLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                        <Terminal className="w-12 h-12 mb-2" />
                        <p>Esperando mensajes...</p>
                    </div>
                ) : (
                    filteredLogs.map((log, idx) => {
                        const isExpanded = expandedLogs.has(idx);
                        return (
                            <div key={idx} className="group relative hover:bg-white/5 rounded px-2 py-1 transition-colors border-l-2 border-transparent hover:border-white/10">
                                <div className="flex items-start gap-3">
                                    <span className="text-gray-600 text-[10px] pt-1 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                    <div className="flex items-center gap-1.5 pt-1">
                                        {getLevelIcon(log.level)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={clsx(
                                            "break-all whitespace-pre-wrap",
                                            getLevelColor(log.level),
                                            !isExpanded && "line-clamp-2"
                                        )}>
                                            {log.message}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => toggleExpand(idx)}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded text-gray-500 transition-all"
                                    >
                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Status Footer */}
            <div className="px-4 py-2 bg-[#111b21] border-t border-[#374248] flex items-center justify-between text-[10px] text-gray-500">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Uptime: 1h 24m</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Latencia IA: 1.2s</span>
                </div>
                <span>{filteredLogs.length} eventos mostrados</span>
            </div>
        </div>
    );
};
