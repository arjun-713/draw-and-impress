import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/hooks/useRoom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface ChatMessage {
    id: string;
    room_id: string;
    player_id: string;
    content: string;
    created_at: string;
}

// Global mock chat state
let MOCK_MESSAGES: Record<string, ChatMessage[]> = {};

export const Chat = () => {
    const { room, players } = useRoom();
    const { userId } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!room?.id) return;

        // Initial load
        setMessages(MOCK_MESSAGES[room.id] || []);

        // Polling loop
        const interval = setInterval(() => {
            if (MOCK_MESSAGES[room.id]) {
                setMessages([...MOCK_MESSAGES[room.id]]);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [room?.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        const content = newMessage.trim();
        if (!content || !room?.id || !userId) return;

        const player = players.find(p => p.user_id === userId);
        if (!player) return;

        setNewMessage("");

        const newMsg: ChatMessage = {
            id: Math.random().toString(),
            room_id: room.id,
            player_id: player.id,
            content: content,
            created_at: new Date().toISOString()
        };

        if (!MOCK_MESSAGES[room.id]) MOCK_MESSAGES[room.id] = [];
        MOCK_MESSAGES[room.id].push(newMsg);
        setMessages([...MOCK_MESSAGES[room.id]]);
    };

    const getMessageInfo = (playerId: string) => {
        const player = players.find(p => p.id === playerId);
        return {
            username: player?.username || "Unknown",
            color: player?.avatar_color || "#9ca3af",
            isMe: player?.user_id === userId
        };
    };

    return (
        <>
            <Button
                variant="outline"
                size="icon"
                className="fixed bottom-4 right-4 z-50 md:hidden rounded-full shadow-lg h-12 w-12 bg-background border-2 border-primary"
                onClick={() => setIsOpen(!isOpen)}
            >
                <MessageSquare className="w-6 h-6" />
            </Button>

            <div className={cn(
                "fixed bottom-4 right-4 z-40 w-80 bg-background/95 backdrop-blur border-2 border-border rounded-xl flex flex-col shadow-xl transition-all duration-300",
                "h-[400px]",
                isOpen ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0 md:translate-y-0 md:opacity-100 md:relative md:w-full md:h-[600px] md:bottom-0 md:right-0 md:shadow-none md:border-t-0 md:border-x-0 md:border-b-0 md:rounded-none"
            )}>
                <div className="p-3 border-b bg-muted/50 font-display font-medium flex justify-between items-center">
                    <span>Room Chat (Demo)</span>
                    <Button variant="ghost" size="sm" className="h-6 md:hidden" onClick={() => setIsOpen(false)}>✕</Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                    {messages.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm italic mt-10">
                            No messages yet. Say hi!
                        </div>
                    )}
                    {messages.map((msg) => {
                        const { username, color, isMe } = getMessageInfo(msg.player_id);
                        return (
                            <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className="flex items-center gap-1 mb-1">
                                    <span style={{ color }} className="text-xs font-bold">{username}</span>
                                </div>
                                <div
                                    className={cn(
                                        "px-3 py-2 rounded-lg max-w-[90%] break-words text-sm shadow-sm",
                                        isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none"
                                    )}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-3 border-t bg-background">
                    <form onSubmit={handleSend} className="flex gap-2">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="h-10"
                            maxLength={140}
                        />
                        <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!newMessage.trim()}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </>
    );
};
