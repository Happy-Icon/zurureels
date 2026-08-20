import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import {
  useBlockHostDates,
  useHostBlockedDates,
  useHostCalendarBookings,
  useHostListings,
  useUnblockHostDates,
} from '@/lib/queries';
import type { BookingRow, ExperienceRow, HostBlockedDateRow } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';

// Date Utility Helpers
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // Monday = 0, Sunday = 6
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDateISO(year: number, month: number, day: number): string {
  const y = year.toString().padStart(4, '0');
  const m = (month + 1).toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(isoStr: string | null | undefined): Date | null {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateFriendly(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  const d = parseISODate(isoStr);
  if (!d) return isoStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDateFriendly(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  const d = parseISODate(isoStr);
  if (!d) return isoStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isSameDay(d1Str: string, d2Str: string): boolean {
  return d1Str === d2Str;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const BLOCK_REASONS = [
  'Personal use',
  'Maintenance',
  'Already booked elsewhere',
  'Other',
];

export default function HostCalendarScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role, viewMode } = useAuth();
  const { showAlert } = useCustomAlert();

  // Month State
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth());

  // Listing Selector State
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>('all');
  const [showListingDropdown, setShowListingDropdown] = useState(false);

  // Selected Date / Sheet States
  const [selectedDayISO, setSelectedDayISO] = useState<string | null>(null);
  const [showAvailabilitySheet, setShowAvailabilitySheet] = useState(false);
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [showBlockSheet, setShowBlockSheet] = useState(false);
  const [showBlockFormModal, setShowBlockFormModal] = useState(false);

  // Active items for sheets
  const [activeBooking, setActiveBooking] = useState<BookingRow | null>(null);
  const [activeBlock, setActiveBlock] = useState<HostBlockedDateRow | null>(null);

  // Block form fields
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockReason, setBlockReason] = useState('Personal use');

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 40;

  const monthStartDate = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).toISOString();
  }, [currentYear, currentMonth]);

  const monthEndDate = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();
  }, [currentYear, currentMonth]);

  // Data Queries
  const { data: listings, isLoading: listingsLoading } = useHostListings(user?.id);
  const { data: bookings, isLoading: bookingsLoading } = useHostCalendarBookings(
    user?.id,
    selectedExperienceId,
    monthStartDate,
    monthEndDate
  );
  const { data: blockedDates, isLoading: blockedLoading } = useHostBlockedDates(
    user?.id,
    selectedExperienceId,
    monthStartDate,
    monthEndDate
  );

  const blockMutation = useBlockHostDates();
  const unblockMutation = useUnblockHostDates();

  const isHost = role === 'host' || viewMode === 'host';

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Selected listing display name
  const currentListingTitle = useMemo(() => {
    if (!selectedExperienceId || selectedExperienceId === 'all') return 'All listings';
    const found = (listings ?? []).find((l) => l.id === selectedExperienceId);
    return found?.title || 'Selected listing';
  }, [selectedExperienceId, listings]);

  // Calendar Day Cell Calculation
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth);

  // Map out date details for current month
  const calendarCells = useMemo(() => {
    const cells = [];
    const todayISO = formatDateISO(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Padding days from previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ type: 'empty', id: `empty-${i}` });
    }

    // 2. Days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      const isoDate = formatDateISO(currentYear, currentMonth, day);
      const isToday = isSameDay(isoDate, todayISO);

      // Check if there is a booking occupying this night
      let dayBooking: BookingRow | null = null;
      let isCheckIn = false;
      let isCheckOut = false;

      (bookings ?? []).forEach((b) => {
        if (!b.check_in || !b.check_out) return;
        const checkInISO = b.check_in.split('T')[0];
        const checkOutISO = b.check_out.split('T')[0];

        if (isSameDay(isoDate, checkInISO)) {
          isCheckIn = true;
        }
        if (isSameDay(isoDate, checkOutISO)) {
          isCheckOut = true;
        }

        // Night is occupied if isoDate >= checkInISO and isoDate < checkOutISO
        if (isoDate >= checkInISO && isoDate < checkOutISO) {
          dayBooking = b;
        }
      });

      // Check if host blocked date occupies this day
      let dayBlock: HostBlockedDateRow | null = null;
      (blockedDates ?? []).forEach((blk) => {
        if (isoDate >= blk.start_date && isoDate < blk.end_date) {
          dayBlock = blk;
        }
      });

      let status: 'available' | 'booked' | 'pending' | 'blocked' = 'available';
      if (dayBooking) {
        status = (dayBooking as BookingRow).status === 'pending' ? 'pending' : 'booked';
      } else if (dayBlock) {
        status = 'blocked';
      }

      cells.push({
        type: 'day',
        id: isoDate,
        day,
        isoDate,
        isToday,
        status,
        isCheckIn,
        isCheckOut,
        booking: dayBooking,
        block: dayBlock,
      });
    }

    return cells;
  }, [currentYear, currentMonth, daysInMonth, firstDayOfWeek, bookings, blockedDates, now]);

  // Month Statistics Summary
  const monthStats = useMemo(() => {
    let bookedNights = 0;
    let blockedNights = 0;
    let availableNights = 0;

    calendarCells.forEach((c) => {
      if (c.type === 'day') {
        if (c.status === 'booked' || c.status === 'pending') bookedNights++;
        else if (c.status === 'blocked') blockedNights++;
        else availableNights++;
      }
    });

    return { bookedNights, blockedNights, availableNights };
  }, [calendarCells]);

  // Smart Alerts Calculation
  const alerts = useMemo(() => {
    const list: string[] = [];
    const todayISO = formatDateISO(now.getFullYear(), now.getMonth(), now.getDate());

    // Check if check-in tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = formatDateISO(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

    const checkInTomorrow = (bookings ?? []).find(
      (b) => b.check_in && isSameDay(b.check_in.split('T')[0], tomorrowISO)
    );
    if (checkInTomorrow) {
      list.push(`Guest check-in tomorrow (${formatDateFriendly(tomorrowISO)})`);
    }

    // Availability gap check
    if (monthStats.availableNights >= 3 && monthStats.bookedNights > 0) {
      list.push(`${monthStats.availableNights} available nights in ${MONTH_NAMES[currentMonth]}`);
    }

    return list;
  }, [bookings, monthStats, now, currentMonth]);

  // Day Cell Tap Handler
  const handleDayPress = (cell: any) => {
    if (cell.type !== 'day') return;

    setSelectedDayISO(cell.isoDate);

    if (cell.status === 'booked' || cell.status === 'pending') {
      setActiveBooking(cell.booking);
      setShowBookingSheet(true);
    } else if (cell.status === 'blocked') {
      setActiveBlock(cell.block);
      setShowBlockSheet(true);
    } else {
      // Available date
      setShowAvailabilitySheet(true);
    }
  };

  // Open Block Form for Date Range
  const handleOpenBlockForm = (startISO?: string) => {
    setShowAvailabilitySheet(false);
    const start = startISO || selectedDayISO || formatDateISO(currentYear, currentMonth, 1);
    const startDateObj = new Date(start);
    startDateObj.setDate(startDateObj.getDate() + 2);
    const end = formatDateISO(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());

    setBlockStartDate(start);
    setBlockEndDate(end);
    setBlockReason('Personal use');
    setShowBlockFormModal(true);
  };

  // Submit Block Form
  const handleSubmitBlock = async () => {
    if (!blockStartDate || !blockEndDate) {
      showAlert({ title: 'Invalid range', message: 'Please select valid start and end dates.' });
      return;
    }

    if (blockEndDate <= blockStartDate) {
      showAlert({ title: 'Invalid range', message: 'End date must be after start date.' });
      return;
    }

    // Default to first experience if 'all' is selected
    const targetExpId =
      selectedExperienceId && selectedExperienceId !== 'all'
        ? selectedExperienceId
        : (listings ?? [])[0]?.id;

    if (!targetExpId) {
      showAlert({ title: 'No listing selected', message: 'Please create or select a listing first.' });
      return;
    }

    // Client-side Conflict Pre-check
    const conflictBooking = (bookings ?? []).find((b) => {
      if (!b.check_in || !b.check_out) return false;
      const bIn = b.check_in.split('T')[0];
      const bOut = b.check_out.split('T')[0];
      return bIn < blockEndDate && bOut > blockStartDate;
    });

    if (conflictBooking) {
      showAlert({
        title: 'Dates unavailable',
        message: `Dates between ${formatDateFriendly(blockStartDate)} and ${formatDateFriendly(blockEndDate)} contain an active reservation (${conflictBooking.trip_title || 'Confirmed Booking'}). You cannot block dates with active reservations.`,
        icon: 'alert-triangle',
        buttons: [
          {
            text: 'View booking',
            onPress: () => {
              setShowBlockFormModal(false);
              setActiveBooking(conflictBooking);
              setShowBookingSheet(true);
            },
          },
          { text: 'Close', style: 'cancel' },
        ],
      });
      return;
    }

    try {
      await blockMutation.mutateAsync({
        experienceId: targetExpId,
        startDate: blockStartDate,
        endDate: blockEndDate,
        reason: blockReason,
      });

      setShowBlockFormModal(false);
      showAlert({
        title: 'Dates blocked',
        message: `Blocked ${formatDateFriendly(blockStartDate)} → ${formatDateFriendly(blockEndDate)} for ${blockReason}.`,
        icon: 'check-circle',
      });
    } catch (err: any) {
      showAlert({
        title: 'Block conflict detected',
        message: err.message || 'Could not block requested dates.',
        icon: 'alert-triangle',
      });
    }
  };

  // Submit Unblock Date
  const handleUnblock = async () => {
    if (!activeBlock) return;

    showAlert({
      title: 'Unblock dates?',
      message: `Unblock ${formatDateFriendly(activeBlock.start_date)} → ${formatDateFriendly(activeBlock.end_date)} and make them available for guests?`,
      icon: 'unlock',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock dates',
          onPress: async () => {
            try {
              await unblockMutation.mutateAsync({ blockId: activeBlock.id });
              setShowBlockSheet(false);
              showAlert({ title: 'Dates unblocked', message: 'The date range is now available for bookings.', icon: 'check-circle' });
            } catch (err: any) {
              showAlert({ title: 'Error', message: err.message || 'Could not unblock dates.' });
            }
          },
        },
      ],
    });
  };

  // Signed Out / Non-Host Access Guard
  if (!user || !isHost) {
    return (
      <View style={[styles.fill, styles.centered, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <View style={[styles.nonHostCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.nonHostIconWrap, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
            <Feather name="calendar" size={32} color={colors.text} />
          </View>
          <Text style={[styles.nonHostTitle, { color: colors.text }]}>Host Calendar</Text>
          <Text style={[styles.nonHostSub, { color: colors.mutedForeground }]}>
            The Smart Calendar is reserved for ZuruSasa hosts to manage property availability, reservations, and date blocks.
          </Text>
          <Pressable
            onPress={() => router.push('/become-host')}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: '#F26522' }, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryBtnText}>Become a host</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const pageLoading = listingsLoading || bookingsLoading || blockedLoading;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* ── 1. TOP HEADER (Airbnb Style) ─────────────────────────────────── */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile');
          }}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>Calendar</Text>

        <Pressable
          onPress={() => handleOpenBlockForm()}
          style={({ pressed }) => [styles.plusBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }, pressed && { opacity: 0.7 }]}
          hitSlop={10}
        >
          <Feather name="plus" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomPad }}
      >
        {/* ── 2. COMPACT LISTING SELECTOR ────────────────────────────────── */}
        {(listings ?? []).length > 0 && (
          <View style={styles.listingSelectorRow}>
            <Pressable
              onPress={() => setShowListingDropdown(!showListingDropdown)}
              style={({ pressed }) => [styles.listingDropdownBtn, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.listingDropdownText, { color: colors.text }]} numberOfLines={1}>
                {currentListingTitle}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.text} />
            </Pressable>
          </View>
        )}

        {/* Listing Dropdown Menu */}
        {showListingDropdown && (
          <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              onPress={() => {
                setSelectedExperienceId('all');
                setShowListingDropdown(false);
              }}
              style={styles.dropdownItem}
            >
              <Text style={[styles.dropdownItemText, { color: colors.text }, selectedExperienceId === 'all' && styles.dropdownItemActive]}>
                All listings
              </Text>
              {selectedExperienceId === 'all' && <Feather name="check" size={16} color={colors.text} />}
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {(listings ?? []).map((listing) => {
              const isSelected = selectedExperienceId === listing.id;
              return (
                <Pressable
                  key={listing.id}
                  onPress={() => {
                    setSelectedExperienceId(listing.id);
                    setShowListingDropdown(false);
                  }}
                  style={styles.dropdownItem}
                >
                  <Text style={[styles.dropdownItemText, { color: colors.text }, isSelected && styles.dropdownItemActive]} numberOfLines={1}>
                    {listing.title || 'Untitled listing'}
                  </Text>
                  {isSelected && <Feather name="check" size={16} color={colors.text} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── 3. MONTH NAVIGATION ROW ────────────────────────────────────── */}
        <View style={styles.monthNavRow}>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>

          <View style={styles.monthNavRight}>
            <Pressable onPress={handleGoToToday} style={({ pressed }) => [styles.todayBtn, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.todayBtnText, { color: colors.text }]}>Today</Text>
            </Pressable>

            <Pressable onPress={handlePrevMonth} style={({ pressed }) => [styles.monthNavArrow, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }, pressed && { opacity: 0.6 }]}>
              <Feather name="chevron-left" size={20} color={colors.text} />
            </Pressable>

            <Pressable onPress={handleNextMonth} style={({ pressed }) => [styles.monthNavArrow, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }, pressed && { opacity: 0.6 }]}>
              <Feather name="chevron-right" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* ── 4. SMART SUMMARY LINE ──────────────────────────────────────── */}
        <View style={styles.summaryLine}>
          <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{monthStats.bookedNights}</Text> booked nights ·{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>{monthStats.availableNights}</Text> available ·{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>{monthStats.blockedNights}</Text> blocked
          </Text>
        </View>

        {/* ── 5. SMART ALERTS ────────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <View style={[styles.alertsContainer, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
            {alerts.map((alertMsg, idx) => (
              <View key={idx} style={styles.alertRow}>
                <Feather name="info" size={14} color={colors.text} />
                <Text style={[styles.alertText, { color: colors.text }]}>{alertMsg}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 6. CALENDAR GRID ───────────────────────────────────────────── */}
        {pageLoading ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            <Skeleton style={{ height: 280, borderRadius: 20 }} />
          </View>
        ) : (
          <View style={[styles.calendarContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Weekdays Header */}
            <View style={[styles.weekdaysRow, { borderBottomColor: colors.border }]}>
              {WEEKDAYS.map((wd) => (
                <Text key={wd} style={[styles.weekdayText, { color: colors.mutedForeground }]}>
                  {wd}
                </Text>
              ))}
            </View>

            {/* Date Cells Grid */}
            <View style={styles.daysGrid}>
              {calendarCells.map((cell) => {
                if (cell.type === 'empty') {
                  return <View key={cell.id} style={styles.dayCellEmpty} />;
                }

                const isBooked = cell.status === 'booked';
                const isPending = cell.status === 'pending';
                const isBlocked = cell.status === 'blocked';

                return (
                  <Pressable
                    key={cell.id}
                    onPress={() => handleDayPress(cell)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      cell.isToday && [styles.dayCellToday, { borderColor: '#F26522' }],
                      isBooked && styles.dayCellBooked,
                      isPending && [styles.dayCellPending, { backgroundColor: isDark ? '#78350F30' : '#FEF3C7' }],
                      isBlocked && [styles.dayCellBlocked, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }],
                      pressed && styles.dayCellPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: colors.text },
                        cell.isToday && [styles.dayNumberToday, { color: '#F26522' }],
                        isBooked && styles.dayNumberBooked,
                        isPending && styles.dayNumberPending,
                        isBlocked && styles.dayNumberBlocked,
                      ]}
                    >
                      {cell.day}
                    </Text>

                    {/* Indicators */}
                    <View style={styles.indicatorWrap}>
                      {cell.isCheckIn && (
                        <View style={styles.checkInTag}>
                          <Text style={styles.checkInTagText}>In</Text>
                        </View>
                      )}
                      {cell.isCheckOut && (
                        <View style={styles.checkOutTag}>
                          <Text style={styles.checkOutTagText}>Out</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Legend Row */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: isDark ? '#27272A' : '#F3F4F6', borderWidth: 1, borderColor: colors.border }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>Available</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F26522' }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>Booked</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FCD34D' }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>Pending</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: isDark ? '#52525B' : '#94A3B8' }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>Blocked</Text>
          </View>
        </View>

        {/* ── 7. UPCOMING BOOKINGS LIST ──────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming reservations</Text>

          {(bookings ?? []).length === 0 ? (
            <View style={[styles.emptyBookingsBox, { backgroundColor: colors.card }]}>
              <Feather name="calendar" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyBookingsText, { color: colors.mutedForeground }]}>No upcoming bookings for this listing</Text>
            </View>
          ) : (
            (bookings ?? []).slice(0, 5).map((b) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  setActiveBooking(b);
                  setShowBookingSheet(true);
                }}
                style={({ pressed }) => [styles.bookingCardRow, { borderBottomColor: colors.border }, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.bookingCardLeft}>
                  <Text style={[styles.bookingCardDates, { color: colors.text }]}>
                    {formatDateFriendly(b.check_in)} → {formatDateFriendly(b.check_out)}
                  </Text>
                  <Text style={[styles.bookingCardTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {b.trip_title || (b.experience as any)?.title || 'Stay reservation'}
                  </Text>
                </View>
                <View style={styles.bookingCardRight}>
                  <Text style={[styles.bookingCardPrice, { color: colors.text }]}>
                    KES {((b.amount ?? 0) / (b.amount && b.amount > 10000 ? 100 : 1)).toLocaleString()}
                  </Text>
                  <Text style={[styles.bookingBadge, b.status === 'pending' ? styles.badgePending : styles.badgeConfirmed]}>
                    {b.status === 'pending' ? 'Pending' : 'Confirmed'}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── SHEET 1: AVAILABLE DATE SHEET ──────────────────────────────── */}
      <Modal visible={showAvailabilitySheet} animationType="slide" transparent>
        <View style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{formatFullDateFriendly(selectedDayISO)}</Text>
              <Pressable onPress={() => setShowAvailabilitySheet(false)}>
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.sheetBadgeRow}>
              <View style={[styles.statusPill, { backgroundColor: '#10B98118' }]}>
                <Text style={[styles.statusPillText, { color: '#047857' }]}>Available</Text>
              </View>
            </View>

            <View style={[styles.sheetInfoGroup, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoRowLabel, { color: colors.mutedForeground }]}>Nightly price</Text>
                <Text style={[styles.infoRowVal, { color: colors.text }]}>
                  KES {((listings ?? [])[0]?.current_price ?? 8000).toLocaleString()} / night
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoRowLabel, { color: colors.mutedForeground }]}>Minimum stay</Text>
                <Text style={[styles.infoRowVal, { color: colors.text }]}>1 night</Text>
              </View>
            </View>

            <Pressable
              onPress={() => handleOpenBlockForm()}
              style={({ pressed }) => [styles.sheetActionBtn, { backgroundColor: '#F26522' }, pressed && { opacity: 0.9 }]}
            >
              <Feather name="slash" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.sheetActionBtnText}>Block these dates</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── SHEET 2: BOOKED DATE DETAILS SHEET ───────────────────────────── */}
      <Modal visible={showBookingSheet} animationType="slide" transparent>
        <View style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {formatDateFriendly(activeBooking?.check_in)} – {formatDateFriendly(activeBooking?.check_out)}
              </Text>
              <Pressable onPress={() => setShowBookingSheet(false)}>
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.sheetBadgeRow}>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: activeBooking?.status === 'pending' ? '#FEF3C7' : '#F2652218' },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    { color: activeBooking?.status === 'pending' ? '#D97706' : '#F26522' },
                  ]}
                >
                  {activeBooking?.status === 'pending' ? 'Pending Booking' : 'Confirmed Booking'}
                </Text>
              </View>
            </View>

            <View style={[styles.sheetInfoGroup, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoRowLabel, { color: colors.mutedForeground }]}>Listing</Text>
                <Text style={[styles.infoRowVal, { color: colors.text }]}>
                  {activeBooking?.trip_title || (activeBooking?.experience as any)?.title || 'Stay'}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoRowLabel, { color: colors.mutedForeground }]}>Check-in</Text>
                <Text style={[styles.infoRowVal, { color: colors.text }]}>{formatFullDateFriendly(activeBooking?.check_in)}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoRowLabel, { color: colors.mutedForeground }]}>Check-out</Text>
                <Text style={[styles.infoRowVal, { color: colors.text }]}>{formatFullDateFriendly(activeBooking?.check_out)}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoRowLabel, { color: colors.mutedForeground }]}>Total amount</Text>
                <Text style={[styles.infoRowVal, { color: colors.text }]}>
                  KES {((activeBooking?.amount ?? 0) / (activeBooking?.amount && activeBooking.amount > 10000 ? 100 : 1)).toLocaleString()}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                setShowBookingSheet(false);
                router.push('/reservations');
              }}
              style={({ pressed }) => [styles.sheetActionBtn, { backgroundColor: '#F26522' }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.sheetActionBtnText}>View reservation details</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── SHEET 3: BLOCKED DATE DETAILS SHEET ──────────────────────────── */}
      <Modal visible={showBlockSheet} animationType="slide" transparent>
        <View style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Blocked dates</Text>
              <Pressable onPress={() => setShowBlockSheet(false)}>
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.sheetBadgeRow}>
              <View style={[styles.statusPill, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                <Text style={[styles.statusPillText, { color: colors.mutedForeground }]}>Blocked</Text>
              </View>
            </View>

            <View style={[styles.sheetInfoGroup, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoRowLabel, { color: colors.mutedForeground }]}>Date range</Text>
                <Text style={[styles.infoRowVal, { color: colors.text }]}>
                  {formatDateFriendly(activeBlock?.start_date)} → {formatDateFriendly(activeBlock?.end_date)}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoRowLabel, { color: colors.mutedForeground }]}>Reason</Text>
                <Text style={[styles.infoRowVal, { color: colors.text }]}>{activeBlock?.reason || 'Personal use'}</Text>
              </View>
            </View>

            <Pressable
              onPress={handleUnblock}
              disabled={unblockMutation.isPending}
              style={({ pressed }) => [styles.sheetActionBtn, styles.btnDestructive, pressed && { opacity: 0.9 }]}
            >
              {unblockMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.sheetActionBtnText}>Unblock dates</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── FORM MODAL: BLOCK DATES RANGE ────────────────────────────────── */}
      <Modal visible={showBlockFormModal} animationType="slide" transparent>
        <View style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Block dates</Text>
              <Pressable onPress={() => setShowBlockFormModal(false)}>
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Start date (YYYY-MM-DD)</Text>
              <TextInput
                value={blockStartDate}
                onChangeText={setBlockStartDate}
                placeholder="2026-08-20"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.fieldInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>End date (YYYY-MM-DD)</Text>
              <TextInput
                value={blockEndDate}
                onChangeText={setBlockEndDate}
                placeholder="2026-08-24"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.fieldInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Reason for blocking</Text>
              <View style={styles.reasonPickerRow}>
                {BLOCK_REASONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setBlockReason(r)}
                    style={[
                      styles.reasonChip,
                      { backgroundColor: isDark ? '#27272A' : '#F1F5F9' },
                      blockReason === r && [styles.reasonChipActive, { backgroundColor: '#F26522' }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.reasonChipText,
                        { color: colors.text },
                        blockReason === r && styles.reasonChipTextActive,
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={handleSubmitBlock}
              disabled={blockMutation.isPending}
              style={({ pressed }) => [styles.sheetActionBtn, { backgroundColor: '#F26522' }, pressed && { opacity: 0.9 }]}
            >
              {blockMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.sheetActionBtnText}>Confirm date block</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  nonHostCard: {
    maxWidth: 360,
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  nonHostIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nonHostTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  nonHostSub: {
    fontSize: 14,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    height: 48,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // 1. Header
  topHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnActive: {
    backgroundColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. Listing Selector
  listingSelectorRow: {
    marginBottom: 16,
  },
  listingDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  listingDropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#334155',
  },
  dropdownItemActive: {
    fontWeight: '700',
    color: '#000000',
  },

  // 3. Month Navigation Row
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  monthNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  monthNavArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 4. Summary Line
  summaryLine: {
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 13,
    color: '#64748B',
  },

  // 5. Alerts
  alertsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0F172A',
  },

  // 6. Calendar Grid
  calendarContainer: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 48,
  },
  dayCell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 2,
    position: 'relative',
  },
  dayCellPressed: {
    opacity: 0.6,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  dayCellBooked: {
    backgroundColor: '#F2652220',
  },
  dayCellPending: {
    backgroundColor: '#FEF3C7',
  },
  dayCellBlocked: {
    backgroundColor: '#F1F5F9',
  },

  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  dayNumberToday: {
    fontWeight: '800',
    color: '#000000',
  },
  dayNumberBooked: {
    fontWeight: '700',
    color: '#D9480F',
  },
  dayNumberPending: {
    fontWeight: '700',
    color: '#D97706',
  },
  dayNumberBlocked: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },

  indicatorWrap: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    gap: 2,
  },
  checkInTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: 3,
    borderRadius: 4,
  },
  checkInTagText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  checkOutTag: {
    backgroundColor: '#64748B',
    paddingHorizontal: 3,
    borderRadius: 4,
  },
  checkOutTagText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: '#64748B',
  },

  // 7. Upcoming Reservations List
  sectionBlock: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  emptyBookingsBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
  },
  emptyBookingsText: {
    fontSize: 13,
    color: '#64748B',
  },
  bookingCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bookingCardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  bookingCardDates: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  bookingCardTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bookingCardRight: {
    alignItems: 'flex-end',
  },
  bookingCardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  bookingBadge: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  badgeConfirmed: {
    color: '#059669',
  },
  badgePending: {
    color: '#D97706',
  },

  // Bottom Sheets & Modals
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
  },
  sheetBadgeRow: {
    flexDirection: 'row',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sheetInfoGroup: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoRowLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoRowVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  sheetActionBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnDestructive: {
    backgroundColor: '#DC2626',
  },
  sheetActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Form Fields
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#000000',
  },
  reasonPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  reasonChipActive: {
    backgroundColor: '#000000',
  },
  reasonChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  reasonChipTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
});
