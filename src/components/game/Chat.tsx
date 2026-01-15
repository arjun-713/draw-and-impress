import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/useRoom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    room_id: string;
    player_id: string;
    content: string;
    created_at: string;
    username?: string; // Enriched on fetch
    avatar_color?: string; // Enriched on fetch
}

export const Chat = () => {
    const { room, players } = useRoom();
    const { userId } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Load initial messages
    useEffect(() => {
        if (!room?.id) return;

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("room_id", room.id)
                .order("created_at", { ascending: true })
                .limit(50);

            if (!error && data) {
                setMessages(data as Message[]);
            }
        };

        fetchMessages();

        // Subscribe to new messages
        const channel = supabase
            .channel(`chat-${room.id}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages((prev) => [...prev, newMsg]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [room?.id]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !room?.id || !userId) return;

        const currentPlayer = players.find(p => p.user_id === userId);
        if (!currentPlayer) return;

        const msgContent = newMessage.trim();
        setNewMessage("");

        // Optimistic update? No, let realtime handle it for consistency
        // But we can fallback to broadcast if table insert fails (optional, but keep simple)

        // Check if table exists (in case migration didn't run)
        // We'll just try insert
        const { error } = await supabase
            .from("messages")
            .insert({
                room_id: room.id,
                player_id: currentPlayer.id,
                content: msgContent
            });

        if (error) {
            console.error("Chat send error:", error);
        }
    };

    const getPlayerInfo = (playerId: string) => {
        const p = players.find(p => p.id === playerId);
        return {
            username: p?.username || "Unknown",
            color: p?.avatar_color || "#999"
        };
    };

    return (
        <>
            {/* Mobile Toggle */}
            <Button
                variant="outline"
                size="icon"
                className="fixed bottom-4 right-4 z-50 md:hidden rounded-full shadow-lg h-12 w-12"
                onClick={() => setIsOpen(!isOpen)}
            >
                <MessageSquare />
            </Button>

            <div className={cn(
                "fixed bottom-4 right-4 z-40 w-80 bg-background/95 backdrop-blur border-2 border-border rounded-xl flex flex-col shadow-xl transition-all duration-300",
                "h-[400px]",
                isOpen ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0 md:translate-y-0 md:opacity-100 md:relative md:w-full md:h-[600px] md:bottom-0 md:right-0 md:shadow-none md:border-t-0 md:border-x-0 md:border-b-0 md:rounded-none"
            )}>
                <div className="p-3 border-b bg-muted/50 font-display font-medium flex justify-between items-center">
                    <span>Chat</span>
                    <Button variant="ghost" size="sm" className="h-6 md:hidden" onClick={() => setIsOpen(false)}>✕</Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                    {messages.map((msg) => {
                        const { username, color } = getPlayerInfo(msg.player_id);
                        const isMe = msg.player_id === players.find(p => p.user_id === userId)?.id;

                        return (
                            <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <span className="text-xs text-muted-foreground mb-1 ml-1">{username}</span>
                                <div
                                    className={cn(
                                        "px-3 py-2 rounded-lg max-w-[85%] break-words text-sm",
                                        isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"
                                    )}
                                    style={!isMe ? { borderLeft: `3px solid ${color}` } : {}}
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
                            className="h-9"
                            maxLength={200}
                        />
                        <Button type="submit" size="icon" className="h-9 w-9 shrink-0">
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </>
    );
};
