import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../lib/theme';
import GradientBackground from '../components/GradientBackground';

export default function TermsScreen() {
  const [accepted, setAccepted] = useState(false);

  return (
    <GradientBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
          <Text style={styles.headerSub}>Please read carefully before continuing</Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>1. Platform Purpose</Text>
          <Text style={styles.body}>
            StudyBridge is an educational technology platform that provides students with access to scholarship
            information, resources, and tools to support their higher education journey. We are not a scholarship
            provider, financial aid office, or accredited educational institution. StudyBridge may partner with
            colleges, universities, and other educational institutions to surface opportunities for students.
            However, any such partnership does not guarantee admission, enrollment, or the awarding of any
            scholarship or financial aid to any user. All admission and scholarship decisions remain solely
            at the discretion of the respective institution.
          </Text>

          <Text style={styles.sectionTitle}>2. No Guarantee of Awards</Text>
          <Text style={styles.body}>
            StudyBridge does NOT guarantee that any user will receive, win, or be awarded any scholarship listed
            or referenced on this platform. Access to scholarship information does not constitute eligibility,
            selection, or award. All scholarship decisions are made solely by the respective awarding organizations.
          </Text>

          <Text style={styles.sectionTitle}>3. Accuracy of Information</Text>
          <Text style={styles.body}>
            While we strive to maintain accurate and current scholarship information, StudyBridge makes no
            warranties regarding the completeness, accuracy, or timeliness of any listings. Users are responsible
            for independently verifying all scholarship details, deadlines, and requirements directly with the
            awarding organization.
          </Text>

          <Text style={styles.sectionTitle}>4. User Responsibilities</Text>
          <Text style={styles.body}>
            Users agree to provide accurate personal information during registration and application processes.
            Users are solely responsible for the content of any applications submitted to scholarship organizations.
            Misrepresentation of qualifications or credentials is strictly prohibited and may result in immediate
            account termination.
          </Text>

          <Text style={styles.sectionTitle}>5. International Students</Text>
          <Text style={styles.body}>
            StudyBridge provides information relevant to international students pursuing U.S. higher education.
            Users are responsible for understanding and complying with all visa, immigration, and enrollment
            requirements applicable to their individual circumstances. StudyBridge is not an immigration advisor
            and does not provide legal or immigration counsel.
          </Text>

          <Text style={styles.sectionTitle}>6. Privacy & Data</Text>
          <Text style={styles.body}>
            By using StudyBridge, you consent to the collection and use of your information as described in our
            Privacy Policy. We do not sell your personal data to third parties. Your information is used solely
            to improve your experience on the platform and deliver relevant scholarship matches.
          </Text>

          <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
          <Text style={styles.body}>
            StudyBridge and its affiliates shall not be liable for any direct, indirect, incidental, or
            consequential damages arising from your use of the platform, including but not limited to missed
            scholarship deadlines, rejected applications, or reliance on inaccurate information.
          </Text>

          <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
          <Text style={styles.body}>
            StudyBridge reserves the right to modify these Terms & Conditions at any time. Continued use of
            the platform following any changes constitutes acceptance of the revised terms. Users will be
            notified of material changes via the app.
          </Text>

          <Text style={styles.sectionTitle}>9. Governing Law</Text>
          <Text style={styles.body}>
            These Terms are governed by the laws of the State of Georgia, United States. Any disputes arising
            from use of this platform shall be subject to the exclusive jurisdiction of the courts of Georgia.
          </Text>

          <View style={styles.spacer} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setAccepted(!accepted)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
              {accepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>
              I have read and agree to the Terms & Conditions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !accepted && styles.buttonDisabled]}
            onPress={() => accepted && router.replace('/auth')}
            activeOpacity={accepted ? 0.8 : 1}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  headerSub: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  spacer: {
    height: 32,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.textSecondary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  checkmark: {
    color: theme.accentText,
    fontWeight: '800',
    fontSize: 14,
  },
  checkLabel: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: theme.accentText,
    fontSize: 16,
    fontWeight: '700',
  },
});
