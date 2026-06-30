import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import GradientBackground from '../components/GradientBackground';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const STARTER_PROMPTS = [
  'What documents do I need for F-1 visa?',
  'Find scholarships for my field of study',
  "What's the difference between on and off campus housing?",
];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMessage: ChatMessage = { id: generateId(), role: 'user', content: trimmed };
      const history = [...messages, userMessage];

      setMessages(history);
      setInput('');
      setError(null);
      setSending(true);

      const { data, error: invokeError } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: history.map(({ role, content }) => ({ role, content })) },
      });

      setSending(false);

      if (invokeError) {
        setError(invokeError.message);
        return;
      }

      const result = data as { reply?: string; error?: string } | null;

      if (result?.error) {
        setError(result.error);
        return;
      }

      setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: result?.reply ?? '' }]);
    },
    [messages, sending]
  );

  const handleSend = () => sendMessage(input);

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <View style={styles.headerSpacer} />
        </View>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>Ask me anything</Text>
                <Text style={styles.emptyBody}>
                  I can help with visas, scholarships, school selection, and campus life.
                </Text>

                {STARTER_PROMPTS.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.promptChip}
                    onPress={() => sendMessage(prompt)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.promptChipText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.bubbleRow,
                    message.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                  ]}
                >
                  <View style={[styles.bubble, message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={[styles.bubbleText, message.role === 'user' && styles.bubbleTextUser]}>
                      {message.content}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {sending && (
              <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                  <ActivityIndicator color={theme.textSecondary} size="small" />
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.8}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    minWidth: 60,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  headerSpacer: {
    minWidth: 60,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  promptChip: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    width: '100%',
  },
  promptChipText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleUser: {
    backgroundColor: theme.accent,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: theme.textPrimary,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: theme.accentText,
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  errorText: {
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.textPrimary,
    maxHeight: 120,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 18,
    color: theme.accentText,
    fontWeight: '700',
  },
});
