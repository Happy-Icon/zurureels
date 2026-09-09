import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { supabase, type ReelRow } from '@/lib/supabase';
import { resolveAvatarUrl } from '@/lib/avatar';
import { reviewService, type ReviewSummaryData } from '@/services/reviewService';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const BRAND_ORANGE = '#F26522';

interface ReelInfoSheetProps {
  reel: ReelRow;
  visible: boolean;
  onClose: () => void;
  onBookNow?: () => void;
}

export function ReelInfoSheet({ reel, visible, onClose, onBookNow }: ReelInfoSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const hostMeta = ((reel.host?.metadata ?? {}) as Record<string, unknown>);

  const [reviewsSummary, setReviewsSummary] = useState<ReviewSummaryData | null>(null);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);

  const { user, profile } = useAuth();
  const hostName = reel.host?.full_name ?? 'Zuru Host';
  const verified = Boolean(reel.host?.is_verified || reel.host?.verification_status === 'verified');
  const hostId = reel.user_id ?? reel.host?.id;
  const initialHostAvatar =
    reel.host?.avatar_url ||
    resolveAvatarUrl(
      reel.host
        ? {
            ...reel.host,
            id: hostId ?? undefined,
            email: reel.host.email,
            avatar_url: reel.host.avatar_url,
          }
        : (hostId ? { id: hostId } : null),
      user,
      profile
    );

  const [lazyHostAvatar, setLazyHostAvatar] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!initialHostAvatar && !lazyHostAvatar && hostId) {
      (async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, metadata')
            .eq('id', hostId)
            .maybeSingle();
          if (active && data) {
            const resolved = resolveAvatarUrl(
              { ...reel.host, ...data, id: hostId },
              user,
              profile
            );
            if (resolved) {
              setLazyHostAvatar(resolved);
            }
          }
        } catch {
          // ignore
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [initialHostAvatar, lazyHostAvatar, hostId, reel.host, user, profile]);

  const hostAvatar = initialHostAvatar || lazyHostAvatar;

  const maxGuests = exp?.max_guests || (meta.max_guests as number) || 2;
  const bedrooms = (meta.bedrooms as number) || 1;
  const beds = (meta.beds as number) || 1;
  const baths = (meta.baths as number) || 1;

  const checkInTime = exp?.check_in_time || (meta.check_in_time as string) || '14:00';
  const checkOutTime = exp?.check_out_time || (meta.check_out_time as string) || '10:00';
  const cancellationPolicy = (exp?.cancellation_policy || meta.cancellation_policy || 'flexible') as string;
  const houseRules = (exp?.house_rules || meta.house_rules || {}) as Record<string, any>;

  const rawAmenities: string[] = Array.isArray(exp?.amenities) && exp.amenities.length > 0
    ? exp.amenities
    : Array.isArray(meta.amenities) && meta.amenities.length > 0
    ? (meta.amenities as string[])
    : ['Fast Wifi', 'Free parking on premises', 'Air Conditioning', 'Swimming Pool', 'Ocean View', 'Kitchen'];

  const amenities = showAllAmenities ? rawAmenities : rawAmenities.slice(0, 6);

  const heroImage =
    exp?.image_url ||
    reel.thumbnail_url ||
    (meta.image_urls as string[])?.[0] ||
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80';

  const imageUrls: string[] = Array.isArray(meta.image_urls) && meta.image_urls.length > 0
    ? (meta.image_urls as string[])
    : [heroImage];

  // ── Load Real Database Reviews ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !exp?.id) return;
    let isMounted = true;
    setLoadingReviews(true);

    reviewService
      .fetchReviewsForListing(exp.id)
      .then((res) => {
        if (isMounted) {
          setReviewsSummary(res.summary);
          setReviewsList(res.reviews || []);
        }
      })
      .catch((err) => {
        console.warn('Error fetching reviews for listing:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingReviews(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, exp?.id]);

  const handleSeeAllReviews = () => {
    onClose();
    router.push({
      pathname: '/reviews' as any,
      params: {
        listingId: exp?.id || 'exp-default',
        title: exp?.title || 'Experience',
      },
    });
  };

  const ratingVal = reviewsSummary?.totalCount
    ? reviewsSummary.averageRating
    : Number((meta.rating as number | string | undefined) ?? 5.0);

  const reviewCount = reviewsSummary?.totalCount ?? 0;

function formatHostTenure(createdAt?: string | null): { num: string; label: string } {
  if (!createdAt) {
    return { num: '1', label: 'Mo hosting' };
  }
  const created = new Date(createdAt);
  const now = new Date();

  const diffYears = now.getFullYear() - created.getFullYear();
  const diffMonths = (now.getMonth() - created.getMonth()) + (diffYears * 12);
  const diffDays = Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));

  if (diffMonths >= 24) {
    const yrs = Math.floor(diffMonths / 12);
    return { num: `${yrs}`, label: `Yrs hosting` };
  } else if (diffMonths >= 12) {
    return { num: '1', label: 'Yr hosting' };
  } else if (diffMonths >= 1) {
    return { num: `${diffMonths}`, label: `Mo${diffMonths !== 1 ? 's' : ''} hosting` };
  } else {
    return { num: `${diffDays}`, label: `Day${diffDays !== 1 ? 's' : ''} hosting` };
  }
}

  const hostCreatedAt = (reel.host as any)?.created_at || (hostMeta.created_at as string);
  const hostTenure = useMemo(() => formatHostTenure(hostCreatedAt), [hostCreatedAt]);

  const hostWork = (hostMeta.work as string) || 'Host & Local Guide';
  const hostLanguages = (hostMeta.languages as string) || 'English, Swahili';
  const hostBio =
    (reel.host as any)?.bio ||
    (hostMeta.bio as string) ||
    `Welcome! I am passionate about hosting travelers and providing an authentic coastal stay in ${exp?.location || 'Kenya'}.`;
  const hostResponseRate = (hostMeta.response_rate as string) || '100%';
  const hostResponseTime = (hostMeta.response_time as string) || 'within an hour';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: '#FFFFFF' }]}>
        {/* Scrollable Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
        >
          {/* ── 1. HERO IMAGE WITH ACTIONS ── */}
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: heroImage }}
              style={styles.heroImage}
              contentFit="cover"
            />
            {/* Top Navigation Row */}
            <View style={[styles.heroNavRow, { top: Platform.OS === 'ios' ? insets.top + 6 : 20 }]}>
              <Pressable onPress={onClose} style={styles.navCircleBtn} hitSlop={10}>
                <Feather name="arrow-left" size={20} color="#111111" />
              </Pressable>
              <View style={styles.navRightGroup}>
                <Pressable style={styles.navCircleBtn} hitSlop={10}>
                  <Feather name="share" size={18} color="#111111" />
                </Pressable>
                <Pressable style={styles.navCircleBtn} hitSlop={10}>
                  <Feather name="heart" size={18} color="#111111" />
                </Pressable>
              </View>
            </View>

            {/* Photo Counter Pill */}
            <View style={styles.photoCountPill}>
              <Text style={styles.photoCountText}>1 / {imageUrls.length}</Text>
            </View>
          </View>

          <View style={styles.body}>
            {/* ── 2. TITLE & CAPACITY SPECS ── */}
            <View style={styles.titleSection}>
              <Text style={styles.listingTitle}>{exp?.title || (reel as any).caption || 'Coastal Experience'}</Text>
              <Text style={styles.unitSubtitle}>
                Entire place in {exp?.location || 'Kenyan Coast'}
              </Text>
              <Text style={styles.capacitySpecs}>
                {maxGuests} guest{maxGuests !== 1 ? 's' : ''} · {bedrooms} bedroom{bedrooms !== 1 ? 's' : ''} · {beds} bed{beds !== 1 ? 's' : ''} · {baths} bath{baths !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* ── 3. GUEST FAVOURITE & RATING RIBBON ── */}
            <View style={styles.guestFavRibbon}>
              <View style={styles.ribbonCol}>
                <Text style={styles.ribbonRatingNumber}>
                  {reviewCount > 0 ? ratingVal.toFixed(1).replace('.', ',') : '★ New'}
                </Text>
                {reviewCount > 0 ? (
                  <View style={styles.starsRow}>
                    {Array.from({ length: Math.min(5, Math.round(ratingVal)) }).map((_, s) => (
                      <MaterialCommunityIcons key={s} name="star" size={11} color="#111111" />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.ribbonReviewsLabel}>New listing</Text>
                )}
              </View>

              <View style={styles.ribbonDivider} />

              <View style={styles.ribbonMiddleCol}>
                {reviewCount >= 3 && ratingVal >= 4.7 ? (
                  <View style={styles.laurelRow}>
                    <MaterialCommunityIcons name="leaf" size={16} color="#111111" style={{ transform: [{ scaleX: -1 }] }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.guestFavTitle}>Guest</Text>
                      <Text style={styles.guestFavTitle}>favourite</Text>
                    </View>
                    <MaterialCommunityIcons name="leaf" size={16} color="#111111" />
                  </View>
                ) : reviewCount > 0 ? (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.guestFavTitle}>Verified</Text>
                    <Text style={styles.ribbonReviewsLabel}>Guest Rating</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.guestFavTitle}>Be the first</Text>
                    <Text style={styles.ribbonReviewsLabel}>to review</Text>
                  </View>
                )}
              </View>

              <View style={styles.ribbonDivider} />

              <Pressable onPress={handleSeeAllReviews} style={styles.ribbonCol}>
                <Text style={styles.ribbonReviewsNumber}>{reviewCount}</Text>
                <Text style={styles.ribbonReviewsLabel}>{reviewCount === 1 ? 'Review' : 'Reviews'}</Text>
              </Pressable>
            </View>

            <View style={styles.separator} />

            {/* ── 4. KEY FEATURE HIGHLIGHTS ── */}
            <View style={styles.highlightsBlock}>
              <View style={styles.highlightItem}>
                <Feather name="key" size={20} color="#111111" style={styles.highlightIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.highlightHeading}>Seamless check-in</Text>
                  <Text style={styles.highlightSub}>
                    Check-in at {checkInTime} · Hosted by verified host {hostName}.
                  </Text>
                </View>
              </View>

              <View style={styles.highlightItem}>
                <Feather name="map-pin" size={20} color="#111111" style={styles.highlightIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.highlightHeading}>Prime coastal location</Text>
                  <Text style={styles.highlightSub}>Located in {exp?.location || 'Kenyan Coast'}.</Text>
                </View>
              </View>

              <View style={styles.highlightItem}>
                <Feather name="shield" size={20} color="#111111" style={styles.highlightIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.highlightHeading}>
                    {cancellationPolicy === 'strict'
                      ? 'Strict cancellation policy'
                      : cancellationPolicy === 'moderate'
                      ? 'Moderate cancellation policy'
                      : 'Free cancellation before check-in'}
                  </Text>
                  <Text style={styles.highlightSub}>
                    {cancellationPolicy === 'strict'
                      ? 'Full refund if cancelled 7+ days before check-in.'
                      : 'Review the full policy terms before booking.'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.separator} />

            {/* ── 5. ABOUT DESCRIPTION ── */}
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionHeading}>About this place</Text>
              <Text style={styles.descriptionText}>
                {exp?.description ||
                  (reel as any).caption ||
                  'Enjoy an authentic stay in the Kenyan coast with modern amenities, comfortable furnishings, and warm hospitality.'}
              </Text>
            </View>

            <View style={styles.separator} />

            {/* ── 6. REVIEWS SHOWCASE CAROUSEL ── */}
            <View style={styles.reviewsShowcaseBlock}>
              {reviewCount >= 3 && ratingVal >= 4.7 ? (
                <>
                  <View style={styles.bigWreathHeader}>
                    <MaterialCommunityIcons name="leaf" size={28} color="#333333" style={{ transform: [{ scaleX: -1 }] }} />
                    <Text style={styles.bigRatingText}>{ratingVal.toFixed(1).replace('.', ',')}</Text>
                    <MaterialCommunityIcons name="leaf" size={28} color="#333333" />
                  </View>
                  <Text style={styles.bigGuestFavTitle}>Guest favourite</Text>
                  <Text style={styles.bigGuestFavSub}>
                    This home is a guest favourite based on ratings, reviews and reliability
                  </Text>
                </>
              ) : reviewCount > 0 ? (
                <>
                  <View style={styles.bigWreathHeader}>
                    <MaterialCommunityIcons name="star" size={28} color="#F26522" />
                    <Text style={styles.bigRatingText}>{ratingVal.toFixed(1).replace('.', ',')}</Text>
                  </View>
                  <Text style={styles.bigGuestFavTitle}>Guest reviews</Text>
                  <Text style={styles.bigGuestFavSub}>
                    Based on {reviewCount} verified guest review{reviewCount !== 1 ? 's' : ''}
                  </Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="star-outline" size={32} color="#9CA3AF" />
                  <Text style={styles.bigGuestFavTitle}>No reviews yet</Text>
                  <Text style={styles.bigGuestFavSub}>
                    Reviews will appear here after guests complete their stay.
                  </Text>
                </>
              )}

              {reviewsList.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.reviewsCarousel}
                >
                  {reviewsList.map((rev) => (
                    <View key={rev.id} style={styles.reviewSnippetCard}>
                      <View style={styles.reviewerTopRow}>
                        <View style={styles.reviewerAvatar}>
                          <Text style={styles.reviewerAvatarInitial}>
                            {(rev.reviewer?.full_name || 'G').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.reviewerName}>{rev.reviewer?.full_name || 'Verified Guest'}</Text>
                          <Text style={styles.reviewerLoc}>Verified stay</Text>
                        </View>
                      </View>

                      <View style={styles.reviewRatingRow}>
                        <View style={styles.starsRow}>
                          {Array.from({ length: Number(rev.rating || 5) }).map((_, s) => (
                            <MaterialCommunityIcons key={s} name="star" size={12} color="#111111" />
                          ))}
                        </View>
                        <Text style={styles.reviewTimeAgo}>
                          · {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : 'Recent'}
                        </Text>
                      </View>

                      <Text style={styles.reviewHeadline}>{rev.title || 'Wonderful Experience'}</Text>
                      <Text style={styles.reviewSnippetBody} numberOfLines={3}>
                        {rev.comment}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {reviewCount > 0 ? (
                <Pressable onPress={handleSeeAllReviews} style={styles.showAllReviewsBtn}>
                  <Text style={styles.showAllReviewsBtnText}>Show all {reviewCount} reviews</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.separator} />

            {/* ── 7. WHAT THIS PLACE OFFERS (AMENITIES) ── */}
            <View style={styles.amenitiesSection}>
              <Text style={styles.sectionHeading}>What this place offers</Text>
              <View style={styles.amenitiesList}>
                {amenities.map((item, idx) => (
                  <View key={idx} style={styles.amenityRow}>
                    <Feather
                      name={
                        item.toLowerCase().includes('wifi')
                          ? 'wifi'
                          : item.toLowerCase().includes('park')
                          ? 'truck'
                          : item.toLowerCase().includes('tv')
                          ? 'tv'
                          : item.toLowerCase().includes('kitchen')
                          ? 'coffee'
                          : 'check'
                      }
                      size={18}
                      color="#222222"
                      style={styles.amenityIcon}
                    />
                    <Text style={styles.amenityName}>{item}</Text>
                  </View>
                ))}
              </View>

              {rawAmenities.length > 6 ? (
                <Pressable
                  onPress={() => setShowAllAmenities(!showAllAmenities)}
                  style={styles.showAllAmenitiesBtn}
                >
                  <Text style={styles.showAllAmenitiesBtnText}>
                    {showAllAmenities ? 'Show less' : `Show all ${rawAmenities.length} amenities`}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.separator} />

            {/* ── 8. WHERE YOU'LL BE (LOCATION) ── */}
            <View style={styles.locationSection}>
              <Text style={styles.sectionHeading}>Where you’ll be</Text>
              <Text style={styles.locationSub}>{exp?.location || 'Kenyan Coast'}</Text>

              <View style={styles.mapCardMock}>
                <Image
                  source={{ uri: heroImage }}
                  style={styles.mapCardImage}
                  contentFit="cover"
                />
                <View style={styles.mapPinCircle}>
                  <Feather name="map-pin" size={18} color="#FFFFFF" />
                </View>
              </View>
            </View>

            <View style={styles.separator} />

            {/* ── 9. MEET YOUR HOST ── */}
            <View style={styles.meetHostSection}>
              <Text style={styles.sectionHeading}>Meet your host</Text>

              <View style={styles.hostProfileCard}>
                <View style={styles.hostCardLeft}>
                  <View style={styles.hostCardAvatarWrap}>
                    {hostAvatar ? (
                      <Image source={{ uri: hostAvatar }} style={styles.hostCardAvatar} />
                    ) : (
                      <View style={styles.hostCardAvatarFallback}>
                        <Text style={styles.hostCardAvatarInitial}>{hostName.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    {verified ? (
                      <View style={styles.hostCardShieldBadge}>
                        <Feather name="check" size={10} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.hostCardName}>{hostName}</Text>
                  {verified ? (
                    <View style={styles.superhostBadge}>
                      <MaterialCommunityIcons name="shield-check" size={14} color="#008A05" />
                      <Text style={[styles.superhostText, { color: '#008A05' }]}>Verified Host</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.hostCardStatsCol}>
                  <View style={styles.hostStatItem}>
                    <Text style={styles.hostStatNum}>{reviewCount}</Text>
                    <Text style={styles.hostStatLabel}>Reviews</Text>
                  </View>
                  <View style={styles.hostStatDivider} />
                  <View style={styles.hostStatItem}>
                    <Text style={styles.hostStatNum}>{ratingVal.toFixed(1)}</Text>
                    <Text style={styles.hostStatLabel}>Rating</Text>
                  </View>
                  <View style={styles.hostStatDivider} />
                  <View style={styles.hostStatItem}>
                    <Text style={styles.hostStatNum}>{hostTenure.num}</Text>
                    <Text style={styles.hostStatLabel}>{hostTenure.label}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.hostAttributesList}>
                <View style={styles.hostAttrRow}>
                  <Feather name="briefcase" size={16} color="#222222" />
                  <Text style={styles.hostAttrText}>Work: {hostWork}</Text>
                </View>
                <View style={styles.hostAttrRow}>
                  <Feather name="globe" size={16} color="#222222" />
                  <Text style={styles.hostAttrText}>Speaks: {hostLanguages}</Text>
                </View>
              </View>

              <Text style={styles.hostBioText}>{hostBio}</Text>

              <View style={styles.hostDetailsBox}>
                <Text style={styles.hostDetailsTitle}>Host details</Text>
                <Text style={styles.hostDetailsText}>Response rate: {hostResponseRate}</Text>
                <Text style={styles.hostDetailsText}>Responds: {hostResponseTime}</Text>
              </View>
            </View>

            <View style={styles.separator} />

            {/* ── 10. THINGS TO KNOW ── */}
            <View style={styles.thingsToKnowSection}>
              <Text style={styles.sectionHeading}>Things to know</Text>

              <View style={styles.thingItemRow}>
                <Feather name="calendar" size={18} color="#222222" style={styles.thingIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.thingItemTitle}>Cancellation policy</Text>
                  <Text style={styles.thingItemSub}>
                    {cancellationPolicy === 'strict'
                      ? 'Full refund if cancelled at least 7 days before check-in.'
                      : cancellationPolicy === 'moderate'
                      ? 'Full refund if cancelled at least 5 days before check-in.'
                      : 'Free cancellation up to 24 hours before check-in.'}
                  </Text>
                </View>
              </View>

              <View style={styles.thingItemRow}>
                <Feather name="clock" size={18} color="#222222" style={styles.thingIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.thingItemTitle}>Check-in & Check-out</Text>
                  <Text style={styles.thingItemSub}>
                    Check-in after {checkInTime} · Check-out before {checkOutTime}
                  </Text>
                </View>
              </View>

              <View style={styles.thingItemRow}>
                <Feather name="users" size={18} color="#222222" style={styles.thingIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.thingItemTitle}>House rules</Text>
                  <Text style={styles.thingItemSub}>
                    Maximum {maxGuests} guests allowed · Respect quiet hours
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ── STICKY BOTTOM ACTION BAR ── */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.bottomPriceCol}>
            {exp?.current_price != null ? (
              <Text style={styles.bottomPriceVal}>
                KES {Number(exp.current_price).toLocaleString()}
                <Text style={styles.bottomPriceUnit}> / {exp.price_unit ?? 'night'}</Text>
              </Text>
            ) : (
              <Text style={styles.bottomPriceVal}>Add dates for prices</Text>
            )}
            <View style={styles.bottomRatingRow}>
              {reviewCount > 0 ? (
                <>
                  <MaterialCommunityIcons name="star" size={12} color="#111111" />
                  <Text style={styles.bottomRatingText}>{ratingVal.toFixed(1)} ({reviewCount})</Text>
                </>
              ) : (
                <Text style={styles.bottomRatingText}>★ New listing</Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={() => {
              onClose();
              onBookNow?.();
            }}
            style={styles.checkAvailabilityBtn}
          >
            <Text style={styles.checkAvailabilityBtnText}>Check availability</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heroWrap: {
    width: '100%',
    height: 300,
    position: 'relative',
    backgroundColor: '#000000',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroNavRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  navRightGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  photoCountPill: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  titleSection: {
    gap: 4,
    paddingBottom: 16,
  },
  listingTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    lineHeight: 28,
  },
  unitSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
    marginTop: 2,
  },
  capacitySpecs: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
  },
  guestFavRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  ribbonCol: {
    alignItems: 'center',
    flex: 1,
  },
  ribbonRatingNumber: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  ribbonDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#EBEBEB',
  },
  ribbonMiddleCol: {
    alignItems: 'center',
    flex: 1.2,
  },
  laurelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guestFavTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    lineHeight: 16,
    textAlign: 'center',
  },
  ribbonReviewsNumber: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  ribbonReviewsLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 16,
  },
  highlightsBlock: {
    gap: 16,
    paddingVertical: 4,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  highlightIcon: {
    marginTop: 2,
  },
  highlightHeading: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  highlightSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
    lineHeight: 18,
  },
  descriptionSection: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 22,
  },
  reviewsShowcaseBlock: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  bigWreathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bigRatingText: {
    fontSize: 32,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  bigGuestFavTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  bigGuestFavSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  reviewsCarousel: {
    gap: 12,
    paddingVertical: 14,
  },
  reviewSnippetCard: {
    width: 260,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    gap: 8,
  },
  reviewerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  reviewerName: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  reviewerLoc: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewTimeAgo: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  reviewHeadline: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  reviewSnippetBody: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 18,
  },
  showAllReviewsBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  showAllReviewsBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  amenitiesSection: {
    gap: 10,
  },
  amenitiesList: {
    gap: 12,
    paddingTop: 4,
  },
  amenityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amenityIcon: {
    width: 24,
  },
  amenityName: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  showAllAmenitiesBtn: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  showAllAmenitiesBtnText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  locationSection: {
    gap: 6,
  },
  locationSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginBottom: 8,
  },
  mapCardMock: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  mapCardImage: {
    width: '100%',
    height: '100%',
  },
  mapPinCircle: {
    position: 'absolute',
    top: '40%',
    left: '45%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  meetHostSection: {
    gap: 14,
  },
  hostProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  hostCardLeft: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  hostCardAvatarWrap: {
    position: 'relative',
  },
  hostCardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  hostCardAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostCardAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
  },
  hostCardShieldBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#008A05',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hostCardName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  superhostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  superhostText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  hostCardStatsCol: {
    flex: 1.2,
    gap: 6,
    paddingLeft: 12,
  },
  hostStatItem: {
    alignItems: 'flex-start',
  },
  hostStatNum: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  hostStatLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  hostStatDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  hostAttributesList: {
    gap: 8,
  },
  hostAttrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hostAttrText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  hostBioText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  hostDetailsBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  hostDetailsTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 2,
  },
  hostDetailsText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  thingsToKnowSection: {
    gap: 14,
  },
  thingItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thingIcon: {
    marginTop: 2,
  },
  thingItemTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  thingItemSub: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
    lineHeight: 17,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomPriceCol: {
    gap: 2,
  },
  bottomPriceVal: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  bottomPriceUnit: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  bottomRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bottomRatingText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  checkAvailabilityBtn: {
    backgroundColor: BRAND_ORANGE,
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  checkAvailabilityBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
