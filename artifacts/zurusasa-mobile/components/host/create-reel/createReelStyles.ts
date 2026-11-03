import { StyleSheet } from 'react-native';

export const createReelStyles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: '#F7F7F7',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F26522',
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  sectionSubText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'DMSans_400Regular',
  },
  divider: {
    height: 1,
  },

  /* Media Action Cards */
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaActionCard: {
    flex: 1,
    height: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
    overflow: 'hidden',
  },
  mediaActionCardSelected: {
    borderColor: '#F26522',
    backgroundColor: '#FFF8F5',
    borderStyle: 'solid',
  },
  mediaBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCardTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  mediaCardSub: {
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
  },

  /* Video & Thumb Previews */
  videoPreviewWrap: {
    flex: 1,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  videoPreviewView: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoChangeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoChangeBadgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
  },
  thumbPreviewWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  thumbChangeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thumbChangeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
  },

  /* Categories & Locations */
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryChipSelected: {
    backgroundColor: '#F26522',
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  locChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  locChipSelected: {
    backgroundColor: '#F26522',
  },
  locChipText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
  },
  locChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },

  /* Form Controls */
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  textInput: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  textAreaInput: {
    height: 'auto',
    paddingTop: 12,
    paddingBottom: 12,
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 12,
  },

  /* Segments */
  segmentContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
  },
  segmentBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },

  /* Policies */
  policyCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  policyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  policyCardTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  policyCardDesc: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#F26522',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F26522',
  },

  /* House Rules */
  rulesListCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ruleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  ruleToggleTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  ruleToggleSub: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    marginTop: 1,
  },
  ruleDivider: {
    height: 1,
  },

  /* Amenities */
  amenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  amenityChipText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },

  /* Bottom Dock */
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  publishBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: -6,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTitle: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
  },
  modalOptionSub: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  modalCancelBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
