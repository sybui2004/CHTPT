import { useContext } from "react";
import ChatContext from "./ChatProvider";
import Sidebar from "./Sidebar";
import ChatZone from "./ChatZone";
import { FiX, FiChevronLeft, FiMessageCircle } from "react-icons/fi";

export default function ChatPanel() {
    const chatCtx = useContext(ChatContext);
    const hasChatroom = chatCtx.curChatroom !== null;
    const receiverName = chatCtx.curChatroom?.receiver?.displayName
        || chatCtx.curChatroom?.receiver?.shopName
        || chatCtx.curChatroom?.receiver?.fullName
        || chatCtx.curChatroom?.receiver?.username
        || "Chat";

    return (
        <div className="
            /* Mobile: fixed full-screen */
            fixed inset-0 z-[199]
            /* Desktop: floating panel above bubble */
            sm:relative sm:inset-auto sm:z-auto
            sm:w-[560px] sm:h-[560px]
            sm:rounded-[18px] sm:shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:overflow-hidden
            flex flex-col bg-white border border-blue-100/80
        ">
            {/* ── Header ── */}
            <div className="flex items-center gap-3 bg-blue-600 px-4 py-3.5 text-white shadow-sm shrink-0">
                {/* Back button (mobile only, when chatroom open) */}
                {hasChatroom && (
                    <button
                        className="sm:hidden p-1 -ml-1 rounded-full hover:bg-white/20 cursor-pointer transition-colors"
                        onClick={() => chatCtx.setCurChatroom(null)}
                    >
                        <FiChevronLeft size={20} />
                    </button>
                )}

                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                        <FiMessageCircle size={17} strokeWidth={2.4} />
                    </span>
                    <span className="truncate text-sm font-semibold">
                        {hasChatroom && chatCtx.curChatroom.receiver ? receiverName : "Tin nhắn"}
                    </span>
                    {chatCtx.unreadRooms.length > 0 && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                            {chatCtx.unreadRooms.length}
                        </span>
                    )}
                </div>

                <button
                    className="p-1.5 rounded-full hover:bg-white/20 cursor-pointer transition-colors shrink-0"
                    onClick={() => chatCtx.setExpand(false)}
                    title="Đóng"
                >
                    <FiX size={16} />
                </button>
            </div>

            {/* ── Body: sidebar list + chat zone ── */}
            <div className="flex-1 flex overflow-hidden">
                {/* On mobile: show either Sidebar OR ChatZone */}
                {/* On desktop: always show both side by side */}

                {/* Sidebar (conversation list) */}
                <div className={`
                    ${hasChatroom ? "hidden sm:flex" : "flex"}
                    flex-col border-r border-gray-100 sm:w-[220px] w-full flex-shrink-0
                `}>
                    <Sidebar />
                </div>

                {/* Chat zone */}
                <div className={`
                    ${hasChatroom ? "flex" : "hidden sm:flex"}
                    flex-1 flex-col overflow-hidden
                `}>
                    <ChatZone />
                </div>
            </div>
        </div>
    );
}
