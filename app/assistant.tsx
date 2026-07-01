import { useCallback, useEffect, useRef, useState } from 'react';
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

type UserProfile = {
  field_of_study: string | null;
  gpa_range: string | null;
  country_of_origin: string | null;
  degree_level: string | null;
  target_state: string | null;
};

const STARTER_PROMPTS = [
  'What schools are the best fit for my profile?',
  'Help me find scholarships I qualify for',
  'What documents do I need as an international student?',
  'Walk me through the application timeline',
  'What should I know about student visas?',
];

const RHETOR_SYSTEM_PROMPT =
  "You are Rhetor, an AI guide and friend built into this platform to help international and domestic students navigate their journey to U.S. higher education. You're warm, encouraging, and specific — never generic. You know the student's profile and use it to give personalized advice. You help with: school selection, scholarship hunting, visa questions, campus life, application strategy, financial planning, and anything else a student needs. Talk like a knowledgeable older friend, not a corporate chatbot. Never say \"I'm just an AI\" — you are Rhetor, their guide. Always end responses with an encouraging nudge or follow-up question to keep them moving forward.";

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildProfileContext(profile: UserProfile | null): string {
  if (!profile) return '';
  const parts: string[] = [];
  if (profile.field_of_study) parts.push(`major=${profile.field_of_study}`);
  if (profile.gpa_range) parts.push(`GPA=${profile.gpa_range}`);
  if (profile.country_of_origin) parts.push(`country=${profile.country_of_origin}`);
  if (profile.degree_level) parts.push(`degree=${profile.degree_level}`);
  if (profile.target_state) parts.push(`target state=${profile.target_state}`);
  if (parts.length === 0) return '';
  return `[Student profile: ${parts.join(', ')}]`;
}

export default function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Fetch user profile on mount for context injection
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: userData }) => {
      const user = userData.user;
      if (!user || cancelled) return;

      const { data } = await supabase
        .from('profiles')
        .select('field_of_study, gpa_range, country_of_origin, degree_level, target_state')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled && data) {
        setUserProfile(data as UserProfile);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

      // Build API messages — inject profile context silently as a system-style prefix
      const profileContext = buildProfileContext(userProfile);
      const apiMessages = history.map(({ role, content }) => ({ role, content }));

      // Prepend the profile context to the first user message in the API payload (not shown in UI)
      let apiPayload: { role: string; content: string }[] = [];
      if (profileContext) {
        apiPayload = [
          { role: 'user', content: profileContext },
          { role: 'assistant', content: "Got it! I have your profile details and I'll use them to personalize my advice." },
          ...apiMessages,
        ];
      } else {
        apiPayload = apiMessages;
      }

      const { data, error: invokeError } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: apiPayload,
          systemPrompt: RHETOR_SYSTEM_PROMPT,
        },
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

      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'assistant', content: result?.reply ?? '' },
      ]);
    },
    [messages, sending, userProfile]
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

          <View style={styles.headerCenter}>
            <View style={styles.rhetorAvatar}>
              <Text style={styles.rhetorAvatarText}>R</Text>
            </View>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>Rhetor</Text>
              <Text style={styles.headerSubtitle}>Your personal college guide</Text>
            </View>
          </View>

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
                <View style={styles.emptyAvatarLarge}>
                  <Text style={styles.emptyAvatarText}>R</Text>
                </View>
                <Text style={styles.emptyTitle}>Hi, I'm Rhetor</Text>
                <Text style={styles.emptyBody}>
                  Your personal guide to U.S. higher education. Ask me anything — I'm here to help you every step of
                  the way.
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
                  {message.role === 'assistant' && (
                    <View style={styles.assistantAvatarSmall}>
                      <Text style={styles.assistantAvatarSmallText}>R</Text>
                    </View>
                  )}
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
                <View style={styles.assistantAvatarSmall}>
                  <Text style={styles.assistantAvatarSmallText}>R</Text>
                </View>
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
            placeholder="Ask Rhetor anything..."
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rhetorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rhetorAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A2463',
  },
  headerTitleGroup: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    lineHeight: 22,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
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
    paddingTop: 32,
  },
  emptyAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyAvatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0A2463',
  },
  emptyTitle: {
    fontSize: 22,
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
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  assistantAvatarSmallText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A2463',
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
