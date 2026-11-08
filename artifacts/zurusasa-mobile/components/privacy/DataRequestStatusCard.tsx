import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { PersonalDataRequestRow } from '@/lib/supabase';
import { dataRequestService } from '@/services/dataRequestService';

interface DataRequestStatusCardProps {
  request: PersonalDataRequestRow;
  onRefresh: () => void;
  onRequestVerification?: () => void;
}

export function DataRequestStatusCard({
  request,
  onRefresh,
  onRequestVerification,
}: DataRequestStatusCardProps) {
  const colors = useColors();
  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const getStatusConfig = () => {
    switch (request.status) {
      case 'pending_verification':
        return {
          title: 'Verification required',
          desc: 'A 6-digit code was sent to your email. Authorize the request to start compiling.',
          badge: 'Verification pending',
          bg: 'rgba(242, 101, 34, 0.08)',
          text: '#F26522',
          icon: 'clock' as const,
        };
      case 'processing':
        return {
          title: 'Preparing your data archive',
          desc: 'Gathering records across 20 tables and generating your secure PDF & JSON bundle. Usually takes 30–60s.',
          badge: 'Compiling archive',
          bg: 'rgba(59, 130, 246, 0.08)',
          text: '#3B82F6',
          icon: 'loader' as const,
        };
      case 'completed':
        return {
          title: 'Your archive is ready',
          desc: 'Your personal data export has been compiled and is ready for secure download.',
          badge: 'Ready for download',
          bg: 'rgba(16, 185, 129, 0.08)',
          text: '#10B981',
          icon: 'check-circle' as const,
        };
      case 'failed':
        return {
          title: 'Export could not be generated',
          desc: request.error_message || 'An error occurred during export processing. Please try again.',
          badge: 'Failed',
          bg: 'rgba(239, 68, 68, 0.08)',
          text: '#EF4444',
          icon: 'alert-circle' as const,
        };
      case 'expired':
        return {
          title: 'Archive has expired',
          desc: 'In compliance with our 7-day retention policy, the previous files have been deleted.',
          badge: 'Expired',
          bg: 'rgba(156, 163, 175, 0.08)',
          text: '#9CA3AF',
          icon: 'archive' as const,
        };
      case 'cancelled':
        return {
          title: 'Request cancelled',
          desc: 'This export request was cancelled by you.',
          badge: 'Cancelled',
          bg: 'rgba(156, 163, 175, 0.08)',
          text: '#9CA3AF',
          icon: 'x-circle' as const,
        };
      default:
        return {
          title: 'Export status',
          desc: '',
          badge: request.status,
          bg: 'rgba(156, 163, 175, 0.08)',
          text: colors.text,
          icon: 'info' as const,
        };
    }
  };

  const config = getStatusConfig();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await dataRequestService.getDownloadSignedUrls(request.id);
      if (!result.success) {
        Alert.alert('Download Error', result.error || 'Failed to generate download link.');
        return;
      }

      const urlToOpen = result.pdf_url || result.json_url;
      if (urlToOpen) {
        await Linking.openURL(urlToOpen);
        onRefresh();
      } else {
        Alert.alert('Download Error', 'No download file found.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not open download link.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel request',
      'Are you sure you want to cancel this data export request?',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Export',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const res = await dataRequestService.cancelDataRequest(request.id);
              if (res.success) {
                onRefresh();
              } else {
                Alert.alert('Error', res.error || 'Failed to cancel request.');
              }
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getRemainingDays = () => {
    if (!request.expires_at) return null;
    const diffMs = new Date(request.expires_at).getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} day${days > 1 ? 's' : ''} left` : 'Expiring today';
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top Header Row with Title & Badge */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{config.title}</Text>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            Requested {new Date(request.created_at).toLocaleDateString()} • Format: {request.format.toUpperCase()}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Feather name={config.icon} size={11} color={config.text} />
          <Text style={[styles.badgeText, { color: config.text }]}>{config.badge}</Text>
        </View>
      </View>

      {/* Description */}
      {config.desc ? (
        <Text style={[styles.descText, { color: colors.mutedForeground }]}>{config.desc}</Text>
      ) : null}

      {/* Processing Animation */}
      {request.status === 'processing' && (
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={[styles.progressText, { color: colors.text }]}>
            Extracting records & compiling files...
          </Text>
        </View>
      )}

      {/* Metadata Chips (Size & Expiration) */}
      {request.status === 'completed' && (
        <View style={styles.chipsRow}>
          {request.file_size_bytes ? (
            <View style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="file-text" size={12} color={colors.mutedForeground} />
              <Text style={[styles.chipText, { color: colors.text }]}>
                {formatFileSize(request.file_size_bytes)}
              </Text>
            </View>
          ) : null}

          {request.expires_at ? (
            <View style={[styles.chip, { backgroundColor: 'rgba(242, 101, 34, 0.08)' }]}>
              <Feather name="clock" size={12} color="#F26522" />
              <Text style={[styles.chipText, { color: '#F26522' }]}>{getRemainingDays()}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Action Row */}
      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        {request.status === 'completed' && (
          <Pressable
            testID="download-archive-btn"
            onPress={handleDownload}
            disabled={downloading}
            style={({ pressed }) => [
              styles.downloadBtn,
              downloading && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="download" size={15} color="#FFFFFF" />
                <Text style={styles.downloadBtnText}>Download Archive</Text>
              </>
            )}
          </Pressable>
        )}

        {request.status === 'pending_verification' && onRequestVerification && (
          <Pressable
            testID="verify-code-btn"
            onPress={onRequestVerification}
            style={({ pressed }) => [styles.verifyBtn, pressed && styles.btnPressed]}
          >
            <Feather name="check" size={14} color="#FFFFFF" />
            <Text style={styles.verifyBtnText}>Enter 6-Digit Code</Text>
          </Pressable>
        )}

        {(request.status === 'pending_verification' || request.status === 'processing') && (
          <Pressable
            testID="cancel-data-request-btn"
            onPress={handleCancel}
            disabled={cancelling}
            hitSlop={10}
            style={styles.cancelBtn}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>
                Cancel request
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold',
    letterSpacing: -0.2,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold',
  },
  descText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 18,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  progressText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'DMSans_500Medium',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold',
  },
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
