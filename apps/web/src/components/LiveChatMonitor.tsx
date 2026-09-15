'use client';

import React, { useState } from 'react';
import { 
  MessageSquare, 
  ShieldAlert, 
  Sparkles, 
  Send, 
  UserCheck, 
  Bot, 
  Mic, 
  History, 
  Volume2 
} from 'lucide-react';
import type { CartEvent, MessageLog } from '@recoverflow/core';
import { FunnelReplayModal } from './FunnelReplayModal';

interface LiveChatMonitorProps {
  carts: CartEvent[];
  messages: MessageLog[];
}

export function LiveChatMonitor({ carts }: LiveChatMonitorProps) {
  // Select first cart with phone or active status
  const activeCarts = carts.filter((c) => c.customerPhone);
  const [selectedCartId, setSelectedCartId] = useState<string>(activeCarts[0]?.id || '');
  const [isTakenOver, setIsTakenOver] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [sendingManual, setSendingManual] = useState(false);
  const [showReplayModal, setShowReplayModal] = useState(false);

  const selectedCart = carts.find((c) => c.id === selectedCartId) || activeCarts[0];

  // Simulated multi-turn conversation with multimodal voice & image attachments
  const defaultConversation = [
    {
      id: 'c1',
      role: 'assistant',
      sender: 'RecoverFlow AI Concierge',
      text: `Hello ${selectedCart?.customerName || 'Sarah'}! We noticed your cart containing the ${selectedCart?.items[0]?.title || 'Cardigan'} was saved at Aurora Luxury Apparel. Can we answer any questions before we pack your order?`,
      time: '10:42 AM',
      isAI: true,
    },
    {
      id: 'c2',
      role: 'user',
      sender: selectedCart?.customerName || 'Customer',
      text: 'Hi! Can you tell me if this fits true to size? I usually wear a US 6.',
      time: '10:44 AM',
      isAI: false,
    },
    {
      id: 'c3',
      role: 'assistant',
      sender: 'RecoverFlow AI Concierge',
      text: 'Yes! It fits true to size with a tailored, comfortable drape. For a US 6, size Small is ideal. Plus, our orders include complimentary 30-day exchanges!',
      time: '10:45 AM',
      isAI: true,
    },
    {
      id: 'c4_voice',
      role: 'user',
      sender: selectedCart?.customerName || 'Customer',
      text: '"Hey, I love this jacket, but I was wondering if the linen fabric is light enough for 85-degree summer evenings in Austin?"',
      time: '10:46 AM',
      isAI: false,
      isVoiceNote: true,
      audioDuration: '0:14',
    },
    {
      id: 'c5_voice_reply',
      role: 'assistant',
      sender: 'RecoverFlow AI Concierge',
      text: 'Great question! This piece uses pure 180 GSM Belgian flax linen—specifically loomed for ultra-breathable airflow in high-humidity climates. It is perfect for 85°F evenings without clinging.',
      time: '10:47 AM',
      isAI: true,
      multimodalDecoded: true,
    },
    {
      id: 'c6',
      role: 'user',
      sender: selectedCart?.customerName || 'Customer',
      text: 'Could you do 25% off? I found another brand with a discount code.',
      time: '10:48 AM',
      isAI: false,
    },
    {
      id: 'c7',
      role: 'assistant',
      sender: 'RecoverFlow AI Concierge',
      text: `We'd love to welcome you! While our direct-to-consumer prices protect our artisanal weavers, the maximum courtesy authorized for your basket is 15% (code: SAVE15). You can claim it here: ${selectedCart?.checkoutUrl || '#'}?discount=SAVE15`,
      time: '10:49 AM',
      isAI: true,
      marginProtected: true,
    },
  ];

  const handleToggleTakeover = async () => {
    const nextState = !isTakenOver;
    setIsTakenOver(nextState);
    if (selectedCart) {
      await fetch('/api/chat/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: selectedCart.id, isTakenOver: nextState }),
      });
    }
  };

  const handleSendManual = async () => {
    if (!manualInput.trim() || !selectedCart) return;
    try {
      setSendingManual(true);
      await fetch('/api/chat/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: selectedCart.id,
          isTakenOver: true,
          manualMessage: manualInput.trim(),
        }),
      });
      setManualInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setSendingManual(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl min-h-[560px]">
      {/* Sidebar: Conversation Threads (4 cols) */}
      <div className="lg:col-span-4 border-r border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-400" />
              Active WhatsApp Threads
            </h3>
            <span className="text-[10px] bg-green-500/10 text-green-400 font-bold px-2 py-0.5 rounded-full border border-green-500/20">
              {activeCarts.length} Live
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {activeCarts.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCartId(c.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedCart?.id === c.id
                    ? 'bg-zinc-800/90 border-blue-500/50 shadow-md'
                    : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-zinc-200 text-xs">{c.customerName || 'Shopper'}</span>
                  <span className="text-[10px] text-zinc-500">
                    ${c.totalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 truncate mt-1">
                  {c.items[0]?.title || 'Items in cart'}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {c.recoveryStage}
                  </span>
                  <span className="text-[10px] text-zinc-500">{c.customerPhone}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs text-zinc-400 mt-4">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-200 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Concierge Safety Guardrail
          </div>
          Autonomous agent will never negotiate below merchant margin or invent false inventory.
        </div>
      </div>

      {/* Main Chat Area (8 cols) */}
      <div className="lg:col-span-8 flex flex-col justify-between bg-zinc-900/40">
        {/* Chat Header */}
        <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              {(selectedCart?.customerName || 'S').charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-white text-sm flex items-center gap-2">
                {selectedCart?.customerName || 'Guest Customer'}
                <span className="text-xs text-zinc-400 font-normal">({selectedCart?.customerPhone})</span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Cart: <span className="text-zinc-200 font-medium">${selectedCart?.totalPrice.toFixed(2)}</span> • {selectedCart?.abandonmentType}
              </div>
            </div>
          </div>

          {/* Action Buttons: Session Replay & Admin Takeover */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReplayModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 transition"
              title="Inspect session intent & exit telemetry"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>Session Replay</span>
            </button>

            <button
              onClick={handleToggleTakeover}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                isTakenOver
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {isTakenOver ? (
                <>
                  <UserCheck className="w-4 h-4 text-rose-400" />
                  <span>Admin Takeover (Active)</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span>AI Concierge (Autonomous)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[380px] flex-1">
          {defaultConversation.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-start' : 'items-end'}`}
            >
              <div className="text-[10px] text-zinc-500 mb-1 flex items-center gap-1.5">
                {msg.isAI ? <Sparkles className="w-3 h-3 text-blue-400" /> : <UserCheck className="w-3 h-3 text-zinc-400" />}
                <span>{msg.sender}</span>
                <span>• {msg.time}</span>
                {msg.isVoiceNote && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded-full border border-emerald-500/20">
                    <Mic className="w-2.5 h-2.5" /> WhatsApp Audio Note ({msg.audioDuration})
                  </span>
                )}
              </div>

              {msg.isVoiceNote ? (
                <div className="bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-none border border-zinc-700 p-3.5 space-y-2 max-w-[80%]">
                  <div className="flex items-center gap-3 bg-zinc-900/90 rounded-xl p-2.5 border border-zinc-800">
                    <button className="w-8 h-8 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shrink-0 shadow">
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <div className="flex-1 flex items-center gap-1">
                      {[40, 75, 55, 90, 65, 80, 45, 95, 70, 50, 85, 60, 40, 70, 90, 60, 50, 30].map((h, i) => (
                        <span key={i} className="w-1 bg-emerald-400 rounded-full" style={{ height: `${h * 0.22}px` }} />
                      ))}
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">{msg.audioDuration}</span>
                  </div>
                  <div className="text-xs text-zinc-300 italic">
                    <span className="text-emerald-400 font-medium not-italic">Gemini Speech-to-Intent: </span>
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div
                  className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                  }`}
                >
                  {msg.text}
                </div>
              )}

              {msg.marginProtected && (
                <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                  ✓ Protected: Refused 25% request; offered max allowed 15% courtesy.
                </div>
              )}
            </div>
          ))}

          {isTakenOver && (
            <div className="text-center py-2">
              <span className="text-xs bg-rose-950/60 border border-rose-500/30 text-rose-300 px-3 py-1 rounded-full font-medium">
                AI paused — You are directly communicating with the customer
              </span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendManual()}
              placeholder={
                isTakenOver
                  ? 'Type WhatsApp reply as store associate...'
                  : 'Take over chat above to send manual response...'
              }
              disabled={!isTakenOver}
              className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-zinc-200 text-xs rounded-xl px-4 py-3 outline-none disabled:opacity-50 transition"
            />
            <button
              onClick={handleSendManual}
              disabled={!isTakenOver || !manualInput.trim() || sendingManual}
              className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl disabled:opacity-40 transition shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showReplayModal && selectedCart && (
        <FunnelReplayModal
          cart={selectedCart}
          onClose={() => setShowReplayModal(false)}
        />
      )}
    </div>
  );
}
