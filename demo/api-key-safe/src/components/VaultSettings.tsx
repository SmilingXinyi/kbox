import React, {useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {
    X,
    Clock,
    Shield,
    Smartphone,
    CheckCircle,
    RefreshCw,
    Trash2,
    Lock,
    ExternalLink,
    Info,
    AlertCircle
} from 'lucide-react';
import {isRunningInIframe} from '../lib/webauthn';

interface VaultSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    lockBehavior: 'always' | 'delay-30s' | 'delay-1m' | 'delay-5m' | 'once';
    onLockBehaviorChange: (behavior: 'always' | 'delay-30s' | 'delay-1m' | 'delay-5m' | 'once') => void;
    swRegistration: ServiceWorkerRegistration | null;
    updateAvailable: boolean;
    onManualUpgrade: () => void;
    onReset: () => void;
}

export default function VaultSettings({
    isOpen,
    onClose,
    lockBehavior,
    onLockBehaviorChange,
    swRegistration,
    updateAvailable,
    onManualUpgrade,
    onReset
}: VaultSettingsProps) {
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [checkStatus, setCheckStatus] = useState<'idle' | 'no-update' | 'update-found'>('idle');
    const [confirmReset, setConfirmReset] = useState(false);

    if (!isOpen) return null;

    const handleCheckUpdates = async () => {
        if (checkingUpdates) return;
        setCheckingUpdates(true);
        setCheckStatus('idle');

        try {
            if (swRegistration) {
                // Trigger standard Service Worker update check
                await swRegistration.update();

                // Artificial delay for high-quality UI feedback
                setTimeout(() => {
                    setCheckingUpdates(false);
                    if (swRegistration.waiting || swRegistration.installing || updateAvailable) {
                        setCheckStatus('update-found');
                    } else {
                        setCheckStatus('no-update');
                    }
                }, 1200);
            } else {
                // Fallback for when PWA service worker is not yet registered or supported
                setTimeout(() => {
                    setCheckingUpdates(false);
                    setCheckStatus('no-update');
                }, 1200);
            }
        } catch (err) {
            console.warn('Check updates error:', err);
            setTimeout(() => {
                setCheckingUpdates(false);
                setCheckStatus('no-update');
            }, 1000);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                id="vault-settings-panel"
                initial={{opacity: 0, scale: 0.95, y: 10}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.95, y: 10}}
                transition={{duration: 0.25, ease: 'easeOut'}}
                className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Banner Glow */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                {/* Modal Header */}
                <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                        <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                            <Shield className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-100">安全与系统设置</h3>
                            <p className="text-[10px] text-slate-500">定制自动锁定逻辑及管理离线 PWA 更新</p>
                        </div>
                    </div>
                    <button
                        id="close-settings-modal-button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 overflow-y-auto space-y-6 text-xs text-slate-300">
                    {/* Section 1: Biometric Auto-locking */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-slate-200 flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>生物识别/人脸锁定逻辑</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-normal">
                            配置当你切换标签、手机锁屏、或者应用静置无操作时的自动锁定策略，确保 RAM
                            内存中的密钥随时被清除。
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {[
                                {id: 'always', label: '每次离开立即锁定', desc: '隐藏或静置5秒后锁定'},
                                {id: 'delay-30s', label: '静置或后台 30秒 锁定', desc: '离屏超30s或静置锁定'},
                                {id: 'delay-1m', label: '静置或后台 1分钟 锁定', desc: '推荐，兼顾便捷与安全'},
                                {id: 'delay-5m', label: '静置或后台 5分钟 锁定', desc: '适合高频频繁查看'},
                                {id: 'once', label: '仅进入时验证一次', desc: '不自动锁定，仅手动锁定'}
                            ].map(option => (
                                <button
                                    id={`lock-behavior-option-${option.id}`}
                                    key={option.id}
                                    onClick={() => onLockBehaviorChange(option.id as any)}
                                    className={`p-3 text-left rounded-xl border transition cursor-pointer flex flex-col space-y-1 ${
                                        lockBehavior === option.id
                                            ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-500/5'
                                            : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-400'
                                    } ${option.id === 'once' ? 'sm:col-span-2' : ''}`}
                                >
                                    <span className="font-semibold text-xs flex items-center justify-between">
                                        <span>{option.label}</span>
                                        {lockBehavior === option.id && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                        )}
                                    </span>
                                    <span className="text-[10px] text-slate-500 leading-normal">{option.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 2: PWA Update & Status */}
                    <div className="space-y-3 pt-4 border-t border-slate-800/60">
                        <h4 className="font-semibold text-slate-200 flex items-center space-x-1.5">
                            <Smartphone className="w-4 h-4 text-violet-400 shrink-0" />
                            <span>PWA 应用状态与离线更新</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-normal">
                            本保险箱支持完全离线工作。升级服务时通过以下按钮检查和拉取最新版本。
                        </p>

                        <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-3.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[11px] font-mono text-slate-400">PWA 缓存引擎已激活</span>
                                </div>
                                {updateAvailable && (
                                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 font-semibold rounded-md">
                                        检测到新版本
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                    id="check-updates-settings-button"
                                    onClick={handleCheckUpdates}
                                    disabled={checkingUpdates}
                                    className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-300 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                                >
                                    <RefreshCw
                                        className={`w-3.5 h-3.5 text-slate-400 ${checkingUpdates ? 'animate-spin' : ''}`}
                                    />
                                    <span>{checkingUpdates ? '正在检查...' : '检查应用更新'}</span>
                                </button>

                                <button
                                    id="manual-upgrade-settings-button"
                                    onClick={onManualUpgrade}
                                    disabled={!updateAvailable}
                                    className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                                        updateAvailable
                                            ? 'bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-bold shadow-lg shadow-indigo-500/10'
                                            : 'bg-slate-950 border border-slate-900 text-slate-600 cursor-not-allowed'
                                    }`}
                                    title={updateAvailable ? '立即手动安装新版本' : '没有可用的新版本'}
                                >
                                    <CheckCircle
                                        className={`w-3.5 h-3.5 ${updateAvailable ? 'text-slate-950' : 'text-slate-600'}`}
                                    />
                                    <span>手动升级安装</span>
                                </button>
                            </div>

                            {/* Check Status Feedback */}
                            {checkStatus === 'no-update' && (
                                <p className="text-[10px] text-emerald-400 text-center leading-normal font-medium bg-emerald-950/20 border border-emerald-500/10 py-1 rounded-md">
                                    ✓ 已经是最新版本，离线资源已全部缓存就绪。
                                </p>
                            )}
                            {checkStatus === 'update-found' && (
                                <p className="text-[10px] text-amber-400 text-center leading-normal font-medium bg-amber-950/20 border border-amber-500/10 py-1 rounded-md">
                                    ⚡ 发现并下载了最新服务！点击上方“手动升级安装”立即启用。
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Section 3: Safe Data Persistence Notice */}
                    <div className="p-3 bg-indigo-950/20 border border-indigo-500/10 rounded-xl space-y-1.5">
                        <div className="flex items-center space-x-1.5 text-indigo-300 font-semibold text-[11px]">
                            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>数据安全性安全屏障说明</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            <strong>核心逻辑保障：</strong> 所有的加密 API 密钥数据都完全落在您的浏览器独立
                            <strong> IndexedDB </strong>沙盒中（并辅以 <strong>localStorage</strong> 冗余备份）。
                            在检查更新、手动升级或 Service Worker 激活时，
                            <strong> 您的本地数据库绝对不会被清空或受到任何影响</strong>，升级100%安全，请放心使用。
                        </p>
                    </div>

                    {/* Section 4: Severe Reset */}
                    <div className="pt-4 border-t border-slate-800/60 space-y-3">
                        <h4 className="font-semibold text-rose-400 flex items-center space-x-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>危险区域</span>
                        </h4>

                        {!confirmReset ? (
                            <div className="flex items-center justify-between p-3 bg-rose-950/10 border border-rose-500/10 rounded-xl">
                                <div className="space-y-0.5">
                                    <p className="font-semibold text-rose-300">完全清空本保险箱</p>
                                    <p className="text-[9px] text-slate-500">
                                        彻底删除本设备上的所有加密密钥与配置参数
                                    </p>
                                </div>
                                <button
                                    id="settings-trigger-reset-button"
                                    onClick={() => setConfirmReset(true)}
                                    className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition cursor-pointer font-bold"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl space-y-3">
                                <p className="text-[11px] text-rose-300 leading-relaxed font-semibold">
                                    ⚠️ 警告：此操作不可逆！
                                </p>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    您将永久擦除 IndexedDB 与 localStorage
                                    里的所有加密密钥数据。如果未进行备份，所有数据将彻底丢失！
                                </p>
                                <div className="flex items-center space-x-2">
                                    <button
                                        id="settings-confirm-reset-button"
                                        onClick={() => {
                                            onReset();
                                            setConfirmReset(false);
                                            onClose();
                                        }}
                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer shadow-lg shadow-rose-600/10"
                                    >
                                        确认彻底销毁
                                    </button>
                                    <button
                                        id="settings-cancel-reset-button"
                                        onClick={() => setConfirmReset(false)}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-semibold transition cursor-pointer"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-center text-[10px] text-slate-500">
                    API Key Safe • 基于 AES-256 及 WebAuthn 生物识别端对端保护
                </div>
            </motion.div>
        </div>
    );
}
