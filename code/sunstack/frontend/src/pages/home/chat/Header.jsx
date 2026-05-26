import { BsArrowDownSquare } from "react-icons/bs";
import { FiArrowLeft } from "react-icons/fi";
import { useContext } from "react";
import ChatContext from "./ChatProvider";
import { IoMdChatbubbles } from "react-icons/io";

export default function Header(){

    const chatCtx = useContext(ChatContext)
    const isMobileShowingChat = chatCtx.curChatroom !== null;
    const receiverName = chatCtx.curChatroom?.receiver?.displayName
        || chatCtx.curChatroom?.receiver?.shopName
        || chatCtx.curChatroom?.receiver?.fullName
        || chatCtx.curChatroom?.receiver?.username
        || "Chat";
    
    return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
                {/* Back button on mobile (shown only when chatroom is open) */}
                {isMobileShowingChat && (
                    <button
                        className="sm:hidden p-1 -ml-1 text-gray-500 hover:text-gray-800 cursor-pointer"
                        onClick={() => chatCtx.setCurChatroom(null)}
                    >
                        <FiArrowLeft size={20} />
                    </button>
                )}
                <IoMdChatbubbles size={18} className="text-blue-500" />
                <p className="font-semibold text-base text-gray-800">
                    {isMobileShowingChat && chatCtx.curChatroom
                        ? <span className="sm:hidden">{receiverName}</span>
                        : null
                    }
                    <span className={isMobileShowingChat ? "hidden sm:inline" : ""}>Chat</span>
                </p>
                {chatCtx.unreadRooms.length > 0 && (
                    <span className="text-blue-500 text-sm font-medium">
                        ({chatCtx.unreadRooms.length})
                    </span>
                )}
            </div>
            <button
                className="p-1.5 cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Ẩn cửa sổ chat"
                onClick={() => chatCtx.setExpand(false)}
            >
                <BsArrowDownSquare size={16} />
            </button>
        </div>
    )
}
