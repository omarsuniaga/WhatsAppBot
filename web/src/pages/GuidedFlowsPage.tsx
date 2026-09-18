/**
 * GuidedFlowsPage - Fase B of docs/SPEC_CONVERSACION_GUIADA.md
 * Dashboard editor to create/edit/activate configurable "target topic"
 * flows (section 5 of the spec), without touching code.
 */
import { useState, useEffect } from 'react';
import { Workflow, Plus, Edit2, Trash2, Power, PowerOff, Loader2, X, Save } from 'lucide-react';
import { guidedFlowApi } from '../api/client';

type RelationType = 'cliente_hotel' | 'amigo' | 'alumno' | 'institucional' | 'desconocido';

interface GuidedFlow {
    id: string;
    label: string;
    appliesToRelationTypes: RelationType[];
    triggerIntents: string[];
    guidingQuestions: string[];
    successCondition: { requiredEntities: string[]; onSuccess: string };
    abandonCondition: { silenceHours: number; onAbandon: string };
    tone: string;
    active: boolean;
}

const relationOptions: RelationType[] = ['cliente_hotel', 'amigo', 'alumno', 'institucional', 'desconocido'];

const emptyFlow = (): Omit<GuidedFlow, 'id'> & { id: string } => ({
    id: '',
    label: '',
    appliesToRelationTypes: [],
    triggerIntents: [],
    guidingQuestions: [''],
    successCondition: { requiredEntities: [], onSuccess: 'crear_cita_propuesta' },
    abandonCondition: { silenceHours: 48, onAbandon: 'sugerir_seguimiento' },
    tone: 'profesional_cordial',
    active: true
});

const csv = (arr: string[]) => arr.join(', ');
const fromCsv = (value: string) => value.split(',').map(v => v.trim()).filter(Boolean);

export const GuidedFlowsPage = () => {
    const [flows, setFlows] = useState<GuidedFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<(Omit<GuidedFlow, 'id'> & { id: string }) | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadFlows();
    }, []);

    const loadFlows = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await guidedFlowApi.getAll();
            if (response.data.success) setFlows(response.data.data || []);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditing(emptyFlow());
        setIsNew(true);
    };

    const openEdit = (flow: GuidedFlow) => {
        setEditing({ ...flow });
        setIsNew(false);
    };

    const handleSave = async () => {
        if (!editing) return;
        setIsSaving(true);
        try {
            if (isNew) {
                await guidedFlowApi.create(editing);
            } else {
                await guidedFlowApi.update(editing.id, editing);
            }
            setEditing(null);
            await loadFlows();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (flow: GuidedFlow) => {
        try {
            await guidedFlowApi.toggleActive(flow.id, !flow.active);
            await loadFlows();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este flujo guiado?')) return;
        try {
            await guidedFlowApi.delete(id);
            await loadFlows();
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const toggleRelation = (rt: RelationType) => {
        if (!editing) return;
        const has = editing.appliesToRelationTypes.includes(rt);
        setEditing({
            ...editing,
            appliesToRelationTypes: has
                ? editing.appliesToRelationTypes.filter(r => r !== rt)
                : [...editing.appliesToRelationTypes, rt]
        });
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Workflow className="w-6 h-6 text-[#00a884]" />
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800 dark:text-[#e9edef]">Flujos Guiados</h1>
                        <p className="text-sm text-gray-500 dark:text-[#8696a0]">
                            Temas objetivo configurables hacia los que el bot guía la conversación (Fase B)
                        </p>
                    </div>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00a884] text-white rounded-lg text-sm font-medium hover:bg-[#06cf9c] transition-colors"
                >
                    <Plus className="w-4 h-4" /> Nuevo flujo
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                </div>
            ) : error ? (
                <p className="text-red-500 text-sm">{error}</p>
            ) : flows.length === 0 ? (
                <p className="text-gray-500 dark:text-[#8696a0] text-sm">
                    Sin flujos configurados todavía. Crea uno para empezar a guiar conversaciones hacia un objetivo (ej. cotización de evento).
                </p>
            ) : (
                <div className="space-y-3">
                    {flows.map(flow => (
                        <div
                            key={flow.id}
                            className="p-4 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-[#374248] rounded-lg"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-medium text-gray-800 dark:text-[#e9edef]">{flow.label}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${flow.active ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-gray-200 dark:bg-[#374248] text-gray-500 dark:text-[#8696a0]'}`}>
                                            {flow.active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-[#8696a0] mt-1">
                                        id: {flow.id} · dispara con: {csv(flow.triggerIntents) || '(sin intents)'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-[#8696a0]">
                                        aplica a: {flow.appliesToRelationTypes.length ? csv(flow.appliesToRelationTypes) : 'cualquier relación'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleToggle(flow)}
                                        title={flow.active ? 'Desactivar' : 'Activar'}
                                        className="p-2 text-gray-500 dark:text-[#aebac1] hover:bg-gray-100 dark:hover:bg-[#374248] rounded-full transition-colors"
                                    >
                                        {flow.active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => openEdit(flow)}
                                        title="Editar"
                                        className="p-2 text-gray-500 dark:text-[#aebac1] hover:bg-gray-100 dark:hover:bg-[#374248] rounded-full transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(flow.id)}
                                        title="Eliminar"
                                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#202c33] rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#374248]">
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-[#e9edef]">
                                {isNew ? 'Nuevo flujo guiado' : `Editar: ${editing.label}`}
                            </h2>
                            <button onClick={() => setEditing(null)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#374248] rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
                            {isNew && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">id (único, minúsculas, sin espacios)</label>
                                    <input
                                        type="text"
                                        value={editing.id}
                                        onChange={e => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                        placeholder="cotizacion_evento_hotelero"
                                        className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef]"
                                    />
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">Nombre</label>
                                <input
                                    type="text"
                                    value={editing.label}
                                    onChange={e => setEditing({ ...editing, label: e.target.value })}
                                    placeholder="Cotización de evento en hotel"
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef]"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">Aplica a tipos de relación</label>
                                <div className="flex flex-wrap gap-2">
                                    {relationOptions.map(rt => (
                                        <button
                                            key={rt}
                                            onClick={() => toggleRelation(rt)}
                                            className={`px-2 py-1 rounded-full text-xs border ${editing.appliesToRelationTypes.includes(rt)
                                                ? 'bg-[#00a884]/20 border-[#00a884] text-[#00a884]'
                                                : 'border-gray-300 dark:border-[#374248] text-gray-500 dark:text-[#8696a0]'}`}
                                        >
                                            {rt}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 dark:text-[#8696a0]">Sin selección = aplica a cualquier tipo de relación</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">Intents que lo disparan (separados por coma)</label>
                                <input
                                    type="text"
                                    value={csv(editing.triggerIntents)}
                                    onChange={e => setEditing({ ...editing, triggerIntents: fromCsv(e.target.value) })}
                                    placeholder="consulta_precio, pedido"
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef]"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">Preguntas guía (una por línea)</label>
                                <textarea
                                    value={editing.guidingQuestions.join('\n')}
                                    onChange={e => setEditing({ ...editing, guidingQuestions: e.target.value.split('\n') })}
                                    rows={3}
                                    placeholder={'¿Qué tipo de evento es?\n¿Qué fecha tienen en mente?'}
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef] resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">Entidades requeridas para éxito</label>
                                    <input
                                        type="text"
                                        value={csv(editing.successCondition.requiredEntities)}
                                        onChange={e => setEditing({
                                            ...editing,
                                            successCondition: { ...editing.successCondition, requiredEntities: fromCsv(e.target.value) }
                                        })}
                                        placeholder="tipoEvento, fecha"
                                        className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">Silencio para abandono (horas)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={editing.abandonCondition.silenceHours}
                                        onChange={e => setEditing({
                                            ...editing,
                                            abandonCondition: { ...editing.abandonCondition, silenceHours: Number(e.target.value) }
                                        })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-[#d1d7db]">Tono</label>
                                <input
                                    type="text"
                                    value={editing.tone}
                                    onChange={e => setEditing({ ...editing, tone: e.target.value })}
                                    placeholder="profesional_cordial"
                                    className="w-full px-3 py-2 bg-white dark:bg-[#2a3942] border border-gray-300 dark:border-[#374248] rounded-lg text-sm text-gray-800 dark:text-[#e9edef]"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-[#374248]">
                            <button onClick={() => setEditing(null)} className="px-4 py-2 text-gray-600 dark:text-[#aebac1] hover:bg-gray-100 dark:hover:bg-[#374248] rounded-lg text-sm font-medium">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !editing.label || (isNew && !editing.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#00a884] text-white rounded-lg text-sm font-medium hover:bg-[#06cf9c] disabled:opacity-50 transition-colors"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
