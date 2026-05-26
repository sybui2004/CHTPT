import { useState, useEffect, useContext } from "react"
import { fetchWithAuth } from "../../../util/AuthUtil"
import { BASE_API_URL } from "../../../constants"
import ChatContext from "./ChatProvider"
import { useDispatch, useSelector } from "react-redux"
import { setUserId } from "../../../redux/chatSlice"
import { FiMessageCircle } from "react-icons/fi"

function ChatAvatar({ src, name, size = "h-11 w-11", textSize = "text-lg" }) {
    const [failed, setFailed] = useState(false)
    const initial = (name || "C")[0].toUpperCase()

    if (src && !failed) {
        return (
            <img
                src={src}
                alt={name}
                className={`${size} rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-gray-100`}
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        <div className={`${size} rounded-full border-2 border-white bg-blue-100 shadow-sm ring-1 ring-gray-100 flex items-center justify-center`}>
            <span className={`${textSize} font-semibold text-blue-600`}>
                {initial}
            </span>
        </div>
    )
}

export default function Sidebar() {
    const dispatch = useDispatch()
    const { newMessage } = useContext(ChatContext)
    const chatCtx = useContext(ChatContext)
    const chatWithUserId = useSelector(state => state.chat.userId)
    const roomLimit = 10
    const [roomOffset, setRoomOffset] = useState(0)

    const fetchRecentChatroom = (reset = false) => {
        fetchWithAuth(`${BASE_API_URL}/v1/chat/get_chatroom_list?offset=${roomOffset}&limit=${roomLimit}`, window.location.pathname, true)
            .then(res => res.json())
            .then(res => {
                if (!res.message) {
                    if (reset) chatCtx.setRecentRoomList(res.content)
                    else chatCtx.setRecentRoomList(prev => [...prev, ...res.content])
                    setRoomOffset(res.nextOffset)
                }
            })
    }

    const processNewMsg = async () => {
        let existedRoom = false
        await chatCtx.setRecentRoomList(prev => {
            const updated = prev.map(r => {
                if (r.id === newMessage.chatroomId) {
                    chatCtx.setUnreadRooms(urs => {
                        const exists = urs.some(room => room.id === newMessage.chatroomId)
                        if (!exists) return [...urs, r]
                        return urs
                    })
                    existedRoom = true
                    return { ...r, lastMessage: newMessage, read: chatCtx.curChatroom?.id === r.id }
                }
                return r
            })
            return updated
        })
        if (!existedRoom) fetchRecentChatroom(true)
    }

    useEffect(() => {
        if (!newMessage || !chatCtx.firstExpand) return
        processNewMsg()
    }, [newMessage])

    useEffect(() => {
        if (!chatCtx.firstExpand) {
            chatCtx.setFirstExpand(true)
            fetchRecentChatroom()
        }
    }, [])

    const formatTime = (date) => {
        if (!date) return ""
        const d = new Date(date)
        const now = new Date()
        const diff = Math.floor((now - d) / 1000)
        if (diff < 60) return "Vừa xong"
        if (diff < 3600) return `${Math.floor(diff / 60)}ph`
        if (diff < 86400) return `${Math.floor(diff / 3600)}gi`
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
    }

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-white">
            {/* Search hint */}
            <div className="border-b border-gray-100 bg-slate-50/80 px-3 py-3">
                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100">
                    <FiMessageCircle size={15} className="shrink-0 text-blue-500" />
                    <span className="text-xs font-medium text-gray-600">Danh sách chat</span>
                </div>
            </div>

            {/* Room list */}
            <div className="flex-1 overflow-y-auto">
                {chatCtx.recentRoomList.length > 0 ? (
                    chatCtx.recentRoomList.map(room => {
                        // Defensive: ensure receiver exists
                        const receiver = room.receiver || { id: "", displayName: "Chat", shopName: "", thumbnailUrl: "" };
                        const receiverName = receiver.displayName || receiver.shopName || receiver.fullName || receiver.username || "Chat";
                        const isActive = chatWithUserId === receiver.id;
                        const hasUnread = chatCtx.unreadRooms.some(ur => ur.id === room.id) || !room.read
                        return (
                            <button
                                key={room.id}
                                className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-3 text-left transition-colors ${
                                    isActive ? "bg-blue-50" : "hover:bg-slate-50"
                                }`}
                                onClick={() => {
                                    chatCtx.setUnreadRooms(prev => prev.filter(r => r.id !== room.id))
                                    chatCtx.setRecentRoomList(prev => prev.map(r => {
                                        if (r.id === room.id) r.read = true
                                        return r
                                    }))
                                    dispatch(setUserId(receiver.id))
                                }}
                            >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <ChatAvatar src={receiver.thumbnailUrl} name={receiverName} />
                                    {hasUnread && (
                                        <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <p className={`truncate text-sm ${hasUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                                            {receiverName}
                                        </p>
                                        {room.lastMessage && (
                                            <span className="text-[10px] text-gray-400 shrink-0">
                                                {formatTime(room.lastMessage.createdAt)}
                                            </span>
                                        )}
                                    </div>
                                    {room.lastMessage && (
                                        <p className={`mt-1 truncate text-xs ${hasUnread ? "font-medium text-blue-600" : "text-gray-400"}`}>
                                            {room.lastMessage.type === "TEXT" ? room.lastMessage.content : "Ảnh"}
                                        </p>
                                    )}
                                </div>
                            </button>
                        )
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2 px-5 py-14 text-center text-gray-400">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 ring-1 ring-gray-100">
                            <FiMessageCircle size={24} className="text-blue-200" />
                        </div>
                        <p className="text-sm font-medium text-gray-500">Chưa có cuộc trò chuyện</p>
                    </div>
                )}
            </div>
        </div>
    )
}
