import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Mic,
  Headphones,
  Radio,
  Sliders,
  AlertTriangle,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import { DeviceCatalog, AudioTelemetry } from '../types';

interface RoutingModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: DeviceCatalog;
  selectedInput: string;
  selectedVirtual: string;
  selectedMonitor: string;
  telemetry: AudioTelemetry;
  onSelectInput: (id: string) => void;
  onSelectVirtual: (id: string) => void;
  onSelectMonitor: (id: string) => void;
  onApplyDevices: () => Promise<void>;
  onRefreshDevices: () => Promise<void>;
}

export const RoutingModal: React.FC<RoutingModalProps> = ({
  isOpen,
  onClose,
  catalog,
  selectedInput,
  selectedVirtual,
  selectedMonitor,
  telemetry,
  onSelectInput,
  onSelectVirtual,
  onSelectMonitor,
  onApplyDevices,
  onRefreshDevices,
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  if (!isOpen) return null;

  const handleApply = async () => {
    setIsApplying(true);
    setApplySuccess(false);
    try {
      await onApplyDevices();
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 3000);
    } catch (err) {
      console.error('Failed to apply devices:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const inLevel = Math.min(100, Math.max(0, Math.round(telemetry.input_level * 100)));
  const outLevel = Math.min(100, Math.max(0, Math.round(telemetry.output_level * 100)));

  const physicalInputs = catalog.input_devices.filter((d) => !d.is_virtual_cable);
  const virtualInputs = catalog.input_devices.filter((d) => d.is_virtual_cable);

  const virtualOutputs = catalog.output_devices.filter((d) => d.is_virtual_cable);
  const physicalOutputs = catalog.output_devices.filter((d) => !d.is_virtual_cable);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1322] border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0A0E1A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
                Audio Devices & Hardware Routing
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Select your microphone, virtual cable for Discord/games, and monitoring headphones.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshDevices}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Rescan connected audio devices"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 font-sans">
          {/* Live Activity & Level Meters */}
          <div className="bg-[#131D31] p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" /> Mic Input Activity:
                </span>
                <span className="text-slate-300">{inLevel}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-75"
                  style={{ width: `${inLevel}%` }}
                ></div>
              </div>
            </div>

            <div className="flex-1 w-full space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" /> Output Activity:
                </span>
                <span className="text-slate-300">{outLevel}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all duration-75"
                  style={{ width: `${outLevel}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Section 1: Microphone (Input) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                <span>1. Microphone Input (Your Voice)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Select physical mic</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {physicalInputs.map((dev) => {
                const isSelected = selectedInput === dev.id;
                return (
                  <div
                    key={dev.id}
                    onClick={() => onSelectInput(dev.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-glow-cyan'
                        : 'bg-[#11192C]/80 hover:bg-[#15213B] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {dev.is_headphone ? (
                          <Headphones className="w-4 h-4" />
                        ) : (
                          <Mic className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          <span>{dev.name}</span>
                          {dev.is_default && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              System Default
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {dev.default_sample_rate} Hz &bull; {dev.default_channels} Channel(s)
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-slate-950"></div>}
                    </div>
                  </div>
                );
              })}

              {virtualInputs.length > 0 && (
                <div className="text-[11px] text-slate-500 italic px-1 pt-1">
                  Virtual devices hidden from microphone list to prevent echo loops.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Virtual Cable Output (To Discord / Games) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Radio className="w-4 h-4" />
                <span>2. Virtual Audio Cable (To Discord, Steam & Games)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Routing Bridge</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {virtualOutputs.length > 0 ? (
                virtualOutputs.map((dev) => {
                  const isSelected = selectedVirtual === dev.id;
                  return (
                    <div
                      key={dev.id}
                      onClick={() => onSelectVirtual(dev.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-glow-lime'
                          : 'bg-[#11192C]/80 hover:bg-[#15213B] border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Radio className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                            <span>{dev.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Recommended
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Virtual Audio Cable Output
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-slate-950"></div>}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-600/40 text-amber-300 text-xs flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold">No VB-CABLE Detected:</span> Please install VB-Audio
                    Virtual Cable to route your voice to Discord and games.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Monitor Headphones ("Hear Myself") */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <Headphones className="w-4 h-4" />
                <span>3. Monitor Headphones ("Hear Myself")</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Listening hardware</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {physicalOutputs.map((dev) => {
                const isSelected = selectedMonitor === dev.id;
                return (
                  <div
                    key={dev.id}
                    onClick={() => onSelectMonitor(dev.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-glow-cyan'
                        : 'bg-[#11192C]/80 hover:bg-[#15213B] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {dev.is_headphone ? (
                          <Headphones className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                          <span className="truncate">{dev.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {dev.is_default ? 'System Default' : `${dev.default_channels} Channels`}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-slate-950"></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Important Razer / Sidetone Note */}
          <div className="bg-[#141B2D] border border-cyan-500/30 rounded-2xl p-4 flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-bold text-cyan-300">
                Notice for Headsets with Hardware Sidetone (e.g. Razer Kraken / Synapse):
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If you have Razer Synapse <strong>"Mic Monitoring (Sidetone)"</strong> or Windows{' '}
                <strong>"Listen to this device"</strong> turned on, you will hear your natural dry
                voice directly through your headset hardware. Mute or turn down Sidetone in Razer
                Synapse so you only hear BroTalk's voice changer effects!
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer with Apply Button */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#0A0E1A] flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {applySuccess ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="w-4 h-4" /> Devices Connected & Routing Active!
              </span>
            ) : (
              <span>Changes take effect immediately upon applying.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="px-6 py-2.5 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 transition-all shadow-glow-cyan flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply & Connect Routing</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
