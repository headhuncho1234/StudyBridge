import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import GradientBackground from '../../components/GradientBackground';

type DocumentStatus = 'needed' | 'in-progress' | 'complete';

type AppDocument = {
  id: string;
  name: string;
  doc_type: string | null;
  status: string;
  due_date: string | null;
};

type StudentType = 'domestic' | 'international' | 'foreign-exchange' | 'transfer';

const STUDENT_TYPES: { value: StudentType; label: string }[] = [
  { value: 'domestic', label: 'Domestic' },
  { value: 'international', label: 'International' },
  { value: 'foreign-exchange', label: 'Exchange' },
  { value: 'transfer', label: 'Transfer' },
];

const REQUIRED_DOCS: Record<StudentType, string[]> = {
  domestic: [
    'High school/college transcripts',
    'SAT/ACT scores',
    'Letters of recommendation',
    'Personal statement/essay',
    'FAFSA confirmation',
    'Financial aid award letters',
    'Proof of residency',
    'Social Security Number (for aid)',
  ],
  international: [
    'Passport (valid)',
    'Academic transcripts (translated)',
    'English proficiency test (TOEFL/IELTS)',
    'Financial sponsorship letter',
    'Bank statements (showing funds)',
    'Student visa (F-1/J-1)',
    'I-20 form',
    'SEVIS fee receipt',
    'Immunization records',
    'Health insurance proof',
    'Emergency contact documentation',
  ],
  'foreign-exchange': [
    'Passport',
    'DS-2019 form (J-1 visa)',
    'SEVIS registration',
    'Exchange program acceptance letter',
    'Home institution transcript',
    'Language proficiency proof',
    'Insurance coverage',
    'Emergency contact info',
    'Housing confirmation',
  ],
  transfer: [
    'Official transcripts from all institutions',
    'Transfer application',
    'Dean\'s certification letter',
    'Course descriptions for credit evaluation',
    'Financial aid transfer documentation',
  ],
};

const CHECKLIST_STORAGE_KEY = 'doc_checklist_checked_';

const STATUS_GROUPS: { value: DocumentStatus; label: string }[] = [
  { value: 'needed', label: 'Needed' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
];

const STATUS_LABELS: Record<string, string> = {
  needed: 'Needed',
  'in-progress': 'In Progress',
  complete: 'Complete',
};

function formatDueDate(dueDate: string) {
  const date = new Date(`${dueDate}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusBadgeStyle(status: string) {
  if (status === 'complete') return styles.statusBadgeComplete;
  if (status === 'in-progress') return styles.statusBadgeInProgress;
  return styles.statusBadgeNeeded;
}

function getStatusBadgeTextStyle(status: string) {
  return status === 'complete' ? styles.statusBadgeTextComplete : styles.statusBadgeTextDefault;
}

/** Case-insensitive fuzzy check: does any uploaded doc name contain the checklist item keyword? */
function isAutoChecked(checklistItem: string, uploadedDocs: AppDocument[]): boolean {
  const needle = checklistItem.toLowerCase();
  return uploadedDocs.some((doc) => {
    const haystack = doc.name.toLowerCase();
    // Check if either string contains the other (trimmed to first 12 chars for broad matching)
    const keywords = needle.split(/[\s\/\(\)]+/).filter((w) => w.length > 3);
    return keywords.some((kw) => haystack.includes(kw));
  });
}

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStudentType, setSelectedStudentType] = useState<StudentType>('domestic');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDocType, setNewDocType] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const [statusDoc, setStatusDoc] = useState<AppDocument | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // Load checked state from AsyncStorage when student type changes
  useEffect(() => {
    const key = `${CHECKLIST_STORAGE_KEY}${selectedStudentType}`;
    AsyncStorage.getItem(key).then((raw) => {
      if (raw) {
        try {
          const arr = JSON.parse(raw) as string[];
          setCheckedItems(new Set(arr));
        } catch {
          setCheckedItems(new Set());
        }
      } else {
        setCheckedItems(new Set());
      }
    });
  }, [selectedStudentType]);

  const persistChecked = useCallback(
    async (next: Set<string>) => {
      const key = `${CHECKLIST_STORAGE_KEY}${selectedStudentType}`;
      await AsyncStorage.setItem(key, JSON.stringify(Array.from(next)));
    },
    [selectedStudentType]
  );

  const toggleChecked = useCallback(
    (item: string) => {
      setCheckedItems((prev) => {
        const next = new Set(prev);
        if (next.has(item)) {
          next.delete(item);
        } else {
          next.add(item);
        }
        persistChecked(next);
        return next;
      });
    },
    [persistChecked]
  );

  const loadDocuments = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase.auth.getUser().then(async ({ data: userData }) => {
      const user = userData.user;
      if (!user) {
        if (!cancelled) {
          setDocuments([]);
          setLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('application_documents')
        .select('id, name, doc_type, status, due_date')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setDocuments((data ?? []) as AppDocument[]);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      return loadDocuments();
    }, [loadDocuments])
  );

  const resetCreateForm = () => {
    setNewName('');
    setNewDocType('');
    setNewDueDate('');
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreateError(null);

    if (!newName.trim()) {
      setCreateError('Please enter a document name.');
      return;
    }

    let dueDateValue: string | null = null;
    if (newDueDate.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDueDate.trim())) {
        setCreateError('Due date must be in YYYY-MM-DD format.');
        return;
      }
      dueDateValue = newDueDate.trim();
    }

    setCreating(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setCreating(false);
      setCreateError('You must be signed in to add a document.');
      return;
    }

    const { error: insertError } = await supabase.from('application_documents').insert({
      user_id: user.id,
      name: newName.trim(),
      doc_type: newDocType.trim() || null,
      due_date: dueDateValue,
    });

    setCreating(false);

    if (insertError) {
      setCreateError(insertError.message);
      return;
    }

    resetCreateForm();
    setCreateVisible(false);
    loadDocuments();
  };

  const handleStatusChange = async (status: DocumentStatus) => {
    if (!statusDoc) return;
    setStatusSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setStatusSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('application_documents')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', statusDoc.id)
      .eq('user_id', user.id);

    setStatusSaving(false);

    if (!updateError) {
      setStatusDoc(null);
      loadDocuments();
    }
  };

  const handleDeleteDocument = useCallback(
    (doc: AppDocument) => {
      Alert.alert('Delete document?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { data: userData } = await supabase.auth.getUser();
            const user = userData.user;
            if (!user) return;

            const { error: delError } = await supabase
              .from('application_documents')
              .delete()
              .eq('id', doc.id)
              .eq('user_id', user.id);

            if (!delError) {
              setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            }
          },
        },
      ]);
    },
    []
  );

  const grouped = STATUS_GROUPS.map((group) => ({
    ...group,
    items: documents.filter((doc) => doc.status === group.value),
  }));

  const totalCount = documents.length;
  const completeCount = documents.filter((doc) => doc.status === 'complete').length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completeCount / totalCount) * 100);

  const checklistItems = REQUIRED_DOCS[selectedStudentType];

  return (
    <GradientBackground>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Your Checklist</Text>
              <Text style={styles.heading}>Document Tracker</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => setCreateVisible(true)} activeOpacity={0.8}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Student type selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.typeRow}
            contentContainerStyle={styles.typeRowContent}
          >
            {STUDENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.typePill, selectedStudentType === type.value && styles.typePillActive]}
                onPress={() => setSelectedStudentType(type.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.typePillText, selectedStudentType === type.value && styles.typePillTextActive]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Required documents checklist */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Required Documents</Text>
            </View>
            <View style={styles.checklistCard}>
              {checklistItems.map((item, idx) => {
                const autoChecked = isAutoChecked(item, documents);
                const manuallyChecked = checkedItems.has(item);
                const isChecked = autoChecked || manuallyChecked;

                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.checklistRow,
                      idx < checklistItems.length - 1 && styles.checklistRowBorder,
                    ]}
                    onPress={() => toggleChecked(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.checklistItemText, isChecked && styles.checklistItemTextChecked]}>
                      {item}
                    </Text>
                    {autoChecked && <View style={styles.greenDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Uploaded documents section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Documents</Text>
          </View>

          {loading && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

          {!loading && error && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚠️ Couldn't load documents</Text>
              <Text style={styles.cardBody}>{error}</Text>
            </View>
          )}

          {!loading && !error && documents.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📄</Text>
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptyBody}>
                Add transcripts, essays, and recommendation letters to track what you still need for your
                applications.
              </Text>
            </View>
          )}

          {!loading && !error && totalCount > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressCount}>
                  {completeCount} of {totalCount} complete
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
          )}

          {!loading &&
            !error &&
            grouped.map((group) =>
              group.items.length === 0 ? null : (
                <View key={group.value} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{group.label}</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{group.items.length}</Text>
                    </View>
                  </View>
                  {group.items.map((doc) => (
                    <Swipeable
                      key={doc.id}
                      renderRightActions={() => (
                        <TouchableOpacity
                          style={styles.deleteAction}
                          onPress={() => handleDeleteDocument(doc)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.deleteActionText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                      overshootRight={false}
                    >
                      <Pressable style={styles.docCard} onPress={() => setStatusDoc(doc)}>
                        <View style={styles.docTopRow}>
                          <Text style={styles.docName} numberOfLines={2}>
                            {doc.name}
                          </Text>
                          <View style={[styles.statusBadge, getStatusBadgeStyle(doc.status)]}>
                            <Text style={[styles.statusBadgeText, getStatusBadgeTextStyle(doc.status)]}>
                              {STATUS_LABELS[doc.status] ?? doc.status}
                            </Text>
                          </View>
                        </View>
                        {(doc.doc_type || doc.due_date) && (
                          <View style={styles.docMetaRow}>
                            <Text style={styles.docType} numberOfLines={1}>
                              {doc.doc_type ?? ''}
                            </Text>
                            <Text style={styles.docDueDate}>
                              {doc.due_date ? `Due ${formatDueDate(doc.due_date)}` : ''}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.swipeHint}>Swipe left to delete</Text>
                      </Pressable>
                    </Swipeable>
                  ))}
                </View>
              )
            )}
        </ScrollView>

        <Modal
          visible={createVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCreateVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Add Document</Text>

                  <View style={styles.field}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Official Transcript"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      value={newName}
                      onChangeText={setNewName}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Type (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Transcript, Essay, Recommendation"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      value={newDocType}
                      onChangeText={setNewDocType}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Due Date (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      value={newDueDate}
                      onChangeText={setNewDueDate}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                  </View>

                  {createError && (
                    <View style={styles.errorCard}>
                      <Text style={styles.errorText}>⚠️ {createError}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.button, creating && styles.buttonDisabled]}
                    onPress={handleCreate}
                    disabled={creating}
                    activeOpacity={0.8}
                  >
                    {creating ? (
                      <ActivityIndicator color={theme.accentText} />
                    ) : (
                      <Text style={styles.buttonText}>Save</Text>
                    )}
                  </TouchableOpacity>

                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => {
                      resetCreateForm();
                      setCreateVisible(false);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal visible={!!statusDoc} animationType="fade" transparent onRequestClose={() => setStatusDoc(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{statusDoc?.name}</Text>

              <TouchableOpacity
                style={styles.deleteDocButton}
                onPress={() => {
                  const doc = statusDoc;
                  setStatusDoc(null);
                  if (doc) {
                    setTimeout(() => handleDeleteDocument(doc), 300);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteDocButtonText}>🗑 Delete Document</Text>
              </TouchableOpacity>

              <Text style={[styles.label, { marginTop: 16 }]}>Update status</Text>

              {STATUS_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group.value}
                  style={[styles.statusOption, statusDoc?.status === group.value && styles.statusOptionActive]}
                  onPress={() => handleStatusChange(group.value)}
                  disabled={statusSaving}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      statusDoc?.status === group.value && styles.statusOptionTextActive,
                    ]}
                  >
                    {group.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {statusSaving && <ActivityIndicator color={theme.textSecondary} style={styles.stateIndicator} />}

              <Pressable style={styles.cancelButton} onPress={() => setStatusDoc(null)}>
                <Text style={styles.cancelButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 80,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.textPrimary,
    marginTop: 4,
  },
  addButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.accent,
    lineHeight: 30,
  },
  typeRow: {
    flexGrow: 0,
    marginBottom: 20,
  },
  typeRowContent: {
    gap: 10,
  },
  typePill: {
    backgroundColor: theme.card,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  typePillActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  typePillTextActive: {
    color: '#0A2463',
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  checklistCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
    marginBottom: 24,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  checklistRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A2463',
    lineHeight: 16,
  },
  checklistItemText: {
    flex: 1,
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 19,
  },
  checklistItemTextChecked: {
    color: theme.textSecondary,
    textDecorationLine: 'line-through',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    flexShrink: 0,
  },
  stateIndicator: {
    marginTop: 24,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    ...theme.shadow,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
    ...theme.shadow,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  progressCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    ...theme.shadow,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  progressCount: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.textPrimary,
  },
  docCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    marginBottom: 14,
    ...theme.shadow,
  },
  docTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  docName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    lineHeight: 22,
    marginRight: 12,
  },
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusBadgeNeeded: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statusBadgeInProgress: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  statusBadgeComplete: {
    backgroundColor: theme.textPrimary,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextDefault: {
    color: theme.textPrimary,
  },
  statusBadgeTextComplete: {
    color: theme.accentText,
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  docType: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: theme.textSecondary,
    textTransform: 'capitalize',
    marginRight: 12,
  },
  docDueDate: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  swipeHint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
  },
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 20,
    marginBottom: 14,
    marginLeft: 8,
  },
  deleteActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteDocButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
  },
  deleteDocButtonText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0A2463',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.textPrimary,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  button: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.accentText,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  statusOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusOptionActive: {
    backgroundColor: theme.textPrimary,
    borderColor: theme.textPrimary,
  },
  statusOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  statusOptionTextActive: {
    color: theme.accentText,
  },
});
