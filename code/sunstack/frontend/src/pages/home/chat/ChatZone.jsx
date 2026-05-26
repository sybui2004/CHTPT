import { useSelector } from "react-redux";
import { useEffect, useContext, useState, useRef } from "react";
import { FaImage } from "react-icons/fa6";
import { IoMdSend } from "react-icons/io";
import { FaTimes } from "react-icons/fa";
import { FiMessageCircle, FiExternalLink } from "react-icons/fi";
import { useDispatch } from "react-redux";
import { setUserId } from "../../../redux/chatSlice";
import ChatContext from "./ChatProvider";
import { fetchWithAuth, getJwtUsername } from "../../../util/AuthUtil";
import { uploadImages } from "../../../util/UploadUtil";
import { BASE_API_URL } from "../../../constants";
import SocketContext from "../../common/WebsocketProvider";
import { toast } from "react-toastify";

function ChatAvatar({ src, name, size = "h-9 w-9", textSize = "text-sm", className = "" }) {
    const [failed, setFailed] = useState(false)
    const initial = (name || "C")[0].toUpperCase()

    if (src && !failed) {
        return (
            <img
                src={src}
                alt={name}
                className={`${size} rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-gray-100 ${className}`}
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        <div className={`${size} rounded-full border-2 border-white bg-blue-100 shadow-sm ring-1 ring-gray-100 flex items-center justify-center ${className}`}>
            <span className={`${textSize} font-semibold text-blue-600`}>
                {initial}
            </span>
        </div>
    )
}

function MessageImage({ src, onOpen }) {
    const [failed, setFailed] = useState(false)

    if (!src || failed) {
        return (
            <div className="flex h-20 w-36 items-center justify-center rounded-2xl border border-gray-100 bg-white text-xs text-gray-400 shadow-sm">
                Không tải được ảnh
            </div>
        )
    }

    return (
        <img
            src={src}
            alt="media"
            className="max-w-[180px] rounded-2xl cursor-pointer object-cover border border-gray-100 hover:opacity-95 transition-opacity"
            onClick={onOpen}
            onError={() => setFailed(true)}
        />
    )
}

export default function ChatZone() {
    const dispatch = useDispatch()
    const msgLimit = 15
    const [msgOffset, setMsgOffset] = useState(0)
    const [modalImg, setModalImg] = useState(null)
    const messagesContainerRef = useRef(null)

    const { stompClient, isConnected } = useContext(SocketContext)
    const { newMessage, replySignalMessage, setExpand, curChatroom, setCurChatroom } = useContext(ChatContext)
    const chatWithUserId = useSelector((state) => state.chat.userId)
    const [imageUrls, setImageUrls] = useState([])
    const [textContent, setTextContent] = useState("")
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(false)
    const [hasMoreMsg, setHasMoreMsg] = useState(true)
    const currentUserId = getJwtUsername()
    const currentUsername = JSON.parse(localStorage.getItem("userData") || "{}")["username"]
    const receiverName = curChatroom?.receiver?.displayName
        || curChatroom?.receiver?.shopName
        || curChatroom?.receiver?.fullName
        || curChatroom?.receiver?.username
        || "Chat"

    const getChatroom = (userId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/chat/get_chatroom?userId=${userId}`, window.location.pathname, true)
            .then(res => res.json())
            .then(res => { if (!res.message) setCurChatroom(res) })
    }

    const getMessages = (chatroomId) => {
        setLoading(true)
        fetchWithAuth(`${BASE_API_URL}/v1/chat/get_messages?chatroomId=${chatroomId}&offset=${msgOffset}&limit=${msgLimit}`)
            .then(res => res.json())
            .then(res => {
                if (res.message) toast.error(res.message)
                else {
                    setMessages(prev => [...(prev || []), ...res.content])
                    if (res.nextOffset - msgOffset < msgLimit) setHasMoreMsg(false)
                    setMsgOffset(res.nextOffset)
                }
            })
            .finally(() => setLoading(false))
    }

    const handleScroll = (e) => {
        const top = Math.abs(e.target.scrollTop - e.target.clientHeight) >= e.target.scrollHeight - 50;
        if (top && !loading && hasMoreMsg) getMessages(curChatroom.id);
    };

    const handleUploadImg = async (images) => {
        try {
            const urls = await uploadImages(images);
            setImageUrls(prev => [...prev, ...urls]);
        } catch (error) {
            toast.error(error.message || "Khong the tai anh len");
        }
    }

    useEffect(() => {
        if (!curChatroom) return
        getMessages(curChatroom.id)
    }, [curChatroom])

    useEffect(() => {
        if (!newMessage) return
        if (curChatroom === null || newMessage.chatroomId !== curChatroom.id) return
        setMessages(prev => [newMessage, ...(prev || [])])
    }, [newMessage])

    useEffect(() => {
        if (!replySignalMessage) return
        console.log("[WS] replySignalMessage received:", replySignalMessage);
        setMessages(prev => prev.map(msg => {
            if (!msg.status || msg.status !== "sending") return msg
            if (replySignalMessage.tempId && msg.tempId !== replySignalMessage.tempId) return msg
            return {
                ...msg,
                id: replySignalMessage.id || msg.id,
                status: replySignalMessage.status === "failed" ? "failed" : "sent",
            }
        }))
    }, [replySignalMessage])

    useEffect(() => {
        if (chatWithUserId !== null) {
            setExpand(true)
            setTextContent("")
            setImageUrls([])
            setHasMoreMsg(true)
            setMsgOffset(0)
            setMessages([])
            getChatroom(chatWithUserId)
        }
    }, [chatWithUserId]);

    useEffect(() => {
        return () => dispatch(setUserId(null))
    }, [])

    const sendMessage = () => {
        if (!stompClient || !isConnected) {
            toast.error("Kết nối chat đang mất. Vui lòng chờ kết nối lại.");
            return;
        }
        if (!curChatroom) return;
        let msgs = []
        const senderUsername = getJwtUsername()
        if (imageUrls.length > 0) {
            msgs = imageUrls.map(url => ({ content: url, chatroomId: curChatroom.id, type: "MEDIA" }))
        }
        if (textContent.trim()) {
            msgs.push({ content: textContent, chatroomId: curChatroom.id, type: "TEXT" })
        }
        msgs = msgs.map((msg, index) => ({
            ...msg,
            tempId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
            senderUsername,
        }))
        const displayMsgs = msgs.map(msg => ({
            ...msg, status: "sending", senderUsername: currentUserId, createdAt: new Date()
        }))
        setMessages(prev => [...displayMsgs, ...(prev || [])])
        msgs.forEach(msg => {
            console.log("[WS] Sending message:", msg);
            stompClient.publish({
                destination: "/app/send_message",
                body: JSON.stringify(msg)
            })
        })
        setTextContent("")
        setImageUrls([])
    }

    // ── Empty state: no chatroom selected
    if (!curChatroom) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-50 text-gray-400">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-blue-100">
                    <FiMessageCircle size={34} className="text-blue-400" />
                </div>
                <div className="text-center">
                    <p className="text-base font-semibold text-gray-700">Chọn cuộc trò chuyện</p>
                    <p className="mt-1 text-sm text-gray-400">để bắt đầu nhắn tin</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* ── Chat header (receiver info) */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 shrink-0">
                <div className="flex items-center gap-2.5">
                    <ChatAvatar src={curChatroom.receiver?.thumbnailUrl} name={receiverName} />
                    <div>
                        <p className="text-sm font-semibold leading-none text-gray-800">{receiverName}</p>
                        <p className="text-xs text-green-500 mt-0.5">Online</p>
                    </div>
                </div>
                {curChatroom.receiver?.hasShop && (
                    <a
                        href={`/shop/${curChatroom.receiver?.shopUsername || curChatroom.receiver?.username || ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                        <FiExternalLink size={13} />
                        <span className="hidden sm:inline">Xem shop</span>
                    </a>
                )}
            </div>

            {/* ── Messages area */}
            <div
                className="flex-1 overflow-y-auto flex flex-col-reverse gap-2 bg-slate-50/70 px-4 py-4"
                onScroll={handleScroll}
                style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#e5e7eb transparent"
                }}
            >
                {loading && (
                    <div className="flex justify-center py-2">
                        <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                )}

                {messages.length > 0 && messages.map((msg, index) => {
                    const sender = msg.senderUsername || msg.senderId || msg.sender_id
                    const isMine = sender === currentUserId || sender === currentUsername
                    const prevMsg = messages[index + 1]
                    const messageDate = new Date(msg.createdAt || Date.now())
                    const prevMessageDate = prevMsg ? new Date(prevMsg.createdAt || Date.now()) : null
                    const isNewDay = !prevMsg ||
                        messageDate.toDateString() !== prevMessageDate.toDateString()

                    return (
                        <div key={msg.id || index}>
                            {isNewDay && (
                                <div className="flex items-center gap-2 my-3">
                                    <div className="flex-1 h-px bg-gray-100" />
                                    <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                                        {messageDate.toLocaleDateString("vi-VN")}
                                    </span>
                                    <div className="flex-1 h-px bg-gray-100" />
                                </div>
                            )}
                            <div className={`flex items-end gap-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                                {/* Avatar for others */}
                                {!isMine && (
                                    <ChatAvatar
                                        src={curChatroom.receiver?.thumbnailUrl}
                                        name={receiverName}
                                        size="h-6 w-6"
                                        textSize="text-[8px]"
                                        className="shrink-0 mb-1"
                                    />
                                )}

                                {/* Bubble */}
                                <div className={`
                                    max-w-[75%] relative group
                                    ${isMine ? "items-end" : "items-start"}
                                `}>
                                    {msg.type === "TEXT" ? (
                                        <div className={`
                                            px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words shadow-sm
                                            ${isMine
                                                ? "bg-blue-600 text-white rounded-br-md"
                                                : "bg-white text-gray-800 rounded-bl-md ring-1 ring-gray-100"
                                            }
                                        `}>
                                            {msg.content}
                                        </div>
                                    ) : msg.type === "MEDIA" ? (
                                        <MessageImage src={msg.content} onOpen={() => setModalImg(msg.content)} />
                                    ) : null}

                                    {/* Status for own messages */}
                                    {isMine && msg.status && (
                                        <p className="text-right text-[10px] text-gray-400 mt-0.5 pr-0.5">
                                            {msg.status === "sending" ? "Đang gửi..." : msg.status === "failed" ? "Gửi thất bại" : "Đã gửi"}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Image previews */}
            {imageUrls.length > 0 && (
                <div className="flex gap-2 px-3 py-2 border-t border-gray-100 overflow-x-auto">
                    {imageUrls.map((url, i) => (
                        <div key={url} className="relative shrink-0">
                            <img src={url} alt="" className="w-14 h-14 object-cover rounded-xl border border-gray-200" />
                            <button
                                onClick={() => setImageUrls(prev => prev.filter(u => u !== url))}
                                className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-gray-700 text-white text-[9px] rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-900"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Input bar */}
            <div className="flex items-end gap-2 border-t border-gray-100 bg-white px-3 py-3 shrink-0">
                {/* Image upload */}
                <label className="shrink-0 p-2 text-gray-400 hover:text-blue-500 cursor-pointer hover:bg-blue-50 rounded-full transition-colors">
                    <FaImage size={16} />
                    <input
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        id="uploadImage"
                        onChange={e => handleUploadImg(e.target.files)}
                    />
                </label>

                {/* Text input */}
                <div className="flex min-h-[38px] flex-1 items-center rounded-2xl bg-slate-100 px-3.5 py-2 ring-1 ring-transparent focus-within:bg-white focus-within:ring-blue-200">
                    <textarea
                        value={textContent}
                        placeholder="Nhập tin nhắn..."
                        className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none leading-5 max-h-20"
                        rows={1}
                        onChange={e => {
                            setTextContent(e.target.value)
                            e.target.style.height = "auto"
                            e.target.style.height = e.target.scrollHeight + "px"
                        }}
                        onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                if (textContent.trim() || imageUrls.length > 0) sendMessage()
                            }
                        }}
                    />
                </div>

                {/* Send button */}
                <button
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        textContent.trim() || imageUrls.length > 0
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            : "bg-gray-100 text-gray-300 cursor-not-allowed"
                    }`}
                    onClick={() => { if (textContent.trim() || imageUrls.length > 0) sendMessage() }}
                >
                    <IoMdSend size={15} />
                </button>
            </div>

            {/* ── Image modal */}
            {modalImg && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300]"
                    onClick={() => setModalImg(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 p-2.5 rounded-full cursor-pointer"
                        onClick={() => setModalImg(null)}
                    >
                        <FaTimes size={18} />
                    </button>
                    <img
                        src={modalImg}
                        alt="enlarged"
                        className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    )
}
