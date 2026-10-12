import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
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
import { API_BASE } from '../api/axios';
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
    /** Page keys selected in the multi-select */
    clientPages: string[];
}

const ALL_CLIENT_PAGES = [
    { key: 'MEDIA_PLANS', label: 'Mes Media Plans', desc: 'Media plans approuvés' },
    { key: 'PROJETS', label: 'Mes Projets', desc: 'Tableau de bord des projets' },
    { key: 'FICHIERS', label: 'Mes Fichiers', desc: 'Fichiers Google Drive' },
];

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
    const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
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

    // Cache-buster pour les logos (mis à jour après chaque sauvegarde)
    const [imgTs, setImgTs] = useState(() => Date.now());

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
        setSelectedLogoFile(null);
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
            clientPages: c.clientPages ? c.clientPages.split(',').map(p => p.trim()).filter(Boolean) : ['MEDIA_PLANS', 'PROJETS', 'FICHIERS'],
        });
        setSelectedFile(null);
        setSelectedLogoFile(null);
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
                const pages = form.clientPages.join(',');
                const res = await clientService.updateClient(editing.id, {
                    ...form,
                    clientPages: pages,
                    regeneratePassword,
                    file: selectedFile ?? undefined,
                    logoFile: selectedLogoFile ?? undefined,
                });
                const dto = (res.data as any).data ?? res.data;
                if (dto?.generatedPassword) {
                    setCredentials({ login: dto.loginClient, password: dto.generatedPassword });
                    setShowCredModal(true);
                }
            } else {
                const pages = form.clientPages.join(',');
                const res = await clientService.createClient({
                    ...form,
                    clientPages: pages,
                    createAccount,
                    file: selectedFile ?? undefined,
                    logoFile: selectedLogoFile ?? undefined,
                });
                const dto = (res.data as any).data ?? res.data;
                if (dto?.generatedPassword) {
                    setCredentials({ login: dto.loginClient, password: dto.generatedPassword });
                    setShowCredModal(true);
                }
            }
            closeModal();
            await load();
            setImgTs(Date.now()); // force le rechargement des images logo
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-theme-sm font-medium transition-all ${
                activeSection === id
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'
            }`}
        >
            {icon} {label}
        </button>
    );

    /* ── Render ──────────────────────────────────────────────────────────── */
    return (
        <div className="space-y-6 pb-10">
            {/* Background Decor (Glassmorphism blobs) */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 dark:bg-brand-500/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-violet-500/10 dark:bg-violet-500/5 blur-[100px] rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-title-sm font-bold text-gray-800 dark:text-white">Clients</h1>
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

            {/* Grid */}
            {loading ? (
                <div className="py-20 text-center text-gray-500">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="py-20 text-center text-gray-400">Aucun client trouvé</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-12">
                    {filtered.map((c, idx) => {
                        const avatarBgs = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-pink-500'];
                        const avatarBg = avatarBgs[c.nom.length % avatarBgs.length];
                        const pages = c.clientPages ? c.clientPages.split(',').map(p => p.trim()).filter(Boolean) : [];
                        const pageLabel: Record<string,string> = { MEDIA_PLANS:'Méd', PROJETS:'Pro', FICHIERS:'Fic' };
                        const pageFull: Record<string,string> = { MEDIA_PLANS:'Médias', PROJETS:'Projets', FICHIERS:'Fichiers' };

                        return (
                        <motion.div
                            key={c.id}
                            initial={{ opacity:0, y:16 }}
                            animate={{ opacity:1, y:0 }}
                            transition={{ duration:0.3, delay: idx * 0.04, ease:'easeOut' }}
                            className="group mt-11 [perspective:1000px]"
                        >
                        <div className="relative flex flex-col rounded-[20px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-md [transform-style:preserve-3d] transition-all duration-500 ease-in-out group-hover:[box-shadow:0_20px_60px_-10px_rgba(243,105,4,0.45),0_8px_24px_-4px_rgba(243,105,4,0.25)] group-hover:[transform:rotate3d(1,1,0,15deg)]"
                             style={{ willChange: 'transform' }}>
                            {/* ── Avatar flottant au-dessus de la card ── */}
                            <div className="absolute -top-11 left-1/2 -translate-x-1/2 w-[88px] h-[88px] rounded-full overflow-hidden border-4 border-white dark:border-gray-900 shadow-md z-10">
                                {c.logoUrl
                                    ? <img
                                        src={`${API_BASE}${c.logoUrl}?t=${imgTs}`}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const parent = e.currentTarget.parentElement;
                                            if (parent) {
                                                parent.classList.add(...avatarBg.split(' '));
                                                parent.innerHTML = `<span class="text-white text-[30px] font-medium flex items-center justify-center w-full h-full">${c.nom.charAt(0).toUpperCase()}</span>`;
                                            }
                                        }}
                                      />
                                    : <div className={`w-full h-full flex items-center justify-center text-white text-[30px] font-medium ${avatarBg}`}>
                                        {c.nom.charAt(0).toUpperCase()}
                                      </div>
                                }
                            </div>

                            <div className="flex flex-col px-5 pt-14 pb-5 gap-4">

                                {/* ── Nom + poste (gauche) | badges accès (droite) ── */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="text-[18px] font-bold text-gray-900 dark:text-white truncate">{c.nom}</h3>
                                        <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                            {c.contactPoste || c.adresse || 'Client'}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
                                        <div className="flex gap-2">
                                            {pages.length > 0
                                                ? pages.slice(0,3).map(p => (
                                                    <div key={p} title={pageFull[p] ?? p}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                                        {pageLabel[p] ?? p.charAt(0)}
                                                    </div>
                                                ))
                                                : <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-400">—</div>
                                            }
                                        </div>
                                        <span className="text-[11px] text-gray-400 tracking-wide">Accès</span>
                                    </div>
                                </div>

                                {/* ── Stats row ── */}
                                <div className="flex rounded-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 overflow-hidden mb-1">
                                    <div className="flex-1 py-3 px-2 text-center border-r border-gray-200 dark:border-gray-700">
                                        <div className="text-[15px] font-bold text-gray-900 dark:text-white truncate leading-tight">
                                            {c.contactNom || '—'}
                                        </div>
                                        <div className="text-[11px] text-gray-400 mt-0.5">Contact</div>
                                    </div>
                                    <div className="flex-1 py-3 px-2 text-center border-r border-gray-200 dark:border-gray-700">
                                        <div className="text-[15px] font-bold text-gray-900 dark:text-white truncate leading-tight">
                                            {c.telephone || '—'}
                                        </div>
                                        <div className="text-[11px] text-gray-400 mt-0.5">Téléphone</div>
                                    </div>
                                    <div className="flex-1 py-3 px-2 text-center">
                                        {c.hasAccount
                                            ? <div className="text-[15px] font-bold text-emerald-500">Actif</div>
                                            : <div className="text-[15px] font-bold text-gray-400">Aucun</div>
                                        }
                                        <div className="text-[11px] text-gray-400 mt-0.5">Compte</div>
                                    </div>
                                </div>

                            </div>

                            {/* ── Actions hover (coin haut droit) ── */}
                            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                                <button onClick={() => { setViewing(c); setShowViewModal(true); }}
                                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                                    style={{ transitionDelay: '50ms' }}>
                                    <HiOutlineEye size={15} />
                                </button>
                                {canEdit && (
                                    <button onClick={() => openEdit(c)}
                                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-brand-500 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                                        style={{ transitionDelay: '100ms' }}>
                                        <HiOutlinePencil size={15} />
                                    </button>
                                )}
                                {canDelete && (
                                    <button onClick={() => handleDelete(c.id)}
                                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                                        style={{ transitionDelay: '150ms' }}>
                                        <HiOutlineTrash size={15} />
                                    </button>
                                )}
                            </div>
                        </div>
                        </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
            <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Modifier le client' : 'Nouveau client'} size="lg"
                footer={<>
                    <div className="flex gap-2 mr-auto">
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
                    <Button variant="outline" onClick={closeModal} disabled={saving}>Annuler</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Enregistrement...' : (editing ? 'Modifier' : 'Créer')}
                    </Button>
                </>}
            >
                <div className="space-y-4 p-1">
                    {error && (
                        <div className="rounded-lg bg-error-50 px-4 py-3 text-theme-sm text-error-700 dark:bg-error-500/10 dark:text-error-400">
                            {error}
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex items-center gap-2 p-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <SectionTab id="info" label="Informations" icon={<HiOutlineOfficeBuilding size={15}/>} />
                        <SectionTab id="contact" label="Contact principal" icon={<HiOutlineUser size={15}/>} />
                        <SectionTab id="account" label="Compte client" icon={<HiOutlineLockClosed size={15}/>} />
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
                                    <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                    <input type="email" value={form.email} onChange={f('email')} className={inputClass + ' pl-10' + (form.email && !isValidEmail(form.email) ? ' border-error-400 focus:border-error-400 focus:ring-error-500/10' : '')} placeholder="email@client.com" />
                                </div>
                                {form.email && !isValidEmail(form.email) && (
                                    <p className="mt-1 text-theme-xs text-error-500">Format d'email invalide.</p>
                                )}
                            </div>
                            <div>
                                <label className={labelClass}>Téléphone</label>
                                <div className="relative">
                                    <HiOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                    <input type="tel" value={form.telephone} onChange={handlePhone('telephone')} className={inputClass + ' pl-10' + (form.telephone && !isValidPhone(form.telephone) ? ' border-error-400 focus:border-error-400 focus:ring-error-500/10' : '')} placeholder="Ex: +33 6 12 34 56 78" />
                                </div>
                                {form.telephone && !isValidPhone(form.telephone) && (
                                    <p className="mt-1 text-theme-xs text-error-500">Numéro invalide (7 à 15 chiffres, format international accepté).</p>
                                )}
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Adresse</label>
                                <div className="relative">
                                    <HiOutlineLocationMarker className="absolute left-3 top-3 text-gray-400" size={16}/>
                                    <textarea value={form.adresse} onChange={f('adresse')} rows={2}
                                        className="w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 py-2.5 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 resize-none"
                                        placeholder="Adresse du client..." />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Notes</label>
                                <div className="relative">
                                    <HiOutlineAnnotation className="absolute left-3 top-3 text-gray-400" size={16}/>
                                    <textarea value={form.notes} onChange={f('notes')} rows={3}
                                        className="w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 py-2.5 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 resize-none"
                                        placeholder="Notes ou remarques..." />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Logo du client (PNG, JPEG, SVG)</label>
                                {editing?.logoUrl && !selectedLogoFile && (
                                    <p className="mb-2 text-theme-xs text-gray-400">
                                        <span className="font-medium text-brand-600 dark:text-brand-400">✓ Logo actuel présent</span> (sélectionnez un fichier pour le remplacer)
                                    </p>
                                )}
                                <input
                                    type="file"
                                    accept=".png,.jpg,.jpeg,.svg,.webp"
                                    onChange={e => setSelectedLogoFile(e.target.files?.[0] ?? null)}
                                    className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-theme-sm text-gray-500 cursor-pointer dark:border-gray-600 dark:bg-gray-800 file:mr-3 file:rounded file:border-0 file:bg-brand-500 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white"
                                />
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
                                        <HiOutlineUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
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
                                        <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                        <input type="email" value={form.contactEmail} onChange={f('contactEmail')} className={inputClass + ' pl-10' + (form.contactEmail && !isValidEmail(form.contactEmail) ? ' border-error-400 focus:border-error-400 focus:ring-error-500/10' : '')} placeholder="email@contact.com" />
                                    </div>
                                    {form.contactEmail && !isValidEmail(form.contactEmail) && (
                                        <p className="mt-1 text-theme-xs text-error-500">Format d'email invalide.</p>
                                    )}
                                </div>
                                <div>
                                    <label className={labelClass}>Téléphone</label>
                                    <div className="relative">
                                        <HiOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
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
                            {/* Pages visibles - shown regardless of account status */}
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                                <div>
                                    <p className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Pages accessibles</p>
                                    <p className="text-theme-xs text-gray-400">Sélectionnez les pages que ce client pourra voir après connexion.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {ALL_CLIENT_PAGES.map(page => (
                                        <label key={page.key} className="flex items-start gap-3 cursor-pointer rounded-lg p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={form.clientPages.includes(page.key)}
                                                onChange={e => {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        clientPages: e.target.checked
                                                            ? [...prev.clientPages, page.key]
                                                            : prev.clientPages.filter(k => k !== page.key),
                                                    }));
                                                }}
                                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                            />
                                            <div>
                                                <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">{page.label}</p>
                                                <p className="text-theme-xs text-gray-400">{page.desc}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Création/édition compte */}
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
                                                <HiOutlineLockClosed size={14}/>
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
                                                    <HiOutlineCheck size={18} className="text-green-500"/>
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
                                                            <HiOutlineRefresh size={14}/> Régénérer le mot de passe
                                                        </p>
                                                        <p className="text-theme-xs text-gray-400 mt-0.5">
                                                            Un nouveau mot de passe aléatoire sera créé et affiché après la sauvegarde.
                                                        </p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center text-gray-400">
                                            <HiOutlineLockClosed size={24} className="mx-auto mb-2 opacity-40"/>
                                            <p className="text-theme-sm">Ce client n'a pas encore de compte.</p>
                                            <p className="text-theme-xs mt-1">Supprimez et recréez le client pour lui attribuer un compte.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Boutons */}
                    </div>
            </Modal>

            {/* ── Modal Credentials (comme employés) ─────────────────────────── */}
            <Modal isOpen={showCredModal} onClose={() => setShowCredModal(false)} title="Compte client créé">
                <div className="space-y-5 p-1">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-500/20">
                            <HiOutlineCheck size={24} className="text-green-600 dark:text-green-400"/>
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
                <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Détails du client"
                    footer={<>
                        {canEdit && (
                            <Button size="sm" variant="outline" onClick={() => { setShowViewModal(false); openEdit(viewing); }}>
                                <HiOutlinePencil size={14} className="mr-1"/> Modifier
                            </Button>
                        )}
                        <Button size="sm" onClick={() => setShowViewModal(false)}>Fermer</Button>
                    </>}
                >
                    <div className="space-y-5 p-1">
                        {/* En-tête */}
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                            <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-xl overflow-hidden ${viewing.logoUrl ? 'bg-transparent' : 'bg-brand-500 shadow'}`}>
                                {viewing.logoUrl
                                    ? <img
                                        src={`${(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8080' : ''}${viewing.logoUrl}?t=${imgTs}`}
                                        alt=""
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const parent = e.currentTarget.parentElement;
                                            if (parent) {
                                                parent.classList.remove('bg-transparent');
                                                parent.classList.add('bg-brand-500','shadow');
                                                parent.textContent = viewing!.nom.charAt(0).toUpperCase();
                                            }
                                        }}
                                      />
                                    : viewing.nom.charAt(0).toUpperCase()
                                }
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
                            <InfoRow icon={<HiOutlineMail size={15}/>} label="Email" value={viewing.email} />
                            <InfoRow icon={<HiOutlinePhone size={15}/>} label="Téléphone" value={viewing.telephone} />
                            <InfoRow icon={<HiOutlineLocationMarker size={15}/>} label="Adresse" value={viewing.adresse} />
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
                                <InfoRow icon={<HiOutlineUser size={15}/>} label="Nom" value={viewing.contactNom} />
                                <InfoRow icon={<HiOutlineOfficeBuilding size={15}/>} label="Poste" value={viewing.contactPoste} />
                                <InfoRow icon={<HiOutlineMail size={15}/>} label="Email" value={viewing.contactEmail} />
                                <InfoRow icon={<HiOutlinePhone size={15}/>} label="Téléphone" value={viewing.contactTelephone} />
                            </Section>
                        )}

                        {/* Compte */}
                        <Section title="Compte client">
                            {viewing.hasAccount ? (
                                <>
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="text-gray-400 shrink-0"><HiOutlineLockClosed size={15}/></span>
                                        <span className="text-theme-xs text-gray-500 w-24 shrink-0">Statut</span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-theme-xs font-medium text-green-600 dark:bg-green-500/10 dark:text-green-400">
                                            <HiOutlineCheck size={11}/> Actif
                                        </span>
                                    </div>
                                    <InfoRow icon={<HiOutlineUser size={15}/>} label="Login" value={viewing.loginClient} />
                                    <InfoRow icon={<HiOutlineLockClosed size={15}/>} label="Mot de passe" value="••••••••" />
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
                                        <HiOutlineDocumentText size={16}/>
                                        {viewing.fileName}
                                        <HiOutlineDownload size={14}/>
                                    </button>
                                </div>
                            </Section>
                        )}

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
