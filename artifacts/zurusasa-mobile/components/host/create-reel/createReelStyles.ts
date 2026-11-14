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
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    flex: 1,
    textAlign: 'center',
  },
  stepCounterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepCounterText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
  },
  stepperContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  stepProgressBarTrack: {
    height: 3.5,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  stepProgressBarFill: {
    height: '100%',
    backgroundColor: '#F26522',
    borderRadius: 2,
  },
  stepperPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepPillNum: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPillNumText: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
  },
  stepPillText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_600SemiBold',
  },

  /* Full-Page Format Chooser (Airbnb Entry Flow) */
  chooserHeroWrap: {
    gap: 6,
    paddingTop: 6,
    paddingBottom: 4,
  },
  chooserEyebrow: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.8,
    color: '#F26522',
  },
  chooserHeroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'DMSans_700Bold',
  },
  chooserHeroSub: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: 'DMSans_400Regular',
  },
  chooserCardsStack: {
    gap: 14,
  },
  chooserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chooserIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooserCardTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  chooserCardSub: {
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: 'DMSans_400Regular',
    marginTop: 3,
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

  /* Publishing Type Cards (Step 1) */
  formatCardsStack: {
    gap: 10,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  formatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatCardTitle: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
  },
  formatCardSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },

  /* 2x2 Primary Experience Category Grid */
  primaryCatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryCatCard: {
    width: '48.4%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  primaryCatIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCatTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  primaryCatSub: {
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: 'DMSans_400Regular',
  },

  /* Establishment Link Pill */
  estChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  estChipText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_600SemiBold',
  },
  infoCalloutCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipSelected: {
    backgroundColor: '#F26522',
    borderColor: '#F26522',
  },
  categoryChipText: {
    fontSize: 12.5,
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
  badgePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgePillText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },

  /* Quick Presets Row */
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  presetChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_600SemiBold',
  },

  /* Compact Policy Pills */
  policyPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  policyPill: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyPillText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  policyDescCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  /* Collapsible Accordion Cards */
  accordionCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  accordionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  accordionSummary: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    gap: 12,
    borderTopWidth: 1,
  },

  /* Summary Card */
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  summaryCardTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  summaryCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  summaryCardLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  summaryCardValue: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
    flex: 1,
    textAlign: 'right',
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
  bottomDockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backStepBtn: {
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  backStepBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  continueBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F26522',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  publishBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
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
