import { Platform, StyleSheet } from 'react-native';

export const paymentsStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  currencyTopLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    textDecorationLine: 'underline',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 24,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#717171',
    lineHeight: 22,
    marginBottom: 20,
  },
  menuBlock: {
    width: '100%',
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 12,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 16,
  },
  navRowTitle: {
    fontSize: 16,
    color: '#1E1E1E',
    fontWeight: '400',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },

  /* Payment Methods Styles */
  blackActionBtn: {
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  blackActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  linkedMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 16,
  },
  methodIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mpesaBadgeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#16A34A',
  },
  methodRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  methodRowSubtitle: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
  },
  defaultPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  protectionCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 20,
    marginTop: 8,
  },
  protectionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  protectionCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  protectionCardBody: {
    fontSize: 14,
    color: '#484848',
    lineHeight: 20,
  },
  underlineLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  learnMoreBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    textDecorationLine: 'underline',
  },

  /* Bottom Sheet Selector Styles */
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCardOption: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodCardOptionSelected: {
    borderColor: '#111111',
  },
  methodCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  visaBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1A1F71',
    marginRight: 8,
    letterSpacing: 0.5,
  },
  mastercardCircleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mcCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  mpesaSmallBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mpesaSmallBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  mpesaCardSubtitle: {
    fontSize: 12,
    color: '#717171',
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#9E9E9E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#111111',
  },
  radioInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111111',
  },
  sheetFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  sheetCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  sheetDoneBtn: {
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  sheetDoneBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sheetDoneBtnActive: {
    backgroundColor: '#111111',
  },
  sheetDoneText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sheetDoneTextDisabled: {
    color: '#9CA3AF',
  },
  sheetDoneTextActive: {
    color: '#FFFFFF',
  },

  /* Choose Currency Modal Styles */
  currencyModalContainer: {
    flex: 1,
  },
  currencyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  currencyHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
  },
  currencyListContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  currencyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  currencyItemLabel: {
    fontSize: 16,
    color: '#1E1E1E',
    fontWeight: '400',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  currencyItemLabelActive: {
    fontWeight: '700',
    color: '#111111',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },

  /* Your Payments Styles */
  bookingPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bookingRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  bookingRowSub: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
  },
  bookingRowAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  helpFooter: {
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  helpFooterText: {
    fontSize: 14,
    color: '#484848',
  },
  underlineLinkBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    textDecorationLine: 'underline',
  },

  /* Coupons Styles */
  couponCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  couponCountLabel: {
    fontSize: 15,
    color: '#1E1E1E',
  },
  couponCountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },

  /* Earnings Styles */
  warningBanner: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  warningSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 16,
  },
  setupPayoutsPillBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  setupPayoutsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  performanceCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  performanceHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
  },
  performanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  performanceSub: {
    fontSize: 13,
    color: '#717171',
    marginBottom: 20,
  },
  barGraphRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginVertical: 12,
  },
  barPillar: {
    width: 60,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  performanceFooterText: {
    fontSize: 13,
    color: '#717171',
    lineHeight: 18,
    marginTop: 16,
  },
  illustrationCard: {
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  illustrationBadge: {
    marginBottom: 12,
  },
  illustrationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
    textAlign: 'center',
  },
  illustrationSub: {
    fontSize: 13,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Modals & Dialogs */
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  methodTypeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#717171',
  },
  typeBtnTextActive: {
    color: '#111111',
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
    marginTop: 8,
  },
  sheetInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#717171',
    lineHeight: 16,
    marginBottom: 16,
  },
  modalPrimaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
