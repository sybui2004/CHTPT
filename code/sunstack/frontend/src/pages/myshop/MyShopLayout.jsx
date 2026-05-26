import { Navigate, Outlet } from "react-router-dom"
import { useState } from 'react'
import Navbar from "./Navbar"
import Sidebar from "./Sidebar"
import MiniChat from "../home/chat/MiniChat"
import { ChatProvider } from "../home/chat/ChatProvider"
import { WebsocketProvider } from "../common/WebsocketProvider"
import { getLoginUrl } from "../../util/AuthUtil"

export default function MyShopLayout({isAuthenticated}){
    if(!isAuthenticated) return <Navigate to={getLoginUrl()}/>

    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768)

    const toggleSidebar = () => {
        setSidebarOpen(prev => !prev)
    }

    return (
        <WebsocketProvider>
        <ChatProvider>
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gray-100">
            <Navbar toggleSidebar={toggleSidebar}/>
            <div className="flex min-w-0">
                <Sidebar isOpen={sidebarOpen} toggle={toggleSidebar}/>
                <div className={`mb-16 mt-12 min-h-screen min-w-0 flex-1 overflow-x-hidden p-3 transition-all duration-300 sm:p-4 md:p-6 ${sidebarOpen ? 'md:ml-58' : 'md:ml-20'}`}>
                    <Outlet/>
                </div>
            </div>
            <div className="fixed bottom-28 right-5 z-[200] flex flex-col items-end gap-3">
                <MiniChat />
            </div>
        </div>
        </ChatProvider>
        </WebsocketProvider>
    )
}
