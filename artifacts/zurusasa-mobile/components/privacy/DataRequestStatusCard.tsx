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

  const getStatusBadge = () => {
    switch (request.status) {
      case 'pending_verification':
        return {
          label: 'Verification Pending',
          bg: 'rgba(242,101,34,0.12)',
          text: '#F26522',
          icon: 'clock' as const,
        };
      case 'processing':
        return {
          label: 'Compiling Data Archive',
          bg: 'rgba(59,130,246,0.12)',
          text: '#3B82F6',
          icon: 'loader' as const,
        };
      case 'completed':
        return {
          label: 'Ready for Download',
          bg: 'rgba(34,197,94,0.12)',
          text: '#22C55E',
          icon: 'check-circle' as const,
        };
      case 'failed':
        return {
          label: 'Export Failed',
          bg: 'rgba(239,68,68,0.12)',
          text: '#EF4444',
          icon: 'alert-triangle' as const,
        };
      case 'expired':
        return {
          label: 'Export Expired',
          bg: 'rgba(156,163,175,0.12)',
          text: '#9CA3AF',
          icon: 'archive' as const,
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          bg: 'rgba(156,163,175,0.12)',
          text: '#9CA3AF',
          icon: 'x-circle' as const,
        };
      default:
        return {
          label: request.status,
          bg: 'rgba(156,163,175,0.12)',
          text: colors.text,
          icon: 'info' as const,
        };
    }
  };

  const badge = getStatusBadge();

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
      'Cancel Request',
      'Are you sure you want to cancel this personal data export request?',
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
      {/* Top Row: Title & Badge */}
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Data Export</Text>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            Requested {new Date(request.created_at).toLocaleDateString()} • Format: {request.format.toUpperCase()}
          </Text>
        </View>

        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Feather name={badge.icon} size={11} color={badge.text} />
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </View>

      {/* Middle Status Information */}
      {request.status === 'processing' && (
        <View style={styles.processingRow}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Gathering records across 20 tables and generating signed archives. This typically takes 30–60 seconds.
          </Text>
        </View>
      )}

      {request.status === 'completed' && (
        <View style={styles.completedInfoBox}>
          <View style={styles.metaRow}>
            {request.file_size_bytes ? (
              <View style={styles.metaChip}>
                <Feather name="file" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {formatFileSize(request.file_size_bytes)}
                </Text>
              </View>
            ) : null}

            {request.expires_at ? (
              <View style={styles.metaChip}>
                <Feather name="clock" size={12} color="#F26522" />
                <Text style={[styles.metaText, { color: '#F26522' }]}>{getRemainingDays()}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {request.status === 'failed' && request.error_message && (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={13} color="#EF4444" />
          <Text style={styles.errorText}>{request.error_message}</Text>
        </View>
      )}

      {/* Bottom Action Buttons */}
      <View style={styles.actionRow}>
        {request.status === 'completed' && (
          <Pressable
            onPress={handleDownload}
            disabled={downloading}
            style={[styles.downloadBtn, downloading && styles.btnDisabled]}
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
          <Pressable onPress={onRequestVerification} style={styles.verifyBtn}>
            <Feather name="check" size={14} color="#FFFFFF" />
            <Text style={styles.verifyBtnText}>Enter Verification Code</Text>
          </Pressable>
        )}

        {(request.status === 'pending_verification' || request.status === 'processing') && (
          <Pressable
            onPress={handleCancel}
            disabled={cancelling}
            style={styles.cancelBtn}
            hitSlop={8}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.06)',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  completedInfoBox: {
    marginTop: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
