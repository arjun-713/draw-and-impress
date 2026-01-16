import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/useRoom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Define local type to avoid conflicts with generated types
interface ChatMessage {
    id: string;
    room_id: string;
    player_id: string;
    content: string;
    created_at: string;
}

export const Chat = () => {
    const { room, players } = useRoom();
    const { userId } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Fetch initial messages and subscribe
    useEffect(() => {
        if (!room?.id) return;

        // Fetch existing messages
        const fetchMessages = async () => {
            // @ts-ignore
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("room_id", room.id)
                .order("created_at", { ascending: true })
                .limit(50);

            if (!error && data) {
                setMessages(data as unknown as ChatMessage[]);
            }
        };

        fetchMessages();

        // Subscribe to real-time additions
        const channel = supabase
            .channel(`chat-${room.id}`)
            .on(
                "postgres_changes",
                // @ts-ignore
                { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` },
                (payload) => {
                    const newMsg = payload.new as unknown as ChatMessage;
                    setMessages((prev) => {
                        // Avoid duplicates
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [room?.id]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const content = newMessage.trim();
        if (!content || !room?.id || !userId) return;

        // Find current player ID for this room
        const player = players.find(p => p.user_id === userId);
        if (!player) {
            console.error("Cannot send message: Player not found in room.");
            return;
        }

        setNewMessage(""); // Clear input immediately

        // @ts-ignore
        const { error } = await supabase
            .from("messages")
            .insert({
                room_id: room.id,
                player_id: player.id,
                content: content
            });

        if (error) {
            console.error("Failed to send message:", error);
        }
    };

    // Helper to get display info for a message
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
            {/* Toggle Button (Mobile) */}
            <Button
                variant="outline"
                size="icon"
                className="fixed bottom-4 right-4 z-50 md:hidden rounded-full shadow-lg h-12 w-12 bg-background border-2 border-primary"
                onClick={() => setIsOpen(!isOpen)}
            >
                <MessageSquare className="w-6 h-6" />
            </Button>

            {/* Chat Container */}
            <div className={cn(
                "fixed bottom-4 right-4 z-40 w-80 bg-background/95 backdrop-blur border-2 border-border rounded-xl flex flex-col shadow-xl transition-all duration-300",
                "h-[400px]",
                isOpen ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0 md:translate-y-0 md:opacity-100 md:relative md:w-full md:h-[600px] md:bottom-0 md:right-0 md:shadow-none md:border-t-0 md:border-x-0 md:border-b-0 md:rounded-none"
            )}>
                {/* Header */}
                <div className="p-3 border-b bg-muted/50 font-display font-medium flex justify-between items-center">
                    <span>Room Chat</span>
                    <Button variant="ghost" size="sm" className="h-6 md:hidden" onClick={() => setIsOpen(false)}>✕</Button>
                </div>

                {/* Messages Area */}
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

                {/* Input Area */}
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
