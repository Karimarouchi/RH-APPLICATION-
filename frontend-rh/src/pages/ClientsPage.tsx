import React, { useState, useEffect, useCallback } from 'react';
import {
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineDocumentText,
    HiOutlineDownload,
    HiOutlineEye,
    HiOutlineLockClosed,
    HiOutlineUser,
    HiOutlineMail,
    HiOutlinePhone,
    HiOutlineLocationMarker,
    HiOutlineAnnotation,
    HiOutlineOfficeBuilding,
    HiOutlineCheck,
    HiOutlineRefresh,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { clientService, ClientDTO } from '../api/clientService';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface ClientForm {
    nom: string;
    email: string;
    telephone: string;
    adresse: string;
    notes: string;
    contactNom: string;
    contactPoste: string;
    contactEmail: string;
    contactTelephone: string;
    clientPages: string[];
}

const emptyForm: ClientForm = {
    nom: '', email: '', telephone: '', adresse: '', notes: '',
    contactNom: '', contactPoste: '', contactEmail: '', contactTelephone: '',
    clientPages: ['MEDIA_PLANS', 'PROJETS', 'FICHIERS'],
};

/* ─── Page ─────────────────────────────────────────────────────────────────── */
const ClientsPage: React.FC = () => {
    const { user } = useAuth();
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
    const perms = user?.permissions ?? [];

    const canManage = perms.includes('MANAGE_CLIENTS') || perms.includes('CREATE_CLIENT') || perms.includes('EDIT_CLIENT');
    const canCreate = canManage || perms.includes('CREATE_CLIENT');
    const canEdit = canManage || perms.includes('EDIT_CLIENT');
    const canDelete = perms.includes('DELETE_CLIENT');

    const [clients, setClients] = useState<ClientDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal création/édition
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<ClientDTO | null>(null);
    const [form, setForm] = useState<ClientForm>(emptyForm);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'info' | 'contact' | 'account'>('info');

    // Compte (nouveau client)
    const [createAccount, setCreateAccount] = useState(false);
    // Régénérer MDP (édition)
    const [regeneratePassword, setRegeneratePassword] = useState(false);

    // Modal credentials (comme employés)
    const [showCredModal, setShowCredModal] = useState(false);
    const [credentials, setCredentials] = useState<{ login: string; password: string } | null>(null);

    // Modal détail
    const [viewing, setViewing] = useState<ClientDTO | null>(null);
    const [showViewModal, setShowViewModal] = useState(false);

    /* ── Load ─────────────────────────────────────────────────────────────── */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await clientService.getAllClients();
            setClients((res.data as any).data ?? res.data ?? []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = clients.filter(c =>
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.telephone ?? '').toLowerCase().includes(search.toLowerCase())
    );

    /* ── Modal helpers ────────────────────────────────────────────────────── */
    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setSelectedFile(null);
        setError(null);
        setActiveSection('info');
        setCreateAccount(false);
        setRegeneratePassword(false);
        setShowModal(true);
    };

    const openEdit = (c: ClientDTO) => {
        setEditing(c);
        setForm({
            nom: c.nom,
            email: c.email ?? '',
            telephone: c.telephone ?? '',
            adresse: c.adresse ?? '',
            notes: c.notes ?? '',
            contactNom: c.contactNom ?? '',
            contactPoste: c.contactPoste ?? '',
            contactEmail: c.contactEmail ?? '',
            contactTelephone: c.contactTelephone ?? '',
            clientPages: c.clientPages ? c.clientPages.split(',').map((s: string) => s.trim()) : [],
        });
        setSelectedFile(null);
        setError(null);
        setActiveSection('info');
        setCreateAccount(false);
        setRegeneratePassword(false);
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditing(null); };

    const f = (key: keyof ClientForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm(prev => ({ ...prev, [key]: e.target.value }));

    // Phone handler: allow international format (+, digits, spaces, hyphens, parentheses)
    const handlePhone = (key: 'telephone' | 'contactTelephone') =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value.replace(/[^0-9+\s\-()]/g, '');
            setForm(prev => ({ ...prev, [key]: raw }));
        };

    const isValidEmail = (email: string) =>
        !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const countDigits = (phone: string) => (phone.replace(/\D/g, '')).length;

    // International phone: 7–15 digits
    const isValidPhone = (phone: string) => {
        if (!phone) return true;
        const digits = countDigits(phone);
        return digits >= 7 && digits <= 15;
    };

    const handleSave = async () => {
        if (!form.nom.trim()) { setError('Le nom est obligatoire.'); return; }
        if (!isValidEmail(form.email)) { setError('L\'adresse email du client est invalide.'); return; }
        if (!isValidEmail(form.contactEmail)) { setError('L\'adresse email du contact est invalide.'); return; }
        if (!isValidPhone(form.telephone)) { setError('Le numéro de téléphone du client est invalide (7 à 15 chiffres).'); return; }
        if (!isValidPhone(form.contactTelephone)) { setError('Le numéro de téléphone du contact est invalide (7 à 15 chiffres).'); return; }
        setSaving(true); setError(null);
        try {
            if (editing) {
                const res = await clientService.updateClient(editing.id, {
                    ...form,
                    clientPages: form.clientPages.join(','),
                    regeneratePassword,
                    file: selectedFile ?? undefined,
                });
                const dto = (res.data as any).data ?? res.data;
                if (dto?.generatedPassword) {
                    setCredentials({ login: dto.loginClient, password: dto.generatedPassword });
                    setShowCredModal(true);
                }
            } else {
                const res = await clientService.createClient({
                    ...form,
                    clientPages: form.clientPages.join(','),
                    createAccount,
                    file: selectedFile ?? undefined,
                });
                const dto = (res.data as any).data ?? res.data;
                if (dto?.generatedPassword) {
                    setCredentials({ login: dto.loginClient, password: dto.generatedPassword });
                    setShowCredModal(true);
                }
            }
            closeModal();
            await load();
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'Erreur lors de la sauvegarde.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        confirm('Supprimer ce client ?', async () => {
            try { await clientService.deleteClient(id); await load(); }
            catch (e: any) { alert(e?.response?.data?.message ?? 'Erreur.'); }
        }, 'Supprimer le client');
    };

    const getBackendBase = () =>
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8080'
            : '';

    const openFile = (c: ClientDTO) => {
        if (c.fileUrl) {
            window.open(`${getBackendBase()}${c.fileUrl}`, '_blank');
        }
    };

    /* ── Styles ──────────────────────────────────────────────────────────── */
    const inputClass = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300";
    const labelClass = "mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300";

    const SectionTab = ({ id, label, icon }: { id: typeof activeSection; label: string; icon: React.ReactNode }) => (
        <button
            type="button"
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-theme-sm font-medium transition-all ${activeSection === id
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'
                }`}
        >
            {icon} {label}
        </button>
    );

    /* ── Render ──────────────────────────────────────────────────────────── */
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Clients</h1>
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">Gestion des clients</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-theme-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        {filtered.length} client{filtered.length !== 1 ? 's' : ''}
                    </span>
                    {canCreate && (
                        <Button size="sm" onClick={openCreate}>
                            <HiOutlinePlus size={16} className="mr-1" /> Nouveau client
                        </Button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un client..."
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="py-20 text-center text-gray-500">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="py-20 text-center text-gray-400">Aucun client trouvé</div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-dark">
                    <table className="w-full text-left text-theme-sm">
                        <thead className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/40">
                            <tr>
                                <th className="px-5 py-3.5 font-semibold text-gray-600 dark:text-gray-300">Client</th>
                                <th className="px-4 py-3.5 font-semibold text-gray-600 dark:text-gray-300">Contact</th>
                                <th className="px-4 py-3.5 font-semibold text-gray-600 dark:text-gray-300">Contact principal</th>
                                <th className="px-4 py-3.5 font-semibold text-gray-600 dark:text-gray-300">Compte</th>
                                <th className="px-4 py-3.5 font-semibold text-gray-600 dark:text-gray-300">Fichier</th>
                                <th className="px-4 py-3.5 font-semibold text-gray-600 dark:text-gray-300">Créé le</th>
                                <th className="px-4 py-3.5 font-semibold text-gray-600 dark:text-gray-300 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filtered.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                    {/* Client */}
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 font-bold text-sm">
                                                {c.nom.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-white">{c.nom}</p>
                                                {c.adresse && <p className="text-theme-xs text-gray-400 flex items-center gap-1 mt-0.5"><HiOutlineLocationMarker size={11} /> {c.adresse}</p>}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Coordonnées */}
                                    <td className="px-4 py-3.5">
                                        <div className="space-y-0.5">
                                            {c.email && <p className="text-theme-xs text-gray-500 flex items-center gap-1"><HiOutlineMail size={12} /> {c.email}</p>}
                                            {c.telephone && <p className="text-theme-xs text-gray-500 flex items-center gap-1"><HiOutlinePhone size={12} /> {c.telephone}</p>}
                                            {!c.email && !c.telephone && <span className="text-theme-xs text-gray-300 italic">—</span>}
                                        </div>
                                    </td>

                                    {/* Contact principal */}
                                    <td className="px-4 py-3.5">
                                        {c.contactNom ? (
                                            <div>
                                                <p className="text-theme-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                    <HiOutlineUser size={12} /> {c.contactNom}
                                                </p>
                                                {c.contactPoste && <p className="text-theme-xs text-gray-400">{c.contactPoste}</p>}
                                            </div>
                                        ) : (
                                            <span className="text-theme-xs text-gray-300 italic">—</span>
                                        )}
                                    </td>

                                    {/* Compte */}
                                    <td className="px-4 py-3.5">
                                        {c.hasAccount ? (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-theme-xs font-medium text-green-600 dark:bg-green-500/10 dark:text-green-400">
                                                    <HiOutlineCheck size={11} /> Actif
                                                </span>
                                                {c.loginClient && <span className="text-theme-xs text-gray-400 font-mono">{c.loginClient}</span>}
                                            </div>
                                        ) : (
                                            <span className="text-theme-xs text-gray-300 italic">Aucun compte</span>
                                        )}
                                    </td>

                                    {/* Fichier */}
                                    <td className="px-4 py-3.5">
                                        {c.fileName ? (
                                            <button
                                                onClick={() => openFile(c)}
                                                className="flex items-center gap-1.5 text-brand-600 hover:text-brand-700 dark:text-brand-400 text-theme-xs font-medium hover:underline"
                                            >
                                                <HiOutlineDocumentText size={14} />
                                                <span className="max-w-[100px] truncate">{c.fileName}</span>
                                                <HiOutlineDownload size={12} />
                                            </button>
                                        ) : (
                                            <span className="text-gray-300 text-theme-xs italic">—</span>
                                        )}
                                    </td>

                                    {/* Date */}
                                    <td className="px-4 py-3.5">
                                        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                                            {c.dateCreation ? new Date(c.dateCreation).toLocaleDateString('fr-FR') : '—'}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setViewing(c); setShowViewModal(true); }}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 transition-colors"
                                                title="Voir les détails"
                                            >
                                                <HiOutlineEye size={16} />
                                            </button>
                                            {canEdit && (
                                                <button
                                                    onClick={() => openEdit(c)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-700 transition-colors"
                                                    title="Modifier"
                                                >
                                                    <HiOutlinePencil size={16} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <HiOutlineTrash size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
            <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Modifier le client' : 'Nouveau client'} size="lg">
                <div className="space-y-4 p-1">
                    {error && (
                        <div className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-700 dark:bg-error-500/10 dark:text-error-400">
                            {error}
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex items-center gap-2 p-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <SectionTab id="info" label="Informations" icon={<HiOutlineOfficeBuilding size={15} />} />
                        <SectionTab id="contact" label="Contact principal" icon={<HiOutlineUser size={15} />} />
                        <SectionTab id="account" label="Compte client" icon={<HiOutlineLockClosed size={15} />} />
                    </div>

                    {/* ── Informations ── */}
                    {activeSection === 'info' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className={labelClass}>Nom <span className="text-error-500">*</span></label>
                                <input type="text" value={form.nom} onChange={f('nom')} className={inputClass} placeholder="Nom du client" />
                            </div>
                            <div>
                                <label className={labelClass}>Email</label>
                                <div className="relative">
                                    <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input type="email" value={form.email} onChange={f('email')} className={inputClass + ' pl-10' + (form.email && !isValidEmail(form.email) ? ' border-error-400 focus:border-error-400 focus:ring-error-500/10' : '')} placeholder="email@client.com" />
                                </div>
                                {form.email && !isValidEmail(form.email) && (
                                    <p className="mt-1 text-theme-xs text-error-500">Format d'email invalide.</p>
                                )}
                            </div>
                            <div>
                                <label className={labelClass}>Téléphone</label>
                                <div className="relative">
                                    <HiOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input type="tel" value={form.telephone} onChange={handlePhone('telephone')} className={inputClass + ' pl-10' + (form.telephone && !isValidPhone(form.telephone) ? ' border-error-400 focus:border-error-400 focus:ring-error-500/10' : '')} placeholder="Ex: +33 6 12 34 56 78" />
                                </div>
                                {form.telephone && !isValidPhone(form.telephone) && (
                                    <p className="mt-1 text-theme-xs text-error-500">Numéro invalide (7 à 15 chiffres, format international accepté).</p>
                                )}
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Adresse</label>
                                <div className="relative">
                                    <HiOutlineLocationMarker className="absolute left-3 top-3 text-gray-400" size={16} />
                                    <textarea value={form.adresse} onChange={f('adresse')} rows={2}
                                        className="w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 py-2.5 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 resize-none"
                                        placeholder="Adresse du client..." />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Notes</label>
                                <div className="relative">
                                    <HiOutlineAnnotation className="absolute left-3 top-3 text-gray-400" size={16} />
                                    <textarea value={form.notes} onChange={f('notes')} rows={3}
                                        className="w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 py-2.5 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 resize-none"
                                        placeholder="Notes ou remarques..." />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Fichier (PDF, PNG, JPEG)</label>
                                {editing?.fileName && !selectedFile && (
                                    <p className="mb-2 text-theme-xs text-gray-400">
                                        Fichier actuel : <span className="font-medium text-gray-600 dark:text-gray-300">{editing.fileName}</span>
                                    </p>
                                )}
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                                    className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-theme-sm text-gray-500 cursor-pointer dark:border-gray-600 dark:bg-gray-800 file:mr-3 file:rounded file:border-0 file:bg-brand-500 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Contact principal ── */}
                    {activeSection === 'contact' && (
                        <div className="space-y-4">
                            <p className="text-theme-xs text-gray-400 dark:text-gray-500">Informations de la personne à contacter chez ce client.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className={labelClass}>Nom</label>
                                    <div className="relative">
                                        <HiOutlineUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" value={form.contactNom} onChange={f('contactNom')} className={inputClass + ' pl-10'} placeholder="Nom du contact" />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass}>Poste</label>
                                    <input type="text" value={form.contactPoste} onChange={f('contactPoste')} className={inputClass} placeholder="Ex: Directeur commercial" />
                                </div>
                                <div>
                                    <label className={labelClass}>Email</label>
                                    <div className="relative">
                                        <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="email" value={form.contactEmail} onChange={f('contactEmail')} className={inputClass + ' pl-10' + (form.contactEmail && !isValidEmail(form.contactEmail) ? ' border-error-400 focus:border-error-400 focus:ring-error-500/10' : '')} placeholder="email@contact.com" />
                                    </div>
                                    {form.contactEmail && !isValidEmail(form.contactEmail) && (
                                        <p className="mt-1 text-theme-xs text-error-500">Format d'email invalide.</p>
                                    )}
                                </div>
                                <div>
                                    <label className={labelClass}>Téléphone</label>
                                    <div className="relative">
                                        <HiOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="tel" value={form.contactTelephone} onChange={handlePhone('contactTelephone')} className={inputClass + ' pl-10' + (form.contactTelephone && !isValidPhone(form.contactTelephone) ? ' border-error-400 focus:border-error-400 focus:ring-error-500/10' : '')} placeholder="Ex: +1 202 555 0100" />
                                    </div>
                                    {form.contactTelephone && !isValidPhone(form.contactTelephone) && (
                                        <p className="mt-1 text-theme-xs text-error-500">Numéro invalide (7 à 15 chiffres, format international accepté).</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Compte client ── */}
                    {activeSection === 'account' && (
                        <div className="space-y-4">
                            {!editing ? (
                                /* Création : checkbox pour créer un compte */
                                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={createAccount}
                                            onChange={e => setCreateAccount(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        />
                                        <div>
                                            <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">Créer un compte client</p>
                                            <p className="text-theme-xs text-gray-400 mt-0.5">
                                                Un identifiant et un mot de passe seront générés automatiquement et affichés après la création.
                                            </p>
                                        </div>
                                    </label>
                                    {createAccount && (
                                        <div className="ml-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 px-4 py-3">
                                            <p className="text-theme-xs text-brand-600 dark:text-brand-400 flex items-center gap-2">
                                                <HiOutlineLockClosed size={14} />
                                                Le login sera généré à partir du nom du client. Le mot de passe sera aléatoire et affiché une seule fois.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Édition : afficher le compte existant + option régénération */
                                <div className="space-y-4">
                                    {editing.hasAccount ? (
                                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 dark:bg-green-500/10">
                                                    <HiOutlineCheck size={18} className="text-green-500" />
                                                </div>
                                                <div>
                                                    <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">Compte actif</p>
                                                    <p className="text-theme-xs text-gray-400 font-mono">{editing.loginClient}</p>
                                                </div>
                                            </div>
                                            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                                                <label className="flex items-start gap-3 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={regeneratePassword}
                                                        onChange={e => setRegeneratePassword(e.target.checked)}
                                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                                    />
                                                    <div>
                                                        <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                            <HiOutlineRefresh size={14} /> Régénérer le mot de passe
                                                        </p>
                                                        <p className="text-theme-xs text-gray-400 mt-0.5">
                                                            Un nouveau mot de passe aléatoire sera créé et affiché après la sauvegarde.
                                                        </p>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* SÉLECTION DES MODULES ACCESS (MODIFICATION) */}
                                            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                                                <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modules accessibles</p>
                                                <div className="space-y-2">
                                                    {[
                                                        { id: 'MEDIA_PLANS', label: 'Mes Media Plans' },
                                                        { id: 'PROJETS', label: 'Mes Projets' },
                                                        { id: 'FICHIERS', label: 'Mes Fichiers' }
                                                    ].map(mod => (
                                                        <label key={mod.id} className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={form.clientPages.includes(mod.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setForm({ ...form, clientPages: [...form.clientPages, mod.id] });
                                                                    else setForm({ ...form, clientPages: form.clientPages.filter(p => p !== mod.id) });
                                                                }}
                                                                className="h-4 w-4 rounded text-brand-500 focus:ring-brand-500 border-gray-300"
                                                            />
                                                            <span className="text-theme-sm text-gray-700 dark:text-gray-300">{mod.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center text-gray-400">
                                            <HiOutlineLockClosed size={24} className="mx-auto mb-2 opacity-40" />
                                            <p className="text-theme-sm">Ce client n'a pas encore de compte.</p>
                                            <p className="text-theme-xs mt-1">Supprimez et recréez le client pour lui attribuer un compte.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Boutons */}
                    <div className="flex justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex gap-2">
                            {activeSection !== 'info' && (
                                <Button variant="outline" size="sm" onClick={() => setActiveSection(activeSection === 'account' ? 'contact' : 'info')}>
                                    ← Précédent
                                </Button>
                            )}
                            {activeSection !== 'account' && (
                                <Button variant="outline" size="sm" onClick={() => setActiveSection(activeSection === 'info' ? 'contact' : 'account')}>
                                    Suivant →
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={closeModal} disabled={saving}>Annuler</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? 'Enregistrement...' : (editing ? 'Modifier' : 'Créer')}
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* ── Modal Credentials (comme employés) ─────────────────────────── */}
            <Modal isOpen={showCredModal} onClose={() => setShowCredModal(false)} title="Compte client créé">
                <div className="space-y-5 p-1">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-500/20">
                            <HiOutlineCheck size={24} className="text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-theme-sm font-semibold text-green-700 dark:text-green-400">Compte créé avec succès !</p>
                            <p className="text-theme-xs text-green-600 dark:text-green-500 mt-0.5">Notez ces informations, le mot de passe ne sera plus visible.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                            <div>
                                <p className="text-theme-xs text-gray-500 dark:text-gray-400 mb-0.5">Login</p>
                                <p className="text-theme-sm font-semibold text-gray-800 dark:text-white font-mono">
                                    {credentials?.login}
                                </p>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(credentials?.login ?? '')}
                                className="text-theme-xs text-brand-500 hover:text-brand-700 font-medium"
                            >
                                Copier
                            </button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                            <div>
                                <p className="text-theme-xs text-gray-500 dark:text-gray-400 mb-0.5">Mot de passe</p>
                                <p className="text-theme-sm font-semibold text-gray-800 dark:text-white font-mono">
                                    {credentials?.password}
                                </p>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(credentials?.password ?? '')}
                                className="text-theme-xs text-brand-500 hover:text-brand-700 font-medium"
                            >
                                Copier
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
                        <Button onClick={() => setShowCredModal(false)}>Fermer</Button>
                    </div>
                </div>
            </Modal>

            {/* ── Modal Détail ────────────────────────────────────────────────── */}
            {viewing && (
                <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Détails du client">
                    <div className="space-y-5 p-1">
                        {/* En-tête */}
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white font-bold text-xl shadow">
                                {viewing.nom.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">{viewing.nom}</h2>
                                {viewing.dateCreation && (
                                    <p className="text-theme-xs text-gray-400 mt-0.5">
                                        Créé le {new Date(viewing.dateCreation).toLocaleDateString('fr-FR')}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Coordonnées */}
                        <Section title="Coordonnées">
                            <InfoRow icon={<HiOutlineMail size={15} />} label="Email" value={viewing.email} />
                            <InfoRow icon={<HiOutlinePhone size={15} />} label="Téléphone" value={viewing.telephone} />
                            <InfoRow icon={<HiOutlineLocationMarker size={15} />} label="Adresse" value={viewing.adresse} />
                        </Section>

                        {viewing.notes && (
                            <Section title="Notes">
                                <div className="px-4 py-2.5">
                                    <p className="text-theme-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{viewing.notes}</p>
                                </div>
                            </Section>
                        )}

                        {(viewing.contactNom || viewing.contactEmail || viewing.contactTelephone) && (
                            <Section title="Contact principal">
                                <InfoRow icon={<HiOutlineUser size={15} />} label="Nom" value={viewing.contactNom} />
                                <InfoRow icon={<HiOutlineOfficeBuilding size={15} />} label="Poste" value={viewing.contactPoste} />
                                <InfoRow icon={<HiOutlineMail size={15} />} label="Email" value={viewing.contactEmail} />
                                <InfoRow icon={<HiOutlinePhone size={15} />} label="Téléphone" value={viewing.contactTelephone} />
                            </Section>
                        )}

                        {/* Compte */}
                        <Section title="Compte client">
                            {viewing.hasAccount ? (
                                <>
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="text-gray-400 shrink-0"><HiOutlineLockClosed size={15} /></span>
                                        <span className="text-theme-xs text-gray-500 w-24 shrink-0">Statut</span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-theme-xs font-medium text-green-600 dark:bg-green-500/10 dark:text-green-400">
                                            <HiOutlineCheck size={11} /> Actif
                                        </span>
                                    </div>
                                    <InfoRow icon={<HiOutlineUser size={15} />} label="Login" value={viewing.loginClient} />
                                    <InfoRow icon={<HiOutlineLockClosed size={15} />} label="Mot de passe" value="••••••••" />
                                </>
                            ) : (
                                <div className="px-4 py-3">
                                    <p className="text-theme-xs text-gray-400 italic">Aucun compte associé</p>
                                </div>
                            )}
                        </Section>

                        {viewing.fileName && (
                            <Section title="Fichier joint">
                                <div className="px-4 py-2.5">
                                    <button
                                        onClick={() => openFile(viewing)}
                                        className="flex items-center gap-2 text-brand-600 hover:text-brand-700 text-theme-sm font-medium hover:underline"
                                    >
                                        <HiOutlineDocumentText size={16} />
                                        {viewing.fileName}
                                        <HiOutlineDownload size={14} />
                                    </button>
                                </div>
                            </Section>
                        )}

                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                            {canEdit && (
                                <Button size="sm" variant="outline" onClick={() => { setShowViewModal(false); openEdit(viewing); }}>
                                    <HiOutlinePencil size={14} className="mr-1" /> Modifier
                                </Button>
                            )}
                            <Button size="sm" onClick={() => setShowViewModal(false)}>Fermer</Button>
                        </div>
                    </div>
                </Modal>
            )}

            <ConfirmDialog
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel="Supprimer"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </div>
    );
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="mb-2 text-theme-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{title}</h3>
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/30 divide-y divide-gray-100 dark:divide-gray-800">
            {children}
        </div>
    </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value?: string | null }> = ({ icon, label, value }) => (
    <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="text-gray-400 shrink-0">{icon}</span>
        <span className="text-theme-xs text-gray-500 w-24 shrink-0">{label}</span>
        <span className="text-theme-sm text-gray-700 dark:text-gray-300 flex-1">
            {value || <span className="italic text-gray-300">—</span>}
        </span>
    </div>
);

export default ClientsPage;
