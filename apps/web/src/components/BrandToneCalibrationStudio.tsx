'use client';

import React, { useState, useRef } from 'react';
import { 
  Sliders, 
  Sparkles, 
  Save, 
  ShieldCheck, 
  RefreshCw, 
  Check 
} from 'lucide-react';
import type { Merchant } from '@recoverflow/core';

interface BrandToneCalibrationStudioProps {
  merchant: Merchant;
  onUpdateMerchant: (updated: Partial<Merchant>) => void;
}

export function BrandToneCalibrationStudio({ merchant, onUpdateMerchant }: BrandToneCalibrationStudioProps) {
  const [casualVsFormal, setCasualVsFormal] = useState(merchant.brandVoiceCasualVsFormal ?? 0.7);
  const [urgencyVsGentle, setUrgencyVsGentle] = useState(merchant.brandVoiceUrgencyVsGentle ?? 0.35);
  const [discountCeiling, setDiscountCeiling] = useState(merchant.discountCeilingPercentage ?? 15);
  const [guidelines, setGuidelines] = useState(merchant.brandToneGuidelines ?? '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Audio Cloning Sandbox State
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [cloning, setCloning] = useState(false);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | undefined>(merchant.customVoiceId);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleStartRecording = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        // Mock recording for unsupported environments
        setRecording(true);
        setRecordingSeconds(1);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      // Graceful fallback for mock mode
      setRecording(true);
      setRecordingSeconds(1);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleStopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleUploadVoiceClone = async () => {
    try {
      setCloning(true);
      const res = await fetch('/api/merchant/voice-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `${merchant.storeName} Founder Custom Voice`,
          durationSeconds: recordingSeconds || 45,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setClonedVoiceId(data.voiceId);
        onUpdateMerchant({ customVoiceId: data.voiceId });
      }
    } catch (err) {
      console.error('Voice clone failed:', err);
    } finally {
      setCloning(false);
    }
  };

  // Preview state
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [previewResult, setPreviewResult] = useState<{
    messageBody: string;
    callToActionUrl: string;
    suggestedDiscountCode: string | null;
    urgencyLevel: string;
    reasoning?: string;
    emailHtmlPreview?: string;
  } | null>(null);

  // Apply preset profiles
  const applyPreset = (preset: 'LUXURY' | 'PLAYFUL' | 'URGENT' | 'GENTLE') => {
    switch (preset) {
      case 'LUXURY':
        setCasualVsFormal(0.85);
        setUrgencyVsGentle(0.25);
        setDiscountCeiling(10);
        setGuidelines('Refined, understated elegance. Emphasize artisan heritage and materials.');
        break;
      case 'PLAYFUL':
        setCasualVsFormal(0.15);
        setUrgencyVsGentle(0.5);
        setDiscountCeiling(15);
        setGuidelines('Playful, fun, direct-to-consumer tone with friendly emojis and lighthearted excitement.');
        break;
      case 'URGENT':
        setCasualVsFormal(0.5);
        setUrgencyVsGentle(0.9);
        setDiscountCeiling(20);
        setGuidelines('High-urgency inventory alert. Highlight limited reserve units and expiring coupon.');
        break;
      case 'GENTLE':
        setCasualVsFormal(0.4);
        setUrgencyVsGentle(0.1);
        setDiscountCeiling(0);
        setGuidelines('Compassionate, helpful assistance. Resolve friction without pressure or aggressive discounts.');
        break;
    }
  };

  const handleGeneratePreview = async () => {
    try {
      setGeneratingPreview(true);
      const res = await fetch('/api/recovery/tone-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandVoiceCasualVsFormal: casualVsFormal,
          brandVoiceUrgencyVsGentle: urgencyVsGentle,
          discountCeilingPercentage: discountCeiling,
          brandToneGuidelines: guidelines,
          dropOffReason: 'CHECKOUT_STEP',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPreviewResult({
          ...data.recoveryOutput,
          emailHtmlPreview: data.emailHtmlPreview,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/recovery/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandVoiceCasualVsFormal: casualVsFormal,
          brandVoiceUrgencyVsGentle: urgencyVsGentle,
          discountCeilingPercentage: discountCeiling,
          brandToneGuidelines: guidelines,
        }),
      });
      if (res.ok) {
        onUpdateMerchant({
          brandVoiceCasualVsFormal: casualVsFormal,
          brandVoiceUrgencyVsGentle: urgencyVsGentle,
          discountCeilingPercentage: discountCeiling,
          brandToneGuidelines: guidelines,
        });
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Calibration Controls (5 cols) */}
      <div className="lg:col-span-6 bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" />
              Brand Tone Calibration
            </h3>
            {savedSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded">
                <Check className="w-3.5 h-3.5" /> Saved to Merchant Config
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Fine-tune the autonomous RecoveryAgent persona and margin guardrails.
          </p>
        </div>

        {/* Preset Buttons */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Presets</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: 'LUXURY', label: 'Luxury Atelier' },
                { id: 'PLAYFUL', label: 'Playful DTC' },
                { id: 'URGENT', label: 'Flash Urgency' },
                { id: 'GENTLE', label: 'White-Glove' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className="text-xs bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg py-2 font-medium transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-5 pt-2">
          {/* Slider 1: Casual vs Formal */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 font-medium">Casual / Playful</span>
              <span className="font-bold text-blue-400">{(casualVsFormal * 100).toFixed(0)}% Formal</span>
              <span className="text-zinc-300 font-medium">Formal / Prestigious</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={casualVsFormal}
              onChange={(e) => setCasualVsFormal(parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Slider 2: Gentle vs Urgency */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 font-medium">Gentle / Supportive</span>
              <span className="font-bold text-amber-400">{(urgencyVsGentle * 100).toFixed(0)}% Urgency</span>
              <span className="text-zinc-300 font-medium">High Urgency / Scarcity</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={urgencyVsGentle}
              onChange={(e) => setUrgencyVsGentle(parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Slider 3: Max Discount Ceiling */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 font-medium">0% (Zero Discounts)</span>
              <span className="font-bold text-emerald-400">Max Discount: {discountCeiling}%</span>
              <span className="text-zinc-300 font-medium">30% Ceiling</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={discountCeiling}
              onChange={(e) => setDiscountCeiling(parseInt(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Margin Guardrail: AI is strictly barred from negotiating discounts &gt; {discountCeiling}%.
            </div>
          </div>
        </div>

        {/* Guidelines Text Area */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Custom Brand Tone Directives
          </label>
          <textarea
            rows={3}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="e.g. Highlight sustainable Italian cashmere, keep sentences concise, never sound pushy."
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 text-zinc-200 text-xs rounded-lg p-3 outline-none transition"
          />
        </div>

        {/* Audio Cloning Sandbox (Track 3) */}
        <div className="border border-zinc-800 bg-zinc-950/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                VIP Founder Voice Cloning Sandbox
              </span>
            </div>
            {clonedVoiceId && (
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                {clonedVoiceId}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">
            Record a 15-60s voice sample. Our neural TTS engine clones the founder&apos;s voice for VIP recovery calls.
          </p>
          <div className="flex items-center gap-2">
            {!recording ? (
              <button
                type="button"
                onClick={handleStartRecording}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold py-1.5 px-3 rounded-lg border border-zinc-700 transition"
              >
                Start Recording (Mic)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg animate-pulse transition"
              >
                Stop Recording ({recordingSeconds}s)
              </button>
            )}

            <button
              type="button"
              onClick={handleUploadVoiceClone}
              disabled={cloning || (!audioBlob && !clonedVoiceId)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition"
            >
              {cloning ? 'Cloning TTS Voice...' : 'Save Cloned Voice'}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleGeneratePreview}
            disabled={generatingPreview}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition shadow-md disabled:opacity-50"
          >
            {generatingPreview ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Simulate Live Copy
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold py-2.5 px-4 rounded-lg transition border border-zinc-700"
          >
            <Save className="w-4 h-4" />
            Save Profile
          </button>
        </div>
      </div>

      {/* Right Column: Instant Live Preview Panel (6 cols) */}
      <div className="lg:col-span-6 bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Live Agent Copy Simulation
              </h3>
              <div className="text-xs text-zinc-400 mt-0.5">Sample Cart: Italian Leather Tote ($260.00)</div>
            </div>

            <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
              <button
                onClick={() => setPreviewChannel('WHATSAPP')}
                className={`px-3 py-1 rounded font-medium transition ${
                  previewChannel === 'WHATSAPP' ? 'bg-zinc-800 text-green-400' : 'text-zinc-400'
                }`}
              >
                WhatsApp
              </button>
              <button
                onClick={() => setPreviewChannel('EMAIL')}
                className={`px-3 py-1 rounded font-medium transition ${
                  previewChannel === 'EMAIL' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-400'
                }`}
              >
                Email
              </button>
            </div>
          </div>

          {/* Preview Container */}
          <div className="mt-4">
            {previewChannel === 'WHATSAPP' ? (
              /* WhatsApp Smartphone Mockup */
              <div className="max-w-sm mx-auto bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                {/* WhatsApp Header */}
                <div className="bg-[#1f2c34] p-3 flex items-center gap-3 border-b border-zinc-800">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                    {merchant.storeName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{merchant.storeName}</div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Official WhatsApp Store
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Area */}
                <div className="p-4 bg-[#0b141a] min-h-[220px] flex flex-col justify-end space-y-2">
                  <div className="bg-[#005c4b] text-zinc-100 text-xs p-3 rounded-xl rounded-tl-none max-w-[90%] shadow-md leading-relaxed">
                    {previewResult ? (
                      previewResult.messageBody
                    ) : (
                      "Hello Alex! We noticed you were looking at the Minimalist Italian Leather Tote at Aurora Luxury Apparel. We've reserved your selection so you don't lose out. Tap below to complete your checkout with express delivery!"
                    )}
                    <div className="mt-1 text-[9px] text-zinc-400 text-right">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </div>
                  </div>

                  {previewResult?.suggestedDiscountCode && (
                    <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center justify-between">
                      <span>Applied Courtesy:</span>
                      <span className="tracking-wider">{previewResult.suggestedDiscountCode}</span>
                    </div>
                  )}

                  <div className="bg-[#1f2c34] text-blue-400 text-center text-xs font-medium py-2 rounded-lg border border-zinc-700/50 cursor-pointer">
                    Complete Secure Checkout &rarr;
                  </div>
                </div>
              </div>
            ) : (
              /* Email Preview Frame */
              <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-950 text-xs text-zinc-300 space-y-3 max-h-[300px] overflow-y-auto">
                <div className="text-zinc-500 text-[11px] pb-2 border-b border-zinc-800 flex justify-between">
                  <span>Subject: Complete your order at {merchant.storeName}</span>
                  <span className="text-emerald-400">Resend Engine</span>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-zinc-100">Hello Alex,</p>
                  <p className="text-zinc-400 leading-relaxed">
                    {previewResult ? previewResult.messageBody : "We noticed you left the Minimalist Italian Leather Tote in your bag. Complete your purchase now before reservation expires."}
                  </p>
                  {previewResult?.suggestedDiscountCode && (
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 font-semibold text-center">
                      Coupon Applied: {previewResult.suggestedDiscountCode}
                    </div>
                  )}
                  <div className="p-3 bg-zinc-900 rounded border border-zinc-800 flex justify-between items-center">
                    <span>Minimalist Italian Leather Tote x1</span>
                    <span className="font-bold text-white">$260.00</span>
                  </div>
                  <div className="text-center pt-2">
                    <span className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg inline-block">
                      Complete Order &rarr;
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reasoning Breakdown */}
        {previewResult?.reasoning && (
          <div className="p-3 bg-zinc-950/90 border border-zinc-800 rounded-lg text-xs text-zinc-400">
            <span className="font-semibold text-blue-400">Agent Persona Strategy: </span>
            {previewResult.reasoning}
          </div>
        )}
      </div>
    </div>
  );
}
