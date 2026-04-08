"use client";

import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import {
  type SessionChatListItem,
  useSessionChats,
} from "@/hooks/use-session-chats";
import type { Session } from "@/lib/db/schema";
import { GitPanelProvider } from "./chats/[chatId]/git-panel-context";
import { SessionHeader } from "./chats/[chatId]/session-header";
import { ChatTabs } from "./chats/[chatId]/chat-tabs";
import { SessionLayoutContext } from "./session-layout-context";

type SessionLayoutShellProps = {
  session: Session;
  initialChatsData?: {
    defaultModelId: string | null;
    chats: SessionChatListItem[];
  };
  children: ReactNode;
};

export function SessionLayoutShell({
  session: initialSession,
  initialChatsData,
  children,
}: SessionLayoutShellProps) {
  const router = useRouter();
  const params = useParams<{ chatId?: string }>();
  const activeChatId = params.chatId ?? "";

  const sessionId = initialSession.id;

  const {
    chats,
    loading: chatsLoading,
    createChat,
    deleteChat,
    renameChat,
  } = useSessionChats(sessionId, { initialData: initialChatsData });

  const switchChat = useCallback(
    (chatId: string) => {
      router.push(`/sessions/${sessionId}/chats/${chatId}`);
    },
    [router, sessionId],
  );

  const layoutContext = useMemo(
    () => ({
      session: {
        title: initialSession.title,
        repoName: initialSession.repoName,
        repoOwner: initialSession.repoOwner,
        cloneUrl: initialSession.cloneUrl,
        branch: initialSession.branch,
        status: initialSession.status,
        prNumber: initialSession.prNumber,
        linesAdded: initialSession.linesAdded,
        linesRemoved: initialSession.linesRemoved,
      },
      chats,
      chatsLoading,
      createChat,
      switchChat,
      deleteChat,
      renameChat,
    }),
    [initialSession, chats, chatsLoading, createChat, switchChat, deleteChat, renameChat],
  );

  return (
    <SessionLayoutContext.Provider value={layoutContext}>
      <GitPanelProvider>
        {/*
          The children (SessionChatContent) renders a flex row with:
            - left column (chat/diff content)
            - right column (GitPanel, when open)
          Both header and tabs persist here at layout level.
          The children div uses flex-1 to fill remaining vertical space,
          and the page content inside creates the horizontal split with the panel.
        */}
        <SessionHeader />
        {activeChatId && (
          <ChatTabs activeChatId={activeChatId} />
        )}
        {/* flex-1 + min-h-0 lets the page content (which is a flex row with
            chat + panel) fill the remaining height correctly */}
        <div className="min-h-0 flex-1">
          {children}
        </div>
      </GitPanelProvider>
    </SessionLayoutContext.Provider>
  );
}
