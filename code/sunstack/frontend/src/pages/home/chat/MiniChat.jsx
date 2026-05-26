import { useEffect, useContext } from "react";
import { FiMessageCircle } from "react-icons/fi";
import ChatContext from "./ChatProvider";
import { useSelector } from "react-redux";
import { fetchWithAuth, getJwtUsername } from "../../../util/AuthUtil";
import { BASE_API_URL } from "../../../constants";
import SocketContext from "../../common/WebsocketProvider";
import { ToastContainer } from "react-toastify";
import ChatPanel from "./ChatPanel";

export default function MiniChat() {
    const { isConnected, subscribeToChanel } = useContext(SocketContext);
    const chatCtx = useContext(ChatContext);
    const chatWithUserId = useSelector((state) => state.chat.userId);
    const chatOpen = useSelector((state) => state.chat.chatOpen);

    const getUnreadRooms = () => {
        if (!localStorage.getItem("access_token")) return;
        fetchWithAuth(`${BASE_API_URL}/v1/chat/get_unread_rooms`)
            .then(res => {
                if (!res || !res.ok) return null;
                return res.json().catch(() => null);
            })
            .then(data => {
                if (data !== null) chatCtx.setUnreadRooms(data.content || []);
            })
            .catch(() => {});
    };

    useEffect(() => { getUnreadRooms(); }, []);

    useEffect(() => {
        if (chatWithUserId && !chatCtx.expand) chatCtx.setExpand(true);
    }, [chatWithUserId]);

    useEffect(() => {
        if (chatOpen && !chatCtx.expand) chatCtx.setExpand(true);
    }, [chatOpen]);

    useEffect(() => {
        if (!isConnected) return
        const username = getJwtUsername();
        subscribeToChanel(`/user/${username}/chat.queue`, (mes) => {
            console.log("[WS] Received chat.queue message:", mes);
            chatCtx.setUnreadRooms(urs => {
                const exists = urs.some(room => room.id === mes.chatroomId);
                return exists ? urs : [...urs, { id: mes.chatroomId }];
            });
            chatCtx.setNewMessage(mes);
        });
        subscribeToChanel(`/user/${username}/chat.reply`, (mes) => {
            console.log("[WS] Received chat.reply message:", mes);
            chatCtx.setReplySignalMessage(mes);
        });
    }, [isConnected, subscribeToChanel]);

    const unread = chatCtx.unreadRooms.length;

    return (
        <div className="fixed bottom-5 right-5 z-[200] flex flex-col items-end gap-3">
            {/* Chat panel — pops above the bubble */}
            {chatCtx.expand && <ChatPanel />}

            {/* Floating bubble button */}
            <button
                className="relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_14px_35px_rgba(37,99,235,0.35)] ring-1 ring-white/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:scale-95"
                onClick={() => chatCtx.setExpand(prev => !prev)}
                aria-label="Mở tin nhắn"
                title="Tin nhắn"
            >
                <FiMessageCircle size={25} strokeWidth={2.4} />
                {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            <ToastContainer position="bottom-right" />
        </div>
    );
}
