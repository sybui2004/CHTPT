import NavBar from "./NavBar";
import Header from "./Header";
import Footer from "./Footer";
import { Outlet, useLocation } from "react-router-dom";
import React from "react";
import MiniChat from "./chat/MiniChat";
import { ChatProvider } from "./chat/ChatProvider";
import { WebsocketProvider } from "../common/WebsocketProvider";

export default function MainLayout({ isAuthenticated }) {
    const location = useLocation();
    const isCartPage = location.pathname === '/cart';

    const content = (
        <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-gray-100">
            <div className="sticky top-0 z-50 w-full max-w-full">
                <NavBar isAuthenticated={isAuthenticated} />
                <Header isAuthenticated={isAuthenticated} />
            </div>
            <Outlet />
            <Footer />
            {isAuthenticated && (
                <ChatProvider>
                    <div className={isCartPage ? "hidden md:block" : ""}>
                        <MiniChat />
                    </div>
                </ChatProvider>
            )}
        </div>
    )

    return isAuthenticated ? (
        <WebsocketProvider>{content}</WebsocketProvider>
    ) : content
}
