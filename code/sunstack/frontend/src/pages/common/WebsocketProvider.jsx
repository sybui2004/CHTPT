import { Client } from "@stomp/stompjs";
import { createContext, useEffect, useRef, useState } from "react";
import { BASE_BE_URL } from "../../constants";

const SocketContext = createContext()

function parseStompJsonBody(body) {
    const normalized = body.replace(/\0/g, "").trim()
    try {
        return JSON.parse(normalized)
    } catch (error) {
        const end = findFirstJsonObjectEnd(normalized)
        if (end === -1) throw error
        return JSON.parse(normalized.slice(0, end))
    }
}

function findFirstJsonObjectEnd(value) {
    let depth = 0
    let inString = false
    let escaped = false
    let started = false

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index]
        if (!started) {
            if (char === "{") {
                started = true
                depth = 1
            }
            continue
        }
        if (escaped) {
            escaped = false
            continue
        }
        if (char === "\\") {
            escaped = true
            continue
        }
        if (char === "\"") {
            inString = !inString
            continue
        }
        if (inString) continue
        if (char === "{") depth += 1
        if (char === "}") depth -= 1
        if (depth === 0) return index + 1
    }
    return -1
}

export function WebsocketProvider({ children }){

    const [stompClient, setStomptClient] = useState(null)
    const [isConnected, setIsConnected] = useState(false)
    const subscriptionsRef = useRef(new Map())
    
    useEffect(() => {
        const accessToken = localStorage.getItem("access_token")
        if (!accessToken) return

        const wsBaseUrl = BASE_BE_URL.replace(/^http/, "ws")
        const client = new Client({
            brokerURL: `${wsBaseUrl}/ws`,
            connectHeaders: {
                Authorization: `Bearer ${accessToken}`
            },
            reconnectDelay: 5000,
            heartbeatIncoming: 0,
            heartbeatOutgoing: 0,
            debug: () => {},
            onConnect: () => {
                subscriptionsRef.current.clear()
                setIsConnected(true)
                console.log("[WS] Connected successfully")
            },
            onDisconnect: () => {
                setIsConnected(false)
                subscriptionsRef.current.clear()
                console.log("[WS] Disconnected")
            },
            onWebSocketClose: () => {
                setIsConnected(false)
                subscriptionsRef.current.clear()
                console.log("[WS] WebSocket closed")
            },
            onStompError: (frame) => {
                console.log("[WS] STOMP error:", frame.headers?.message || frame.body)
            },
        })

        client.activate()
        setStomptClient(client)

        return () => {
            setIsConnected(false)
            subscriptionsRef.current.clear()
            client.deactivate()
        }
    }, [])

    const subscribeToChanel = (chanel, func) => {
        if(stompClient === null || !isConnected) {
            return
        }
        if (subscriptionsRef.current.has(chanel)) return
        const subscriptionId = chanel.split("/").filter(Boolean).pop() || chanel
        const subscription = stompClient.subscribe(chanel, (mes) => {
            func(parseStompJsonBody(mes.body))
        }, { id: subscriptionId })
        subscriptionsRef.current.set(chanel, subscription)
    }

    return (
        <SocketContext.Provider value={{isConnected, stompClient, subscribeToChanel}}>
            {children}
        </SocketContext.Provider>
    )

}

export default SocketContext;
