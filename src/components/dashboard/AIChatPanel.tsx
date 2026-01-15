import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, X, Loader2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage, InsightSuggestion } from '@/types/appraisal';
import { cn } from '@/lib/utils';

const INSIGHT_SUGGESTIONS: InsightSuggestion[] = [
  { id: '1', question: 'Who are the top 3 performing managers?', category: 'performance' },
  { id: '2', question: 'Which manager has the best team leadership score?', category: 'leadership' },
  { id: '3', question: 'What are the most common improvement areas?', category: 'feedback' },
  { id: '4', question: 'Compare Demola Idowu vs Dotun Adekunle', category: 'comparison' },
  { id: '5', question: 'Which managers need cultural fit improvement?', category: 'culture' },
  { id: '6', question: 'What should managers stop doing most?', category: 'feedback' },
  { id: '7', question: 'Who received the most reviews?', category: 'performance' },
  { id: '8', question: 'Average score by relationship type?', category: 'comparison' },
];

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  dataContext: string;
}

// Format AI response to clean up markdown artifacts
const formatResponse = (text: string): string => {
  return text
    // Remove ** bold markers and replace with clean text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove * italic markers
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove ### headers markers
    .replace(/^###\s*/gm, '')
    // Remove ## headers markers
    .replace(/^##\s*/gm, '')
    // Remove # headers markers
    .replace(/^#\s*/gm, '')
    // Clean up bullet points for consistency
    .replace(/^\s*[-•]\s*/gm, '• ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export default function AIChatPanel({ isOpen, onClose, dataContext }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [visibleSuggestions, setVisibleSuggestions] = useState<number[]>([0, 1, 2]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rotate suggestions with animation
  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleSuggestions(prev => {
        const next = prev.map(i => (i + 1) % INSIGHT_SUGGESTIONS.length);
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          dataContext,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessage.id ? { ...m, content: formatResponse(assistantContent) } : m
                ));
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 400 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 400 }}
          className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-accent/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Analytics Copilot</h3>
                <p className="text-xs text-muted-foreground">Ask anything about the data</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Animated Suggestions - Always visible when no messages */}
          {messages.length === 0 && (
            <div className="p-6 flex-1 flex flex-col items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-8"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h4 className="text-lg font-medium mb-2">What would you like to know?</h4>
                <p className="text-sm text-muted-foreground">Ask questions about manager performance, feedback trends, or comparisons</p>
              </motion.div>

              {/* Floating Animated Suggestions */}
              <div className="w-full space-y-3">
                <AnimatePresence mode="popLayout">
                  {visibleSuggestions.map((suggestionIdx, i) => {
                    const suggestion = INSIGHT_SUGGESTIONS[suggestionIdx];
                    return (
                      <motion.button
                        key={`${suggestion.id}-${suggestionIdx}`}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ 
                          opacity: 1, 
                          x: 0, 
                          scale: 1,
                          transition: { delay: i * 0.1 }
                        }}
                        exit={{ opacity: 0, x: -50, scale: 0.9 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => sendMessage(suggestion.question)}
                        className="w-full p-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50 text-left hover:border-primary/50 hover:from-primary/10 hover:to-accent/10 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-primary">
                              {suggestion.category.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm">{suggestion.question}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Indicator dots */}
              <div className="flex gap-1.5 mt-6">
                {INSIGHT_SUGGESTIONS.map((_, i) => (
                  <motion.div
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                      visibleSuggestions.includes(i) ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Messages - Only show when there are messages */}
          {messages.length > 0 && (
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('chat-bubble', msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai')}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </motion.div>
              ))}
              {loading && messages[messages.length - 1]?.role === 'user' && (
                <div className="chat-bubble chat-bubble-ai flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Analyzing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-border">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the appraisal data..."
                className="flex-1"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !input.trim()} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}