import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Search, Send, XCircle } from 'lucide-react';
import Pagination from '../components/Pagination';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService } from '../services/api';
import {
  AppChatConversation,
  AppChatConversationStatus,
  AppChatSenderType,
  UserRole,
} from '../types';
import { hasPageAction } from '../utils/employeePermissions';
import { showError, showSuccess } from '../utils/notifications';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';

const AGENT_KEY = 'wakeel_app_chat_agentId';

const AppChatConversationsPage: React.FC = () => {
  const { user } = useAuth();
  const { formatDate } = useDigits();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;
  const canReply = !user || user.role !== UserRole.Employee || hasPageAction(user, 'AppChats', 'reply');

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(STANDARD_PAGE_SIZE_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [needsHumanOnly, setNeedsHumanOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents', 1, 100],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 100 }),
    enabled: isAdmin,
  });
  const agents = useMemo(() => agentsResponse?.data ?? [], [agentsResponse]);

  useEffect(() => {
    if (!isAdmin || !agents.length) return;
    const saved = localStorage.getItem(AGENT_KEY);
    if (saved && agents.some((a) => a.id === saved)) setSelectedAgentId(saved);
    else if (!selectedAgentId) setSelectedAgentId(agents[0]?.id ?? '');
  }, [isAdmin, agents, selectedAgentId]);

  useEffect(() => {
    if (!isAdmin || !selectedAgentId) return;
    localStorage.setItem(AGENT_KEY, selectedAgentId);
  }, [isAdmin, selectedAgentId]);

  const agentId = isAdmin ? selectedAgentId || undefined : undefined;
  const canLoad = isAdmin ? !!selectedAgentId : true;

  const listQuery = useQuery({
    queryKey: [
      'app-chat-list',
      agentId ?? 'self',
      page,
      pageSize,
      appliedSearch,
      needsHumanOnly,
      unreadOnly,
    ],
    queryFn: () =>
      apiService.getAppChatConversations({
        page,
        pageSize,
        searchTerm: appliedSearch || undefined,
        agentId,
        needsHumanOnly: needsHumanOnly || undefined,
        unreadOnly: unreadOnly || undefined,
      }),
    enabled: canLoad,
    refetchInterval: 15000,
  });

  const detailQuery = useQuery({
    queryKey: ['app-chat-detail', selectedId, agentId ?? 'self'],
    queryFn: () => apiService.getAppChatConversation(selectedId!, agentId),
    enabled: canLoad && !!selectedId,
    refetchInterval: 8000,
  });

  const conversations = listQuery.data?.data ?? [];
  const selected: AppChatConversation | undefined = detailQuery.data;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages?.length]);

  const replyMutation = useMutation({
    mutationFn: () => apiService.replyAppChat(selectedId!, reply.trim(), agentId),
    onSuccess: () => {
      setReply('');
      showSuccess('تم إرسال الرد');
      queryClient.invalidateQueries({ queryKey: ['app-chat-list'] });
      queryClient.invalidateQueries({ queryKey: ['app-chat-detail', selectedId] });
    },
    onError: (e: any) => showError(e?.response?.data?.message || 'فشل إرسال الرد'),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiService.closeAppChat(selectedId!, agentId),
    onSuccess: () => {
      showSuccess('تم إغلاق المحادثة');
      queryClient.invalidateQueries({ queryKey: ['app-chat-list'] });
      queryClient.invalidateQueries({ queryKey: ['app-chat-detail', selectedId] });
    },
    onError: (e: any) => showError(e?.response?.data?.message || 'فشل إغلاق المحادثة'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-sky-600" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">محادثات التطبيق</h1>
        </div>
        {isAdmin && (
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setSelectedId(null);
              setPage(1);
            }}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.businessName || a.fullName || a.username}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setAppliedSearch(searchTerm.trim());
                setPage(1);
              }
            }}
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <input
            type="checkbox"
            checked={needsHumanOnly}
            onChange={(e) => {
              setNeedsHumanOnly(e.target.checked);
              setPage(1);
            }}
          />
          بانتظار الدعم
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
          />
          غير مقروء
        </label>
        <button
          type="button"
          onClick={() => {
            setAppliedSearch(searchTerm.trim());
            setPage(1);
          }}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
        >
          بحث
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {listQuery.isLoading && (
              <div className="p-6 text-center text-sm text-slate-500">جاري التحميل...</div>
            )}
            {!listQuery.isLoading && conversations.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">لا توجد محادثات</div>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full px-4 py-3 text-right transition ${
                  selectedId === c.id
                    ? 'bg-sky-50 dark:bg-sky-950/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-slate-900 dark:text-white">
                      {c.subscriberName}
                    </div>
                    <div className="truncate text-xs text-slate-500" dir="ltr">
                      {c.subscriberUsername || c.subscriberPhone || '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {c.hasUnreadByAdmin && (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        جديد
                      </span>
                    )}
                    {c.needsHuman && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        دعم بشري
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                  {c.lastMessagePreview || '—'}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            <Pagination
              currentPage={listQuery.data?.currentPage ?? page}
              totalPages={listQuery.data?.totalPages ?? 1}
              totalItems={listQuery.data?.totalItems ?? 0}
              pageSize={pageSize}
              hasNextPage={!!listQuery.data?.hasNextPage}
              hasPreviousPage={!!listQuery.data?.hasPreviousPage}
              onPageChange={setPage}
              pageSizeOptions={STANDARD_PAGE_SIZE_OPTIONS}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {!selectedId && (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
              اختر محادثة لعرض الرسائل والرد
            </div>
          )}
          {selectedId && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {selected?.subscriberName || 'محادثة'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selected?.statusLabel}
                    {selected?.subscriberPhone ? ` · ${selected.subscriberPhone}` : ''}
                  </div>
                </div>
                {canReply && selected?.status !== AppChatConversationStatus.Closed && (
                  <button
                    type="button"
                    onClick={() => closeMutation.mutate()}
                    disabled={closeMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    إغلاق
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {(selected?.messages ?? []).map((m) => {
                  const mine = m.senderType === AppChatSenderType.Admin;
                  const bot = m.senderType === AppChatSenderType.Bot;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? 'bg-sky-600 text-white'
                            : bot
                              ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                              : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                        }`}
                      >
                        <div className="mb-1 text-[11px] font-bold opacity-80">
                          {m.senderTypeLabel}
                          {m.adminName ? ` · ${m.adminName}` : ''}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                        <div className="mt-1 text-[10px] opacity-70">
                          {formatDate(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {canReply && selected?.status !== AppChatConversationStatus.Closed && (
                <div className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder="اكتب رد الدعم الفني..."
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    disabled={!reply.trim() || replyMutation.isPending}
                    onClick={() => replyMutation.mutate()}
                    className="inline-flex items-center gap-1 self-end rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    إرسال
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppChatConversationsPage;
