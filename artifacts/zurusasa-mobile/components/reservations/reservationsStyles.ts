import { StyleSheet } from 'react-native';

const ORANGE = '#F26522';

export const reservationsStyles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#FAFAFA' },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  headerArea: {
    gap: 12,
  },

  // Filter chips
  filterRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#6B7280',
  },
  filterChipTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },

  // Status pills
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },

  // Section blocks
  sectionBlock: {
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  nextTripPill: {
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FDDFCB',
  },
  nextTripPillText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  cardList: {
    gap: 12,
  },

  // Hero Card
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroImageWrap: {
    height: 210,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 16,
  },
  imageFallback: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCountdownBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  heroCountdownText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  heroStatusWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  heroInfoStack: {
    gap: 4,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroLocationText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.85)',
  },
  heroTitleText: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.85)',
  },
  heroMetaDot: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },

  // Hero Body
  heroBody: {
    padding: 16,
    gap: 16,
  },

  // Timeline
  timelineWrap: {
    gap: 8,
  },
  timelineTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    marginHorizontal: 10,
  },
  timelineFill: {
    height: '100%',
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
  timelineSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineStep: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: ORANGE,
  },
  timelineDotCurrent: {
    borderWidth: 2,
    borderColor: ORANGE,
    backgroundColor: '#FFFFFF',
  },
  timelineLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  timelineLabelDone: {
    color: '#374151',
  },
  timelineLabelCurrent: {
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },

  // Hero Dock
  heroDockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  heroPriceBlock: {
    gap: 1,
  },
  heroPriceLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  heroPriceAmount: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPrimaryBtn: {
    height: 38,
    borderRadius: 12,
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },

  // Regular Card
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardCancelled: {
    opacity: 0.75,
    backgroundColor: '#FAFAFA',
  },
  cardImageWrap: {
    height: 125,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardStatusPosition: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  cardContent: {
    padding: 14,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardLocationText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#374151',
  },
  cardPriceText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  cardSecondaryBtnText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
  cardPrimaryBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPrimaryBtnText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  cardReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFF5EF',
    borderWidth: 1,
    borderColor: '#FDDFCB',
  },
  cardReviewBtnText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },

  // Logged Out
  loggedOutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 12,
  },
  loggedOutIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF5EF',
    borderWidth: 1,
    borderColor: '#FDDFCB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  loggedOutTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    textAlign: 'center',
  },
  loggedOutSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIllustration: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOuterCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInnerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5EF',
    borderWidth: 1.5,
    borderColor: '#FDDFCB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  exploreCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 25,
    backgroundColor: ORANGE,
    marginTop: 6,
    shadowColor: ORANGE,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  exploreCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  primaryCtaBtn: {
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  // Skeletons
  skeletonHero: {
    width: '100%',
    height: 280,
    borderRadius: 24,
  },
  skeletonCard: {
    width: '100%',
    height: 180,
    borderRadius: 20,
  },

  // Modal
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 50,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  modalRefText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  modalLocationText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  modalDatesBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 14,
    marginVertical: 4,
  },
  modalDateCol: {
    alignItems: 'center',
    gap: 2,
  },
  modalDateLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  modalDateVal: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  modalInfoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalInfoBox: {
    flex: 1,
    backgroundColor: '#FFF5EF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDDFCB',
    padding: 12,
    gap: 2,
  },
  modalInfoBoxLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  modalInfoBoxVal: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  modalActions: {
    gap: 10,
    marginTop: 6,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: ORANGE,
  },
  modalPrimaryBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  modalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSecondaryBtnText: {
    fontSize: 14.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
  modalCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    marginTop: 4,
  },
  modalCancelBtnText: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: '#DC2626',
  },
  modalReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
  },
  modalReviewBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },

  // ── Timeline Styles ────────────────────────────────────────────────────────
  modalTimelineBlock: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  modalTimelineHeading: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  modalTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  modalTimelineStep: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#10B981',
  },
  stepDotInactive: {
    backgroundColor: '#E5E7EB',
  },
  dotMini: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  stepLineActive: {
    backgroundColor: '#10B981',
  },
  stepLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
  },

  // ── Info Cards & Snapshots ────────────────────────────────────────────────
  infoCardBlock: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoCardTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  infoCardContent: {
    gap: 8,
  },
  infoField: {
    gap: 2,
  },
  infoFieldLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.5,
  },
  infoFieldValue: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
    lineHeight: 18,
  },
  rulesSnapshotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
  },
  ruleBadgeText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_500Medium',
  },
  policyDescText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'DMSans_400Regular',
  },
});
;
